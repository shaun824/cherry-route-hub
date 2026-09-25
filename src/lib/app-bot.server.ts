// Server-only context builder for the global "Ask Red Cherry" assistant.
// Assembles: app help guide, every live event (focused ones in full detail),
// crawled website knowledge, admin-approved learned FAQs and — when the person
// is signed in — their own records.
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_HELP_TEXT } from "@/lib/app-help";
import { venueMapLinks } from "@/lib/map-embed";

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
  return `- ${bits.join(" · ")} — app page: /events/${e.id} (rider hub: /my-events/${e.id}, map: /events/${e.id}/map, spectate: /spectate/${e.id})${
    e.entry_ninja_url ? ` — enter: ${e.entry_ninja_url}` : ""
  }${e.website_url ? ` — website: ${e.website_url}` : ""}`;
}


function detailEvent(e: any, info: any | null, merch: any[]): string {
  const lines: string[] = [
    `EVENT: ${e.name}`,
    `App links: event page /events/${e.id} · rider hub /my-events/${e.id} · route map /events/${e.id}/map · spectator info /spectate/${e.id}`,
  ];

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
    const maps = venueMapLinks({
      mapUrl: (info as any).venue_map_url ?? (info as any).map_url ?? null,
      lat: info.venue_lat != null ? Number(info.venue_lat) : null,
      lng: info.venue_lng != null ? Number(info.venue_lng) : null,
      address: info.venue_address ?? e.location ?? null,
      name: e.location ?? null,
    });
    if (maps) {
      lines.push(
        `These Google Maps links point at the confirmed venue (${e.location ?? info.venue_address}) — use them exactly as given, never build your own.`,
      );
      lines.push(`Venue on Google Maps: ${maps.pin}`);
      lines.push(`Driving directions to the venue: ${maps.directions}`);
    }

    if (info.reg_venue_name || info.reg_venue_address) {
      lines.push(
        `IMPORTANT — registration / check-in happens at a DIFFERENT place to the riding venue: ${info.reg_venue_name ?? ""}${
          info.reg_venue_address ? ` — ${info.reg_venue_address}` : ""
        }`,
      );
      const regMaps = venueMapLinks({
        mapUrl: null,
        lat: info.reg_venue_lat != null ? Number(info.reg_venue_lat) : null,
        lng: info.reg_venue_lng != null ? Number(info.reg_venue_lng) : null,
        address: info.reg_venue_address ?? info.reg_venue_name ?? null,
        name: info.reg_venue_name ?? null,
      });
      if (regMaps) lines.push(`Registration venue on Google Maps: ${regMaps.pin}`);
    }
    if (info.reg_notes) lines.push(`Registration notes: ${info.reg_notes}`);
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
    lines.push(
      "Branded merchandise supplier: Enjoy (all Red Cherry Events). All event t-shirts, riding tops, jackets and apparel are produced and sold by Enjoy, who have a stand at every event.",
    );
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
  opts: { question: string; userId: string | null; isAdmin?: boolean; isStaff?: boolean },
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
  if (opts.userId) {
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

  // Admin-approved learned answers (global + focus events). `follow_ups` are the
  // questions real riders asked next in the same conversation arc.
  const today = new Date().toISOString().slice(0, 10);
  const { data: learned } = await admin
    .from("event_faq_learned")
    .select("question, answer, expires_on, event_id, follow_ups")
    .eq("status", "approved")
    .limit(200);
  const approved = (learned ?? [])
    .filter((f: any) => !f.expires_on || String(f.expires_on) >= today)
    .filter((f: any) => !f.event_id || focusIds.includes(f.event_id))
    .map((f: any) => {
      const next = (f.follow_ups ?? []).filter(Boolean) as string[];
      return `Q: ${f.question}\nA: ${f.answer}${
        next.length ? `\nRiders who asked this usually asked next: ${next.join(" | ")}` : ""
      }`;
    })
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

  // Business knowledge the team has taught the assistant (emails, playbooks,
  // product notes, policies). Internal-tier notes only for verified admins.
  let knowledgeText = "";
  try {
    const { buildKnowledgeContext } = await import("@/lib/knowledge-ingest.server");
    knowledgeText = await buildKnowledgeContext(admin, {
      question: opts.question,
      eventIds: focusIds,
      includeInternal: opts.isAdmin === true || opts.isStaff === true,
    });
  } catch (e) {
    console.error("[app-bot] knowledge context failed", e);
  }

  let promoPerformanceText = "";
  if (opts.isAdmin) {
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: promoSummary } = await admin.rpc("promo_engagement_summary", { _since: since });
      const summary = promoSummary as any;
      const rows = Array.isArray(summary?.promos) ? summary.promos : [];
      promoPerformanceText = [
        "SUPPLIER PROMO PERFORMANCE — LAST 30 DAYS (ADMIN ONLY):",
        "These figures measure interest, not confirmed code redemptions or completed sales.",
        `Total offer views: ${Number(summary?.impressions ?? 0)}; code copies: ${Number(summary?.copies ?? 0)}; supplier-site clicks: ${Number(summary?.outbound_clicks ?? 0)}; estimated return: R${(Number(summary?.estimated_return_cents ?? 0) / 100).toFixed(2)}.`,
        ...rows.map((p: any) => `- ${p.brand} — ${p.impressions} views, ${p.unique_viewers} visitors, ${p.opens} opens, ${p.copies} copies, ${p.outbound_clicks} supplier-site clicks, ${p.click_through_pct}% click-through, estimated return R${(Number(p.estimated_return_cents ?? 0) / 100).toFixed(2)}.`),
      ].join("\n");
    } catch (e) {
      console.error("[app-bot] promo performance failed", e);
    }
  }

  const text = [
    "HOW THE APP WORKS (use this for any 'how do I…' question about the app):",
    APP_HELP_TEXT,
    approved ? "APPROVED ANSWERS (verified by Red Cherry admins — highest priority):" : "",
    approved,
    knowledgeText ? "RED CHERRY BUSINESS KNOWLEDGE (written by the team — trust it):" : "",
    knowledgeText,
    promoPerformanceText,
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

/** Resolve the caller when a Supabase bearer token is present; null when signed out. */
export async function resolveOptionalUserId(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
            headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return String(data.claims.sub);
  } catch (e) {
    console.error("[app-bot] token check failed", e);
    return null;
  }
}
