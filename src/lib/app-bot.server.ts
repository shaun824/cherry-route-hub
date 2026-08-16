// Server-only context builder for the global "Ask Red Cherry" assistant.
// Assembles: app help guide, every live event (focused ones in full detail),
// crawled website knowledge, admin-approved learned FAQs and — when the person
// is signed in — their own records.
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_HELP_TEXT } from "@/lib/app-help";

type AnyClient = SupabaseClient<any, any, any>;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "what", "when", "where", "how", "does", "did", "are", "was",
  "you", "your", "our", "this", "that", "from", "into", "have", "has", "can", "will", "about",
  "event", "events", "red", "cherry", "ride", "rider", "there", "please", "tell", "need",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toDateString();
  } catch {
    return String(d);
  }
}

function summariseEvent(e: any): string {
  const bits = [
    e.name,
    fmtDate(e.event_date),
    e.location,
    e.discipline,
    e.lifecycle ? `status: ${e.lifecycle}` : null,
    e.distance_km ? `${e.distance_km} km` : null,
  ].filter(Boolean);
  return `- ${bits.join(" · ")}${e.entry_ninja_url ? ` — enter: ${e.entry_ninja_url}` : ""}${
    e.website_url ? ` — website: ${e.website_url}` : ""
  }`;
}

function detailEvent(e: any, info: any | null, merch: any[]): string {
  const lines: string[] = [`EVENT: ${e.name}`];
  if (e.event_date) lines.push(`Start date: ${fmtDate(e.event_date)}`);
  if (e.location) lines.push(`Location: ${e.location}`);
  if (e.discipline) lines.push(`Discipline: ${e.discipline}`);
  if (e.lifecycle) lines.push(`Status: ${e.lifecycle}`);
  if (e.description) lines.push(`Description: ${e.description}`);
  if (e.entry_ninja_url) lines.push(`Entries: ${e.entry_ninja_url}`);
  if (e.website_url) lines.push(`Website: ${e.website_url}`);

  const days = Array.isArray(e.days) ? e.days : [];
  if (days.length)
    lines.push(`Days: ${days.map((d: any) => `${d.label ?? d.name ?? "Day"}${d.date ? ` (${d.date})` : ""}`).join(", ")}`);

  const schedule = Array.isArray(e.schedule) ? e.schedule : [];
  if (schedule.length) {
    lines.push("Schedule:");
    for (const s of schedule.slice(0, 60)) {
      lines.push(`- ${[s.day, s.time, s.title, s.details].filter(Boolean).join(" — ")}`);
    }
  }

  const classes = Array.isArray(e.classes) ? e.classes : [];
  if (classes.length) lines.push(`Classes: ${classes.map((c: any) => c.name ?? c).join(", ")}`);

  const batches = Array.isArray(e.batches) ? e.batches : [];
  if (batches.length) lines.push(`Batches: ${batches.map((b: any) => b.name ?? b.label ?? b).join(", ")}`);

  if (e.spectator_parking) lines.push(`Spectator parking: ${e.spectator_parking}`);
  if (e.spectator_food) lines.push(`Spectator food: ${e.spectator_food}`);
  if (e.spectator_notes) lines.push(`Spectator notes: ${e.spectator_notes}`);

  if (info) {
    if (info.venue_address) lines.push(`Venue: ${info.venue_address}`);
    if (info.parking_notes) lines.push(`Parking: ${info.parking_notes}`);
    if (info.route_description) lines.push(`Route: ${info.route_description}`);
    if (info.distance_km) lines.push(`Distance: ${info.distance_km} km`);
    if (info.elevation_m) lines.push(`Elevation: ${info.elevation_m} m`);
    if (info.rules_md) lines.push(`Rules:\n${String(info.rules_md).slice(0, 4000)}`);
    if (Array.isArray(info.packing_list) && info.packing_list.length)
      lines.push(`Packing list: ${info.packing_list.map((p: any) => p.label ?? p).join(", ")}`);
    if (Array.isArray(info.faqs) && info.faqs.length) {
      lines.push("FAQs:");
      for (const f of info.faqs) lines.push(`Q: ${f.q}\nA: ${f.a}`);
    }
    if (Array.isArray(info.emergency_contacts) && info.emergency_contacts.length)
      lines.push(
        `Emergency contacts: ${info.emergency_contacts
          .map((c: any) => `${c.label}: ${c.phone}`)
          .join("; ")}`,
      );
  }

  if (merch.length) {
    lines.push("Merchandise available on Entry Ninja:");
    for (const m of merch.slice(0, 30)) {
      const opts = Array.isArray(m.options)
        ? m.options.map((o: any) => o.label ?? o.name ?? o).join(", ")
        : "";
      lines.push(`- ${m.name}${opts ? ` (${opts})` : ""}`);
    }
  }

  return lines.join("\n");
}

