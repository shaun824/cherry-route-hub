// Server-only: sends the "you're entered" welcome email for Entry Ninja entries.
// One email per entry (event + rider). Never resends — `welcome_email_sent_at`
// on public.event_entrants is the ledger.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "./email-templates/send-email";
import { isPromoLive, promoMatchesEvent } from "./event-promos";
import type { Promo } from "./mock-data";
import type { EmailOffer } from "./email-templates/entry-welcome";

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
      "id, event_id, entrant_id, registration_ref, category, bib_number, entrants(full_name, email), events(id, name, event_date, location, lifecycle)",
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
    // Multi-rider entries share a registration reference; keep them together so
    // the family/team gets one mail listing everyone.
    const key = `${event.id}|${row.registration_ref || email}`;
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
          category: lead.category ?? null,
          bibNumber: lead.bib_number ?? null,
          party,
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
