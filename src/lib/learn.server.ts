// Server-only: builds staff training courses out of the data the app already
// holds (events, schedules, venues, run sheets, departments, knowledge base)
// and writes them into the learn_* tables for crew to work through.
import { withRegistrationDayLabels } from "@/lib/event-days";
import type { EventDay, ScheduleItem } from "@/lib/mock-data";

type AnyClient = { from: (table: string) => any };

export type GeneratedLesson = {
  title: string;
  body: string;
  why_it_matters?: string;
  sources?: string[];
};

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
};

export type GeneratedModule = {
  title: string;
  summary?: string;
  lessons: GeneratedLesson[];
  quiz?: GeneratedQuestion[];
};

export type GeneratedCourse = {
  title?: string;
  summary?: string;
  modules: GeneratedModule[];
};

const MODEL = "google/gemini-3.7-flash";

// ---------- context builders ----------

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${value}`;
}

function fmtDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toDateString();
}

export async function buildBusinessContext(client: AnyClient): Promise<string> {
  const [{ data: events }, { data: knowledge }, { data: promos }, { data: sponsors }, { data: rewards }] =
    await Promise.all([
      client
        .from("events")
        .select("name, discipline, event_date, location, description, status, lifecycle, website_url, title_sponsor_name")
        .order("event_date", { ascending: true }),
      client
        .from("business_knowledge")
        .select("title, summary, body, category, tier, status")
        .eq("status", "approved")
        .limit(200),
      client.from("promos").select("brand, title, discount, expires").limit(50),
      client.from("sponsors").select("name, tier, url, active").eq("active", true).limit(60),
      client.from("loyalty_rewards").select("name, description, cost_points, value_label, partner, active").limit(40),
    ]);

  const out: string[] = [];

  out.push("OUR EVENTS (every event on file):");
  for (const e of events ?? []) {
    out.push(
      `- ${e.name} · ${e.discipline} · ${fmtDate(e.event_date)} · ${e.location}${
        e.title_sponsor_name ? ` · title sponsor: ${e.title_sponsor_name}` : ""
      }${e.status ? ` · ${e.status}` : ""}${e.website_url ? ` · ${e.website_url}` : ""}`,
    );
    if (e.description) out.push(`  ${String(e.description).slice(0, 400)}`);
  }

  if (sponsors?.length) {
    out.push("\nSPONSORS AND PARTNERS:");
    for (const s of sponsors) out.push(`- ${s.name} (${s.tier})${s.url ? ` — ${s.url}` : ""}`);
  }

  if (promos?.length) {
    out.push("\nRIDER PROMOS / PARTNER OFFERS:");
    for (const p of promos) out.push(`- ${p.brand}: ${p.title} — ${p.discount}${p.expires ? ` (until ${p.expires})` : ""}`);
  }

  if (rewards?.length) {
    out.push("\nLOYALTY (Cherry Miles) REWARDS:");
    for (const r of rewards) out.push(`- ${r.name} — ${r.value_label} for ${r.cost_points} points${r.partner ? ` (${r.partner})` : ""}`);
  }

  const internal = (knowledge ?? []).filter((k: any) => k.tier === "internal");
  const publicK = (knowledge ?? []).filter((k: any) => k.tier !== "internal");

  if (publicK.length) {
    out.push("\nBUSINESS KNOWLEDGE (rider-facing, written by the team):");
    for (const k of publicK) out.push(`- [${k.category}] ${k.title}: ${k.body}`);
  }
  if (internal.length) {
    out.push("\nINTERNAL KNOWLEDGE (staff only — includes ops process, suppliers, marketing clients and retainers):");
    for (const k of internal) out.push(`- [${k.category}] ${k.title}: ${k.body}`);
  }

  out.push(`
