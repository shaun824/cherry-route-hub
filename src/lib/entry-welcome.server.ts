// Server-only: sends the "you're entered" welcome email for Entry Ninja entries.
// One email per entry (event + rider). Never resends — `welcome_email_sent_at`
// on public.event_entrants is the ledger.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "./email-templates/send-email";
import { isPromoLive, promoMatchesEvent } from "./event-promos";
import type { Promo } from "./mock-data";
import type { EmailOffer, EmailScheduleDay } from "./email-templates/entry-welcome";
import { withRegistrationDayLabels } from "./event-days";
import { isDayPass } from "./rider-classes";

type AnyClient = SupabaseClient<any, any, any>;

const APP_URL = "https://riderapp.redcherryevents.co.za";

/**
 * Rider offers, straight from the admin-managed promo list. Each event's email
 * lists only the offers assigned to that event, so editing Admin → Supplier
 * promos changes what future emails advertise with no code change.
 */
export async function loadPromoRows(admin: AnyClient): Promise<Promo[]> {
  const { data } = await admin
    .from("promos")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false });
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    brand: String(r.brand ?? ""),
    title: String(r.title ?? ""),
    code: String(r.code ?? ""),
    discount: String(r.discount ?? ""),
    expires: (r.expires as string | null) ?? "",
    accent: String(r.accent ?? ""),
    logoUrl: r.logo_url ?? undefined,
    url: r.url ?? undefined,
    blurb: r.blurb ?? undefined,
    redeem: r.redeem ?? undefined,
    eventMatch: r.event_match ?? undefined,
    active: r.active == null ? true : Boolean(r.active),
  }));
}

/** The live offers for one event, in the shape the email template renders. */
export function offersForEvent(promos: Promo[], eventName: string | null | undefined): EmailOffer[] {
  return promos
    .filter((p) => isPromoLive(p) && promoMatchesEvent(p, eventName))
    .map((p) => ({
      brand: p.brand,
      title: p.title,
      blurb: p.blurb ?? null,
      code: p.code || null,
      redeem: p.code ? null : p.redeem || "Show this offer to the supplier",
      discount: p.discount ?? null,
      url: p.url && p.url !== "#" ? p.url : null,
      logoUrl: absoluteUrl(p.logoUrl),
      accent: cssColorToHex(p.accent) ?? "#B21E2B",
      // Green Motion is a car-rental booking — "Get the code" doesn't fit.
      ctaLabel: /green\s*motion/i.test(p.brand) ? "Book your car" : null,
    }));
}

