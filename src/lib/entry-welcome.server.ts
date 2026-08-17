// Server-only: sends the "you're entered" welcome email for Entry Ninja entries.
// One email per entry (event + rider). Never resends — `welcome_email_sent_at`
// on public.event_entrants is the ledger.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "./email-templates/send-email";

type AnyClient = SupabaseClient<any, any, any>;

const APP_URL = "https://riderapp.redcherryevents.co.za";

/**
 * Entries that existed when welcome emails launched were stamped as "sent" by
 * the rollout migration so nobody got a surprise email about an old entry.
 * Anything stamped before this cutoff is historic and only eligible for an
 * explicit admin backfill.
 */
const LEGACY_CUTOFF = "2026-08-17T10:30:00Z";

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
      "id, event_id, entrant_id, category, bib_number, entrants(full_name, email), events(id, name, event_date, location, lifecycle)",
    )
    .order("created_at", { ascending: true })
    .limit(limit * 3);
  query =
    opts.mode === "backfill"
      ? query.or(`welcome_email_sent_at.is.null,welcome_email_sent_at.lt.${LEGACY_CUTOFF}`)
      : query.is("welcome_email_sent_at", null);
  if (opts.eventId) query = query.eq("event_id", opts.eventId);


  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as any[];
  for (const row of rows) {
    if (result.sent + result.suppressed >= limit) break;
    const email = (row.entrants?.email ?? "").trim().toLowerCase();
    const event = row.events;
    // No email, or the event isn't live in the app yet — leave it pending.
    if (!email || !event || event.lifecycle === "draft") {
      result.skipped++;
      continue;
    }
    result.candidates++;

    const eventUrl = `${APP_URL}/my-events/${event.id}`;
    const redirectTo = `${APP_URL}/reset-password?next=${encodeURIComponent(`/my-events/${event.id}`)}`;

    try {
      const { url, needsPassword } = await buildActionLink(
        admin,
        email,
        row.entrants?.full_name ?? null,
        redirectTo,
      );

      const send = await sendTemplateEmail("entry-welcome", email, {
        idempotencyKey: `entry-welcome-${row.id}`,
        templateData: {
          firstName: firstName(row.entrants?.full_name),
          eventName: event.name,
          eventDate: formatDate(event.event_date),
          venue: event.location ?? null,
          category: row.category ?? null,
          bibNumber: row.bib_number ?? null,
          eventUrl,
          actionUrl: url,
          needsPassword,
        },
      });

      await admin
        .from("event_entrants")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", row.id);

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

/** How many entries are still waiting on a welcome email. */
export async function countPendingEntryWelcomes(admin: AnyClient, eventId?: string) {
  let q = admin
    .from("event_entrants")
    .select("id", { count: "exact", head: true })
    .is("welcome_email_sent_at", null);
  if (eventId) q = q.eq("event_id", eventId);
  const { count } = await q;
  return count ?? 0;
}