HOW RIDERS REACH US AND WE REACH THEM (fixed facts about this app):
- Riders enter through Entry Ninja; entries sync into the app automatically and each rider sees their entry, category, extras, balance and team mates.
- Riders get a branded "You're entered" welcome email as soon as their Entry Ninja entry syncs.
- The rider app carries: the news feed, event info pages, route maps and elevation profiles, the race village map, night-by-night accommodation, packing lists, results, photos and partner promos.
- Riders ask questions through the in-app assistant; anything it can't answer is handed to a Red Cherry admin and offered on WhatsApp business chat.
- We send push notifications and WhatsApp broadcasts (only to riders who have not opted out).
- Enjoy is the branded apparel supplier on every event.
- Cycle Lab promo = R150 in store at the event, claimed against a cell number. Rudy Project = R750, claimed at their stand at the event only.
- House rule: on almost every event day 1 is registration/arrival day; riding days number from the following day.`);

  return out.join("\n");
}

export async function buildEventContext(client: AnyClient, eventId: string): Promise<{ name: string; text: string }> {
  const { data: event } = await client.from("events").select("*").eq("id", eventId).maybeSingle();
  if (!event) throw new Error("Event not found");

  const [
    { data: info },
    { data: venues },
    { data: merch },
    { data: prices },
    { data: departments },
    { data: entrantCount },
  ] = await Promise.all([
    client.from("event_info_blocks").select("*").eq("event_id", eventId).maybeSingle(),
    client.from("event_venues").select("*").eq("event_id", eventId).order("sort_order", { ascending: true }),
    client.from("event_merch_options").select("name, description, price_from, options").eq("event_id", eventId),
    client.from("event_price_book").select("kind, label, price_cents, notes").eq("event_id", eventId),
    client.from("event_departments").select("name, lead_name, contact, overview").eq("event_id", eventId),
    client.from("event_entrants").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);

  const out: string[] = [];
  out.push(
    [
      line("Event name", event.name),
      line("Discipline", event.discipline),
      line("Start date", fmtDate(event.event_date)),
      line("Location", event.location),
      line("Description", event.description),
      line("Website", event.website_url),
      line("Title sponsor", event.title_sponsor_name),
      line("Entries so far", (entrantCount as any) ?? null),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const days = withRegistrationDayLabels(
    (Array.isArray(event.days) ? event.days : []) as EventDay[],
    (Array.isArray(event.schedule) ? event.schedule : []) as ScheduleItem[],
  );
  const schedule = (Array.isArray(event.schedule) ? event.schedule : []) as ScheduleItem[];
  if (days.length) {
    out.push("\nDAYS (day 1 is registration day unless named otherwise):");
    for (const d of days) {
      out.push(`- ${d.label}${d.date ? ` (${d.date})` : ""}`);
      for (const it of schedule.filter((s) => s.dayId === d.id)) {
        out.push(`   ${it.time ?? ""} ${it.label}${it.details ? ` — ${it.details}` : ""}`);
      }
    }
  } else if (schedule.length) {
    out.push("\nSCHEDULE:");
    for (const it of schedule) out.push(`- ${it.time ?? ""} ${it.label}${it.details ? ` — ${it.details}` : ""}`);
  }

  const classes = Array.isArray(event.classes) ? event.classes : [];
  if (classes.length) out.push(`\nCATEGORIES: ${classes.map((c: any) => c.name ?? c).join(", ")}`);
  const batches = Array.isArray(event.batches) ? event.batches : [];
  if (batches.length) out.push(`BATCHES: ${batches.map((b: any) => b.name ?? b).join(", ")}`);

  if (info) {
    out.push(
      "\nVENUE AND LOGISTICS:\n" +
        [
          line("Race village / main venue", info.venue_address),
          line("Registration venue name", info.reg_venue_name),
          line("Registration venue address", info.reg_venue_address),
          line("Registration notes", info.reg_notes),
          line("Parking", info.parking_notes),
          line("Finish location", info.finish_location),
          line("Route notes", info.route_description),
          line("Distance (km)", info.distance_km),
          line("Elevation (m)", info.elevation_m),
        ]
          .filter(Boolean)
          .join("\n"),
    );
    if (info.rules_md) out.push(`\nRULES:\n${info.rules_md}`);
    if (Array.isArray(info.faqs) && info.faqs.length) {
      out.push("\nFAQs:");
      for (const f of info.faqs) out.push(`Q: ${f.q}\nA: ${f.a}`);
    }
    if (Array.isArray(info.packing_list) && info.packing_list.length) {
      out.push(`\nRIDER PACKING LIST: ${info.packing_list.map((p: any) => p.label).join(", ")}`);
    }
    if (Array.isArray(info.emergency_contacts) && info.emergency_contacts.length) {
      out.push(
        `\nEMERGENCY CONTACTS: ${info.emergency_contacts.map((c: any) => `${c.label}: ${c.phone}`).join("; ")}`,
      );
    }
  }

  if (venues?.length) {
    out.push("\nOVERNIGHT VENUES (night-by-night accommodation):");
    for (const v of venues) {
      const nights =
        v.night_start != null ? `nights ${v.night_start}${v.nights && v.nights > 1 ? `–${v.night_start + v.nights - 1}` : ""}` : "";
      out.push(
        `- ${v.name}${v.address ? ` — ${v.address}` : ""}${nights ? ` · ${nights}` : ""}${
          v.self_booked ? " · riders book this one themselves" : ""
        }${v.check_in ? ` · check-in ${v.check_in}` : ""}${v.check_out ? ` · check-out ${v.check_out}` : ""}`,
      );
      if (v.notes) out.push(`  ${v.notes}`);
    }
  }

  if (merch?.length) {
    out.push("\nEXTRAS AND ADD-ONS RIDERS CAN BUY (live from Entry Ninja):");
    for (const m of merch) {
      out.push(`- ${m.name}${m.price_from ? ` (from R${Number(m.price_from).toFixed(0)})` : ""}`);
      if (m.description) out.push(`  ${m.description}`);
    }
  }

  if (prices?.length) {
    out.push("\nPRICE BOOK (used to work out what a rider owes):");
    for (const p of prices) out.push(`- [${p.kind}] ${p.label}: R${(p.price_cents / 100).toFixed(0)}${p.notes ? ` — ${p.notes}` : ""}`);
  }

  if (departments?.length) {
    out.push(`\nCREW DEPARTMENTS ON THIS EVENT: ${departments.map((d: any) => d.name).join(", ")}`);
  }

  return { name: event.name as string, text: out.join("\n") };
}

export async function buildDepartmentContext(
  client: AnyClient,
  departmentId: string,
): Promise<{ name: string; eventId: string; text: string }> {
  const { data: dept } = await client
    .from("event_departments")
    .select("id, event_id, name, lead_name, contact, overview, safety_notes")
    .eq("id", departmentId)
    .maybeSingle();
  if (!dept) throw new Error("Department not found");

  const [{ data: event }, { data: tasks }, { data: packing }] = await Promise.all([
    client.from("events").select("name, event_date, location").eq("id", dept.event_id).maybeSingle(),
    client
      .from("run_sheet_tasks")
      .select("day_label, day_index, start_time, end_time, task, detail, owner, location, notes")
      .eq("department_id", departmentId)
      .order("day_index", { ascending: true })
      .order("sort_order", { ascending: true }),
    client
      .from("department_packing_items")
      .select("item, qty, notes, critical")
      .eq("department_id", departmentId)
      .order("sort_order", { ascending: true }),
  ]);

  const out: string[] = [];
  out.push(
    [
      line("Department", dept.name),
      line("Event", event?.name),
      line("Event date", fmtDate(event?.event_date)),
      line("Location", event?.location),
      line("Department lead", dept.lead_name),
      line("Contact", dept.contact),
      line("Overview", dept.overview),
      line("Safety notes", dept.safety_notes),
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (tasks?.length) {
    out.push("\nRUN SHEET (this department's tasks, in order):");
    let day = "";
    for (const t of tasks) {
      if (t.day_label !== day) {
        day = t.day_label;
        out.push(`\n${day}:`);
      }
      out.push(
        `- ${[t.start_time, t.end_time].filter(Boolean).join("–") || "(no time)"} ${t.task}${
          t.detail ? ` — ${t.detail}` : ""
        }${t.owner ? ` · owner: ${t.owner}` : ""}${t.location ? ` · at ${t.location}` : ""}${
          t.notes ? ` · ${t.notes}` : ""
        }`,
      );
    }
  }

  if (packing?.length) {
    out.push("\nPACKING LIST:");
    for (const p of packing) {
      out.push(`- ${p.item}${p.qty ? ` × ${p.qty}` : ""}${p.critical ? " (CRITICAL)" : ""}${p.notes ? ` — ${p.notes}` : ""}`);
    }
  }

  return { name: dept.name as string, eventId: dept.event_id as string, text: out.join("\n") };
}

// ---------- AI drafting ----------

const SHAPE = `Respond with JSON only, in this exact shape:
{"title": string, "summary": string, "modules": [
  {"title": string, "summary": string,
   "lessons": [{"title": string, "body": string, "why_it_matters": string, "sources": [string]}],
   "quiz": [{"question": string, "options": [string, string, string], "correct_index": number, "explanation": string}]}
]}`;

const RULES = `Rules:
- Write for a brand new Red Cherry Events employee on their first week. Plain South African English, warm and practical, no corporate filler.
- Use ONLY facts present in the CONTEXT. Never invent times, prices, venue names, contacts or policies. If something isn't in the context, leave it out.
- Be concrete: name the real venues, real times, real categories, real departments from the context. Detail is the point — the reader should be able to work the event afterwards.
- "body" is markdown: 100–250 words per lesson, short paragraphs and bullet lists. "why_it_matters" is one sentence explaining why this matters on the ground or to a rider.
- "sources" lists the parts of the context the lesson came from, e.g. ["schedule", "event_venues"].
- 4–8 modules, each with 3–6 lessons and exactly 4 quiz questions.
- Quiz questions must be answerable from the lessons in that module. 3 or 4 options each, one correct, correct_index is 0-based. "explanation" says why the answer is right.`;

async function draftCourse(system: string, context: string): Promise<GeneratedCourse> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: `${system}\n\n${RULES}\n\n${SHAPE}` },
        { role: "user", content: `CONTEXT:\n${context}` },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The AI service is busy right now — try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are exhausted for this workspace. Top up to keep generating courses.");
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 300)}`);
  }

  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  let parsed: GeneratedCourse;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The AI returned an unreadable course. Try generating again.");
  }
  if (!Array.isArray(parsed.modules) || !parsed.modules.length) {
    throw new Error("The AI returned no modules. There may not be enough data on file yet.");
  }
  return parsed;
}