/** Email clients need fully-qualified image URLs — app-relative assets won't load. */
function absoluteUrl(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${APP_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

/**
 * Brand accents are stored as oklch() for the app, which no email client
 * understands — convert to hex so the mail carries the same colours.
 */
export function cssColorToHex(color: string | null | undefined): string | null {
  const c = (color ?? "").trim();
  if (!c) return null;
  if (c.startsWith("#")) return c;
  const m = c.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  let L = parseFloat(m[1]!);
  if (L > 1.5) L /= 100;
  const C = parseFloat(m[2]!);
  const hDeg = parseFloat(m[3]!);
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const mm = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const hex = lin
    .map((v) => {
      const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
      const n = Math.round(Math.min(1, Math.max(0, srgb)) * 255);
      return n.toString(16).padStart(2, "0");
    })
    .join("");
  return `#${hex}`;
}



/**
 * Entries that existed when welcome emails launched were stamped as "sent" by
 * the rollout migration so nobody got a surprise email about an old entry.
 * Anything stamped before this cutoff is historic and only eligible for an
 * explicit admin backfill.
 */
const LEGACY_CUTOFF = "2026-08-17T10:30:00Z";

/** True when someone at this event has already had a welcome mail at this address. */
async function hasWelcomeForEmail(admin: AnyClient, eventId: string, email: string) {
  const { data } = await admin
    .from("event_entrants")
    .select("id, entrants!inner(email)")
    .eq("event_id", eventId)
    .not("welcome_email_sent_at", "is", null)
    .ilike("entrants.email", email)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Marks every row in the group as mailed so nobody gets a second copy. */
async function stampRows(admin: AnyClient, rows: any[]) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return;
  await admin
    .from("event_entrants")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .in("id", ids);
}

/** Everyone entered at this event under the same registration (or email). */
async function loadEntryParty(
  admin: AnyClient,
  eventId: string,
  email: string,
  registrationRef: string | null,
  fallbackRows: any[],
) {
  let q = admin
    .from("event_entrants")
    .select("category, bib_number, entrants!inner(full_name, email)")
    .eq("event_id", eventId);
  q = registrationRef
    ? q.eq("registration_ref", registrationRef)
    : q.ilike("entrants.email", email);
  const { data } = await q;
  const rows = (data ?? []).length ? (data as any[]) : fallbackRows;
  const seen = new Set<string>();
  const party: { name: string; category: string | null; bibNumber: string | null }[] = [];
  for (const r of rows) {
    const name = (r.entrants?.full_name ?? "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    party.push({ name, category: r.category ?? null, bibNumber: r.bib_number ?? null });
  }
  return party;
}

/**
 * Google Maps directions link for a venue. Precise coordinates (map_query)
 * win — a bare name search can land on the wrong place or just show a
 * results list. Name-only venues get a "South Africa" hint so the search
 * resolves to the right venue instead of a namesake elsewhere.
 */
export function venueMapUrl(
  venue: string | null | undefined,
  mapQuery?: string | null | undefined,
): string | null {
  const coords = (mapQuery ?? "").trim();
  if (/^https?:\/\/(?:www\.)?(?:google\.[^/]+\/maps|maps\.app\.goo\.gl)\//i.test(coords)) {
    return coords;
  }
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(coords)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords)}`;
  }
  const v = (venue ?? "").trim();
  if (!v) return null;
  const q = /south africa/i.test(v) ? v : `${v}, South Africa`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const REG_LINE = /(registration|register|check[- ]?in|briefing)/i;
const KEY_LINE = /(start|briefing|registration|check[- ]?in|prize|batch)/i;
const TIERS = ["gold", "silver", "bronze"];

/** The tier word on a rider's category, e.g. "Silver - U/14 …" -> "silver". */
function tierOf(category: string | null | undefined) {
  const c = (category ?? "").toLowerCase();
  return TIERS.find((t) => c.includes(t)) ?? null;
}

/**
 * Some events split their starts by field rather than by tier (PE Plett runs
 * "The Ride", its e-bike field and "The Tour" off different times). Riders must
 * see their own field's start time, not somebody else's.
 */
function fieldOf(text: string | null | undefined) {
  const t = (text ?? "").toLowerCase();
  if (/e-?\s?bike/.test(t)) return "ebike";
  if (/\btour\b/.test(t)) return "tour";
  if (/\bride\b/.test(t)) return "ride";
  return null;
}


/**
 * Multi-trip events (Tour de Addo runs two back-to-back Darlington trips) label
 * their days "Trip 1 · Day 1" and sell them as separate categories. A rider
 * must only ever see the itinerary for the trip they actually entered.
 */
export function tripNumberOf(text: string | null | undefined): string | null {
  const m = /trip\s*#?\s*(\d+)/i.exec(String(text ?? ""));
  return m ? m[1] : null;
}

function daysForTrip<T extends { label?: unknown }>(days: T[], category: string | null | undefined): T[] {
  const trip = tripNumberOf(category);
  if (!trip) return days;
  const mine = days.filter((d) => tripNumberOf(String((d as any).label ?? "")) === trip);
  return mine.length ? mine : days;
}

function dayDate(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-ZA", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  } catch {
    return null;
  }
}

/**
 * The times this rider actually needs: registration, their own batch start and
 * prize giving, day by day, straight off the event schedule we sync from the
 * event website.
 */
/**
 * The event's stored schedule is the single source of truth for rider emails.
 * Scrape "needs review" flags no longer blank out times — admins edit the
 * schedule directly, so whatever is stored is what riders get.
 */
export async function scheduleTrustedEventIds(_admin: any, eventIds: string[]): Promise<Set<string>> {
  return new Set(eventIds);
}


/** Only absolute https logos work in email clients. */
export function absoluteLogo(url: string | null | undefined): string | null {
  const u = (url ?? "").trim();
  return /^https:\/\//i.test(u) ? u : null;
}

export function riderScheduleForEmail(
  event: any,
  category: string | null | undefined,
  opts: { trusted?: boolean } = {},
): EmailScheduleDay[] {
  const schedule: any[] = opts.trusted === false ? [] : Array.isArray(event?.schedule) ? event.schedule : [];
  const rawDays: any[] = Array.isArray(event?.days) ? event.days : [];
  // No published (or no verified) schedule yet: still give riders the day-by-day
  // shape of the event so every event email carries the same standard.
  if (!schedule.length) {
    const fallback = daysForTrip(withRegistrationDayLabels(rawDays as any, [] as any) as any[], category);
    return fallback
      .map((d: any) => ({
        label: String(d.label ?? ""),
        date: dayDate(d.date),
        items: [{ time: "TBC", label: "Times confirmed closer to the event", details: null }],
      }))
      .filter((d) => d.label);
  }
  const days = daysForTrip(
    withRegistrationDayLabels(
      (Array.isArray(event?.days) ? event.days : []) as any,
      schedule as any,
    ) as any[],
    category,
  );
  // Day-pass riders start with the weekend-pass riders in their category, so
  // they get the full itinerary with every batch start rather than a filtered one.
  const dayPass = isDayPass(category);
  const tier = dayPass ? null : tierOf(category);
  const field = dayPass ? null : fieldOf(category);

  const build = (items: any[]): EmailScheduleDay["items"] =>
    items
      .filter((i) => {
        const text = `${i.label ?? ""} ${i.details ?? ""}`;
        if (!i.time || !KEY_LINE.test(text)) return false;
        // Only their own batch when the schedule splits starts by tier.
        const mentioned = TIERS.filter((t) => text.toLowerCase().includes(t));
        if (mentioned.length && tier) return mentioned.includes(tier);
        // Same for events that split starts by field (The Ride / e-bike / The Tour).
        const lineField = fieldOf(text);
        if (lineField && field) return lineField === field;
        return true;
      })

      .map((i) => ({ time: String(i.time), label: String(i.label ?? ""), details: i.details ?? null }))
      .sort((a, b) => a.time.localeCompare(b.time));

  if (days.length) {
    return days
      .map((d: any) => ({
        label: String(d.label ?? ""),
        date: dayDate(d.date),
        items: build(schedule.filter((i) => i.dayId === d.id)),
      }))
      .filter((d) => d.items.length);
  }

  const items = build(schedule);
  return items.length ? [{ label: "Event day", date: null, items }] : [];
}

/**
 * When riders on one entry are in different categories/trips, each of them
 * gets their own key times so the entry holder sees every start time on the
 * entry — not just the recipient's. Returns [] when everyone rides the same
 * class (nothing extra to show).
 */
export function partySchedulesForEmail(
  event: any,
  party: { name: string; category?: string | null }[],
  opts: { trusted?: boolean } = {},
): { name: string; category?: string | null; days: EmailScheduleDay[] }[] {
  const distinct = new Map<string, string | null>();
  for (const p of party) {
    const c = (p.category ?? "").trim().toLowerCase();
    if (c && !distinct.has(c)) distinct.set(c, p.category ?? null);
  }
  if (distinct.size < 2) return [];
  const byCategory = new Map<string, EmailScheduleDay[]>();
  for (const [key, label] of distinct) {
    byCategory.set(key, riderScheduleForEmail(event, label, opts));
  }
  return party
    .map((p) => {
      const key = (p.category ?? "").trim().toLowerCase();
      const days = key ? (byCategory.get(key) ?? []) : [];
      return { name: p.name, category: p.category ?? null, days };
    })
    .filter((ps) => ps.days.length);
}

export type WelcomeBatchResult = {
  candidates: number;
  sent: number;
  skipped: number;
  suppressed: number;
  errors: string[];
};

function firstName(fullName?: string | null) {
  const n = (fullName ?? "").trim().split(/\s+/)[0];
  return n || undefined;
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Johannesburg",
    });
  } catch {
    return null;
  }
}

/**
 * Builds a sign-in link for the rider: an invite link when they have no
 * account yet, a magic link when they do. Falls back to the plain event URL.
 */
async function buildActionLink(
  admin: AnyClient,
  email: string,
  fullName: string | null,
  redirectTo: string,
): Promise<{ url: string; needsPassword: boolean }> {
  const auth = (admin as any).auth?.admin;
  if (!auth?.generateLink) return { url: redirectTo, needsPassword: false };

  try {
    const { data, error } = await auth.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: fullName ? { full_name: fullName } : undefined },
    });
    if (!error && data?.properties?.action_link) {
      return { url: data.properties.action_link as string, needsPassword: true };
    }
  } catch {
    /* fall through to magic link */
  }

  try {
    const { data, error } = await auth.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (!error && data?.properties?.action_link) {
      return { url: data.properties.action_link as string, needsPassword: false };
    }
  } catch {
    /* fall through */
  }

  return { url: redirectTo, needsPassword: false };
}

/**
 * Sends the welcome email for every entry that hasn't had one yet.
 * - mode "new" (default): only entries synced since the feature went live.
 * - mode "backfill": also includes historic entries stamped by the rollout
 *   migration, so an admin can deliberately email an existing roster once.
 */
export async function sendPendingEntryWelcomes(
  admin: AnyClient,
  opts: { eventId?: string; limit?: number; mode?: "new" | "backfill" } = {},
): Promise<WelcomeBatchResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const result: WelcomeBatchResult = {
    candidates: 0,
    sent: 0,
    skipped: 0,
    suppressed: 0,
    errors: [],
  };

  let query = admin
    .from("event_entrants")
    .select(
      "id, event_id, entrant_id, registration_ref, category, bib_number, entrants(full_name, email), events(id, name, event_date, location, map_query, lifecycle, days, schedule, logo_url, cover_url)",
    )
    // Archived-roster imports are flagged as skipped; without this filter they
    // fill every batch and brand-new entries never get reached.
    .eq("welcome_email_skipped", false)
    .order("created_at", { ascending: false })
    .limit(limit * 3);
  query =
    opts.mode === "backfill"
      ? query.or(`welcome_email_sent_at.is.null,welcome_email_sent_at.lt.${LEGACY_CUTOFF}`)
      : query.is("welcome_email_sent_at", null);
  if (opts.eventId) query = query.eq("event_id", opts.eventId);


  const { data, error } = await query;
  if (error) throw error;

  // One promo read per batch; each email then gets only its own event's offers.
  const promoRows = await loadPromoRows(admin);

  const rows = (data ?? []) as any[];
  const trustedSchedules = await scheduleTrustedEventIds(
    admin,
    Array.from(new Set(rows.map((r: any) => r.events?.id).filter(Boolean))) as string[],
  );

  // One email address gets ONE mail per event, no matter how many riders sit
  // under that entry — group the pending rows by event + address first.
  const groups = new Map<string, { email: string; event: any; rows: any[] }>();
  for (const row of rows) {
    const email = (row.entrants?.email ?? "").trim().toLowerCase();
    const event = row.events;
    // No email, or the event isn't live in the app yet — leave it pending.
    if (!email || !event || event.lifecycle === "draft" || event.lifecycle === "archived") {
      result.skipped++;
      continue;
    }
    // Group by email so every person with their own address on a shared
    // registration still receives their own welcome email. The party list below
    // will still include everyone on the same registration reference.
    const key = `${event.id}|${email}`;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { email, event, rows: [row] });
  }

  for (const { email, event, rows: groupRows } of groups.values()) {
    if (result.sent + result.suppressed >= limit) break;

    // Belt and braces: if any entry at this event already mailed this address,
    // never send again — just stamp the stragglers.
    const already = await hasWelcomeForEmail(admin, event.id, email);
    if (already) {
      await stampRows(admin, groupRows);
      result.skipped += groupRows.length;
      continue;
    }

    result.candidates++;

    const party = await loadEntryParty(admin, event.id, email, groupRows[0]?.registration_ref ?? null, groupRows);
    const lead = groupRows[0];
    const eventUrl = `${APP_URL}/my-events/${event.id}`;
    const redirectTo = `${APP_URL}/reset-password?next=${encodeURIComponent(`/my-events/${event.id}`)}`;

    try {
      const { url, needsPassword } = await buildActionLink(
        admin,
        email,
        lead.entrants?.full_name ?? null,
        redirectTo,
      );

      const send = await sendTemplateEmail("entry-welcome", email, {
        idempotencyKey: `entry-welcome-${event.id}-${email}`,
        templateData: {
          firstName: firstName(lead.entrants?.full_name),
          eventName: event.name,
          eventDate: formatDate(event.event_date),
          venue: event.location ?? null,
          venueUrl: venueMapUrl(event.location, (event as { map_query?: string | null }).map_query),
          eventLogoUrl: absoluteLogo(event.logo_url),
          eventCoverUrl: absoluteLogo(event.cover_url),
          schedule: riderScheduleForEmail(event, lead.category, { trusted: trustedSchedules.has(event.id) }),
          category: lead.category ?? null,
          bibNumber: lead.bib_number ?? null,
          party,
          partySchedules: partySchedulesForEmail(event, party, { trusted: trustedSchedules.has(event.id) }),
          eventUrl,
          actionUrl: url,
          needsPassword,
          offers: offersForEvent(promoRows, event.name),
        },
      });

      await stampRows(admin, groupRows);

      if (send.sent) result.sent++;
      else result.suppressed++;
    } catch (err) {
      if (err instanceof EmailAPIError && err.status === 429) {
        // Out of allowance for now — stop and let the next run continue.
        result.errors.push("Hourly email allowance reached — remaining entries queue for the next run.");
        break;
      }
      if (result.errors.length < 10) {
        result.errors.push(`${email}: ${(err as Error).message}`);
      }
    }
  }


  return result;
}

/** How many entries are waiting on a welcome email, new vs historic. */
export async function countPendingEntryWelcomes(
  admin: AnyClient,
  opts: { eventId?: string } = {},
) {
  const base = () => {
    let q = admin
      .from("event_entrants")
      .select("id", { count: "exact", head: true })
      .eq("welcome_email_skipped", false);
    if (opts.eventId) q = q.eq("event_id", opts.eventId);
    return q;
  };
  const [fresh, legacy] = await Promise.all([
    base().is("welcome_email_sent_at", null),
    base().lt("welcome_email_sent_at", LEGACY_CUTOFF),
  ]);
  return { pending: fresh.count ?? 0, historic: legacy.count ?? 0 };
}