export type GlobalBotContext = { text: string; focusEventIds: string[] };

export async function buildGlobalBotContext(
  admin: AnyClient,
  opts: { question: string; userId: string | null },
): Promise<GlobalBotContext> {
  const { data: events } = await admin
    .from("events")
    .select("*")
    .neq("lifecycle", "archived")
    .order("event_date", { ascending: true })
    .limit(60);

  const all = events ?? [];

  // Which events does this person already belong to?
  const myEventIds = new Set<string>();
  if (userId(opts)) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", opts.userId!)
      .maybeSingle();
    const { data: owned } = await admin.from("entrants").select("id").eq("user_id", opts.userId!);
    let entrantIds = (owned ?? []).map((e: any) => e.id as string);
    if (profile?.email) {
      const { data: byEmail } = await admin.from("entrants").select("id").ilike("email", profile.email);
      for (const e of byEmail ?? []) if (!entrantIds.includes(e.id)) entrantIds.push(e.id);
    }
    if (entrantIds.length) {
      const { data: rows } = await admin
        .from("event_entrants")
        .select("event_id")
        .in("entrant_id", entrantIds)
        .limit(50);
      for (const r of rows ?? []) myEventIds.add(r.event_id as string);
    }
  }

  // Score events against the question so the one being asked about gets full detail.
  const qt = tokens(opts.question);
  const scored = all.map((e: any) => {
    const hay = tokens(`${e.name ?? ""} ${e.location ?? ""} ${e.slug ?? ""}`);
    let score = 0;
    for (const t of qt) if (hay.some((h) => h.includes(t) || t.includes(h))) score += 2;
    if (myEventIds.has(e.id)) score += 1;
    return { event: e, score };
  });

  let focus = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!focus.length) {
    // No named event — default to the next upcoming one so "when does it start" works.
    const now = Date.now();
    const next = all.find((e: any) => new Date(e.event_date).getTime() >= now) ?? all[0];
    if (next) focus = [{ event: next, score: 0 }];
  }
  const focusIds = focus.map((f) => f.event.id as string);

  const [{ data: infos }, { data: merch }, { data: knowledge }] = await Promise.all([
    admin.from("event_info_blocks").select("*").in("event_id", focusIds),
    admin.from("event_merch_options").select("event_id, name, options").in("event_id", focusIds),
    admin.from("event_bot_knowledge").select("event_id, content").in("event_id", focusIds),
  ]);

  const detailBlocks = focus.map((f) =>
    detailEvent(
      f.event,
      (infos ?? []).find((i: any) => i.event_id === f.event.id) ?? null,
      (merch ?? []).filter((m: any) => m.event_id === f.event.id),
    ),
  );

  const websiteBlocks = (knowledge ?? [])
    .map((k: any) => {
      const ev = all.find((e: any) => e.id === k.event_id);
      const content = String(k.content ?? "").slice(0, 30000);
      return content ? `WEBSITE PAGES — ${ev?.name ?? "event"}:\n${content}` : "";
    })
    .filter(Boolean);

  // Admin-approved learned answers (global + focus events).
  const today = new Date().toISOString().slice(0, 10);
  const { data: learned } = await admin
    .from("event_faq_learned")
    .select("question, answer, expires_on, event_id")
    .eq("status", "approved")
    .limit(200);
  const approved = (learned ?? [])
    .filter((f: any) => !f.expires_on || String(f.expires_on) >= today)
    .filter((f: any) => !f.event_id || focusIds.includes(f.event_id))
    .map((f: any) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");

  // The signed-in person's own records for the focus event.
  let riderText = "";
  if (opts.userId && focusIds.length) {
    try {
      const { buildRiderContext } = await import("@/lib/event-bot-rider.server");
      riderText = await buildRiderContext(admin, opts.userId, focusIds[0]!);
    } catch (e) {
      console.error("[app-bot] rider context failed", e);
    }
  }

  const text = [
    "HOW THE APP WORKS (use this for any 'how do I…' question about the app):",
    APP_HELP_TEXT,
    approved ? "APPROVED ANSWERS (verified by Red Cherry admins — highest priority):" : "",
    approved,
    riderText ? "THIS PERSON'S OWN RECORDS (authoritative, personal to them):" : "",
    riderText,
    "ALL CURRENT AND UPCOMING EVENTS:",
    all.map(summariseEvent).join("\n"),
    "EVENT DETAIL:",
    detailBlocks.join("\n\n"),
    websiteBlocks.join("\n\n"),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return { text, focusEventIds: focusIds };
}

function userId(opts: { userId: string | null }) {
  return Boolean(opts.userId);
}