// ---------- persistence ----------

async function replaceCourseContent(client: AnyClient, courseId: string, course: GeneratedCourse) {
  // Modules cascade to lessons and quiz questions.
  await client.from("learn_modules").delete().eq("course_id", courseId);

  let mi = 0;
  for (const mod of course.modules) {
    const { data: created, error } = await client
      .from("learn_modules")
      .insert({ course_id: courseId, title: mod.title, summary: mod.summary ?? null, sort_order: mi })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const moduleId = created.id as string;
    mi += 1;

    const lessons = (mod.lessons ?? []).map((l, i) => ({
      module_id: moduleId,
      title: l.title,
      body: l.body,
      why_it_matters: l.why_it_matters ?? null,
      sources: Array.isArray(l.sources) ? l.sources : [],
      sort_order: i,
    }));
    if (lessons.length) {
      const { error: le } = await client.from("learn_lessons").insert(lessons);
      if (le) throw new Error(le.message);
    }

    const questions = (mod.quiz ?? [])
      .filter((q) => Array.isArray(q.options) && q.options.length >= 2)
      .map((q, i) => ({
        module_id: moduleId,
        question: q.question,
        options: q.options,
        correct_index: Math.max(0, Math.min(q.options.length - 1, Number(q.correct_index) || 0)),
        explanation: q.explanation ?? null,
        sort_order: i,
      }));
    if (questions.length) {
      const { error: qe } = await client.from("learn_quiz_questions").insert(questions);
      if (qe) throw new Error(qe.message);
    }
  }
}

async function upsertCourse(
  client: AnyClient,
  match: { kind: string; event_id?: string | null; department_id?: string | null },
  fields: { title: string; summary: string | null },
): Promise<string> {
  let q = client.from("learn_courses").select("id").eq("kind", match.kind);
  q = match.event_id ? q.eq("event_id", match.event_id) : q.is("event_id", null);
  q = match.department_id ? q.eq("department_id", match.department_id) : q.is("department_id", null);
  const { data: existing } = await q.maybeSingle();

  if (existing?.id) {
    await client.from("learn_courses").update(fields).eq("id", existing.id);
    return existing.id as string;
  }
  const { data: created, error } = await client
    .from("learn_courses")
    .insert({ ...match, ...fields, status: "published" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

async function finish(client: AnyClient, courseId: string, error?: string) {
  await client
    .from("learn_courses")
    .update({ generated_at: new Date().toISOString(), generation_error: error ?? null })
    .eq("id", courseId);
}

export async function generateBusinessCourse(client: AnyClient) {
  const context = await buildBusinessContext(client);
  const courseId = await upsertCourse(
    client,
    { kind: "business", event_id: null, department_id: null },
    {
      title: "How Red Cherry works",
      summary: "The business end to end: our events, how riders enter and experience them, and the marketing clients we look after.",
    },
  );
  try {
    const course = await draftCourse(
      `You are building the induction course for a new Red Cherry Events employee. Red Cherry is a South African event organiser running multi-day mountain bike and motorbike stage events, and it also runs social media and marketing for a set of retainer clients.

Cover, in this order: who we are and what we run; the season calendar; how a rider enters (Entry Ninja) and what happens next; the rider experience from entry through registration, riding days, accommodation and results; how we communicate with riders (app, assistant, WhatsApp, push, news feed); sponsors, partner promos and loyalty; our marketing side — the retainer clients whose social media and marketing we run, what we deliver for each, posting cadence, the approval process and the brand tone per client; and finally tone of voice and confidentiality (what staff must never share: commercial figures, contracts, supplier rates, rider personal data).

If the context contains nothing about a particular marketing client, still include a marketing module built only from what IS there, and say plainly where the reader must ask their manager for the detail.`,
      context,
    );
    await replaceCourseContent(client, courseId, course);
    await finish(client, courseId);
    return { courseId, modules: course.modules.length };
  } catch (e) {
    await finish(client, courseId, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export async function generateEventCourse(client: AnyClient, eventId: string) {
  const { name, text } = await buildEventContext(client, eventId);
  const courseId = await upsertCourse(
    client,
    { kind: "event", event_id: eventId, department_id: null },
    { title: `${name}: everything about the event`, summary: `Setup, schedule, venues, routes and the rider experience at ${name}.` },
  );
  try {
    const course = await draftCourse(
      `You are building the event deep-dive course for a new Red Cherry Events employee, about "${name}".

Cover: what this event is and who rides it; the day-by-day schedule (day 1 is registration day unless the context names it otherwise); registration and check-in (note clearly when the registration venue differs from the riding venue); the race village and what's in it; night-by-night accommodation and how riders are allocated; the routes, distances and cut-offs; categories, batches and seeding; what a rider's entry includes and the extras they can buy; the finish; and the rider journey hour by hour — what a rider sees, needs and asks at each stage.`,
      text,
    );
    await replaceCourseContent(client, courseId, course);
    await finish(client, courseId);
    return { courseId, modules: course.modules.length };
  } catch (e) {
    await finish(client, courseId, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export async function generateDepartmentCourse(client: AnyClient, departmentId: string) {
  const { name, eventId, text } = await buildDepartmentContext(client, departmentId);
  const courseId = await upsertCourse(
    client,
    { kind: "department", event_id: eventId, department_id: departmentId },
    { title: `${name}: how this department runs`, summary: `Brief, run sheet, packing list and safety rules for ${name}.` },
  );
  try {
    const course = await draftCourse(
      `You are building the department onboarding course for someone joining the "${name}" department on a Red Cherry event.

Cover: what this department is responsible for and who leads it; where it sits in the wider event; the run sheet day by day with real times and tasks; the kit and packing list and why each critical item matters; safety and site rules; who to call when something goes wrong; and the handovers with other departments.`,
      text,
    );
    await replaceCourseContent(client, courseId, course);
    await finish(client, courseId);
    return { courseId, modules: course.modules.length };
  } catch (e) {
    await finish(client, courseId, e instanceof Error ? e.message : String(e));
    throw e;
  }
}
