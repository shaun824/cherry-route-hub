// Server functions for roster management and rider entry linking.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const extraItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).max(999).default(1),
  size: z.string().trim().max(40).optional(),
  price: z.number().nonnegative().optional(),
});

// Accept "Jacket M x2; Buff x1" shorthand or a JSON array string, produce ExtraItem[].
export function parseExtras(raw: string | undefined | null): z.infer<typeof extraItemSchema>[] {

  const s = (raw ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      return z.array(extraItemSchema).parse(parsed);
    } catch {
      return [];
    }
  }
  return s
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.+?)(?:\s+([A-Z0-9]{1,4}))?\s*(?:[x×]\s*(\d+))?$/i);
      if (!m) return { name: part, qty: 1 } as z.infer<typeof extraItemSchema>;
      const [, name, size, qty] = m;
      return {
        name: name.trim(),
        qty: qty ? Number(qty) : 1,
        size: size ? size.trim() : undefined,
      };
    });
}

const rosterRowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  id_number: z.string().trim().min(4).max(50),
  phone: z.string().trim().max(40).optional().default(""),
  event_id: z.string().trim().min(1),
  // Fallback fields for auto-creating a stub event when event_id doesn't match.
  event_date: z.string().trim().max(40).optional().default(""),
  external_event_id: z.string().trim().max(80).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  batch: z.string().trim().max(80).optional().default(""),
  bib_number: z.string().trim().max(40).optional().default(""),
  jacket_size: z.string().trim().max(20).optional().default(""),
  tshirt_size: z.string().trim().max(20).optional().default(""),
  extras: z.string().max(2000).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  // Payment confirmation from Entry Ninja ("Yes"/"Paid"/"true" etc, plus amounts in rands).
  paid: z.string().trim().max(20).optional().default(""),
  amount_due: z.string().trim().max(20).optional().default(""),
  amount_paid: z.string().trim().max(20).optional().default(""),
});

export function parsePaidFlag(raw: string | undefined | null): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (["yes", "y", "true", "1", "paid", "complete", "completed"].includes(v)) return true;
  if (["no", "n", "false", "0", "unpaid", "outstanding", "pending"].includes(v)) return false;
  return null;
}

export function parseMoneyCents(raw: string | undefined | null): number | null {
  const v = (raw ?? "").replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const importSchema = z.object({
  rows: z.array(rosterRowSchema).min(1).max(5000),
});

export const importRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify admin
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { hashIdNumber, idNumberLast4 } = await import("./id-hash.server");

    // Build a case-insensitive event name -> UUID map so CSVs can use names
    const { data: events, error: eventsErr } = await context.supabase
      .from("events")
      .select("id, name");
    if (eventsErr) throw eventsErr;

    const eventByName = new Map<string, string>();
    for (const e of events ?? []) {
      if (e.name) eventByName.set(e.name.trim().toLowerCase(), e.id);
    }

    // Parse an Entry Ninja date like "2026/08/19" or "2026-08-19" → ISO.
    function parseEventDate(raw: string): string | null {
      const s = raw.trim();
      if (!s) return null;
      const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (m) {
        const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T08:00:00Z`;
        const d = new Date(iso);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    const autoCreatedEvents: { id: string; name: string }[] = [];

    async function resolveOrCreateEventId(
      raw: string,
      row: { event_date: string; external_event_id: string },
    ): Promise<{ id: string } | { error: string }> {
      const trimmed = raw.trim();
      const byName = eventByName.get(trimmed.toLowerCase());
      if (byName) return { id: byName };
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(trimmed)) return { id: trimmed };

      // Auto-create a stub event so the import doesn't fail. Admin gets an
      // alert to fill in the missing fields (logo, cover, description, etc.).
      const eventDate = parseEventDate(row.event_date) ?? new Date().toISOString();
      const insertPayload = {
        name: trimmed,
        discipline: "Cycling",
        event_date: eventDate,
        location: "TBC",
        distance_km: 0,
        status: "upcoming",
        lifecycle: "draft",
        schedule: [],
        classes: [],
        batches: [],
        days: [],
        social_links: {},
        auto_created: true,
        entry_ninja_id: row.external_event_id || null,
      };
      const { data: ins, error: insErr } = await context.supabase
        .from("events")
        .insert(insertPayload)
        .select("id, name")
        .single();
      if (insErr || !ins) return { error: `Could not auto-create event '${trimmed}': ${insErr?.message ?? "unknown"}` };
      eventByName.set(ins.name.trim().toLowerCase(), ins.id);
      autoCreatedEvents.push({ id: ins.id, name: ins.name });
      return { id: ins.id };
    }

    let created = 0;
    let updated = 0;
    let linkedToEvent = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const resolved = await resolveOrCreateEventId(r.event_id, {
          event_date: r.event_date,
          external_event_id: r.external_event_id,
        });
        if ("error" in resolved) {
          errors.push({ row: i + 1, error: resolved.error });
          continue;
        }

        const emailLower = r.email.toLowerCase();
        // Upsert entrant by email
        const { data: existing, error: findErr } = await context.supabase
          .from("entrants")
          .select("id")
          .ilike("email", emailLower)
          .maybeSingle();
        if (findErr) throw findErr;

        let entrantId: string;
        if (existing?.id) {
          entrantId = existing.id;
          await context.supabase
            .from("entrants")
            .update({
              full_name: r.full_name,
              id_number_hash: hashIdNumber(r.id_number),
              id_number_last4: idNumberLast4(r.id_number),
              phone: r.phone || null,
            })
            .eq("id", entrantId);
          updated++;
        } else {
          const { data: ins, error: insErr } = await context.supabase
            .from("entrants")
            .insert({
              full_name: r.full_name,
              email: emailLower,
              id_number_hash: hashIdNumber(r.id_number),
              id_number_last4: idNumberLast4(r.id_number),
              phone: r.phone || null,
            })
            .select("id")
            .single();
          if (insErr || !ins) throw insErr ?? new Error("insert failed");
          entrantId = ins.id;
          created++;
        }

        // Upsert event_entrants
        const parsedExtras = parseExtras(r.extras);
        const { error: eeErr } = await context.supabase
          .from("event_entrants")
          .upsert(
            {
              event_id: resolved.id,
              entrant_id: entrantId,
              category: r.category || null,
              batch: r.batch || null,
              bib_number: r.bib_number || null,
              jacket_size: r.jacket_size || null,
              tshirt_size: r.tshirt_size || null,
              extras: parsedExtras,
              notes: r.notes || null,
              paid: parsePaidFlag(r.paid),
              amount_due_cents: parseMoneyCents(r.amount_due),
              amount_paid_cents: parseMoneyCents(r.amount_paid),
            },
            { onConflict: "event_id,entrant_id" },
          );
        if (eeErr) throw eeErr;
        linkedToEvent++;
      } catch (err) {
        errors.push({ row: i + 1, error: (err as Error).message ?? "unknown" });
      }
    }

    return { created, updated, linkedToEvent, errors, autoCreatedEvents };
  });

const linkSchema = z.object({
  id_number: z.string().trim().min(4).max(50),
  surname: z.string().trim().max(80).optional().default(""),
});

export const linkMyEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => linkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { hashIdNumber } = await import("./id-hash.server");
    const { surnameMatches } = await import("./id-lookup.server");
    const { userId, supabase } = context;

    const email = (context.claims.email as string | undefined)?.toLowerCase() ?? null;
    const idHash = hashIdNumber(data.id_number);

    // Try email match first; fall back to ID-hash match so riders whose
    // login email differs from the roster email can still self-link.
    // Admin client is used only for the lookup — we still write the user_id
    // under RLS via the user's client below.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    type Match = {
      id: string;
      user_id: string | null;
      id_number_hash: string | null;
      email: string | null;
      full_name: string | null;
    };
    const cols = "id, user_id, id_number_hash, email, full_name";
    let match: Match | null = null;
    // The email on the signed-in account is itself a proof of identity, so an
    // email match doesn't need the surname second factor.
    let emailProven = false;
    if (email) {
      // Prefer an unlinked row; duplicate emails can exist across imports.
      const { data: byEmail } = await supabaseAdmin
        .from("entrants")
        .select(cols)
        .ilike("email", email)
        .order("user_id", { ascending: true, nullsFirst: true })
        .limit(1);
      if (byEmail?.[0]) {
        match = byEmail[0] as Match;
        emailProven = true;
      }
    }
    if (!match) {
      const { data: byId } = await supabaseAdmin
        .from("entrants")
        .select(cols)
        .eq("id_number_hash", idHash)
        .order("user_id", { ascending: true, nullsFirst: true })
        .limit(1);
      if (byId?.[0]) match = byId[0] as Match;
    }

    if (!match) return { ok: false as const, reason: "no_match" as const };
    if (!emailProven && match.id_number_hash && match.id_number_hash !== idHash) {
      return { ok: false as const, reason: "id_mismatch" as const };
    }
    // Claiming a roster row by ID number alone is a guessable path — require the
    // surname as a second factor unless the account email already matches.
    if (!emailProven && !surnameMatches(match.full_name, data.surname)) {
      return { ok: false as const, reason: "no_match" as const };
    }
    if (match.user_id && match.user_id !== userId) {
      return { ok: false as const, reason: "already_linked" as const };
    }

    // Write with admin client so RLS can't block the claim on a legacy row.
    // Riders imported without an email get theirs filled in from this sign-in.
    const { error: upErr } = await supabaseAdmin
      .from("entrants")
      .update({
        user_id: userId,
        id_number_hash: idHash,
        ...(!match.email && email ? { email } : {}),
      })
      .eq("id", match.id);
    if (upErr) throw upErr;

    // Ensure the signed-in user actually has SELECT visibility now.
    void supabase;
    return { ok: true as const, entrantId: match.id, emailAdded: !match.email && !!email };
  });


// Admin-only: create/update a single entrant and tag them to events in one call.
const quickAddSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  id_number: z.string().trim().min(4).max(50),
  phone: z.string().trim().max(40).optional().default(""),
  assignments: z
    .array(
      z.object({
        event_id: z.string().uuid(),
        category: z.string().trim().max(80).optional().default(""),
        batch: z.string().trim().max(80).optional().default(""),
        bib_number: z.string().trim().max(40).optional().default(""),
        jacket_size: z.string().trim().max(20).optional().default(""),
        tshirt_size: z.string().trim().max(20).optional().default(""),
        extras: z.string().max(2000).optional().default(""),
        notes: z.string().max(1000).optional().default(""),
      }),
    )
    .min(1)
    .max(50),
});

export const quickAddEntrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => quickAddSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { hashIdNumber, idNumberLast4 } = await import("./id-hash.server");
    const emailLower = data.email.toLowerCase();

    const { data: existing, error: findErr } = await context.supabase
      .from("entrants")
      .select("id")
      .ilike("email", emailLower)
      .maybeSingle();
    if (findErr) throw findErr;

    let entrantId: string;
    if (existing?.id) {
      entrantId = existing.id;
      const { error: upErr } = await context.supabase
        .from("entrants")
        .update({
          full_name: data.full_name,
          id_number_hash: hashIdNumber(data.id_number),
          id_number_last4: idNumberLast4(data.id_number),
          phone: data.phone || null,
        })
        .eq("id", entrantId);
      if (upErr) throw upErr;
    } else {
      const { data: ins, error: insErr } = await context.supabase
        .from("entrants")
        .insert({
          full_name: data.full_name,
          email: emailLower,
          id_number_hash: hashIdNumber(data.id_number),
          id_number_last4: idNumberLast4(data.id_number),
          phone: data.phone || null,
        })
        .select("id")
        .single();
      if (insErr || !ins) throw insErr ?? new Error("insert failed");
      entrantId = ins.id;
    }

    let linked = 0;
    for (const a of data.assignments) {
      const { error: eeErr } = await context.supabase
        .from("event_entrants")
        .upsert(
          {
            event_id: a.event_id,
            entrant_id: entrantId,
            category: a.category || null,
            batch: a.batch || null,
            bib_number: a.bib_number || null,
            jacket_size: a.jacket_size || null,
            tshirt_size: a.tshirt_size || null,
            extras: parseExtras(a.extras),
            notes: a.notes || null,
          },
          { onConflict: "event_id,entrant_id" },
        );
      if (!eeErr) linked++;
    }

    return { entrantId, linked };
  });


// Admin-only: remove an event assignment.
const unassignSchema = z.object({
  entrant_id: z.string().uuid(),
  event_id: z.string().uuid(),
});
export const unassignEntrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => unassignSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("event_entrants")
      .delete()
      .eq("entrant_id", data.entrant_id)
      .eq("event_id", data.event_id);
    if (error) throw error;
    return { ok: true as const };
  });

export const getMyEntrant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("entrants")
      .select("id, full_name, email, phone, user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

/**
 * Instant link on sign-in: attach every unlinked entrant whose roster email
 * matches the caller's account email. The sync job does this too, but only
 * runs a few times a day — this closes the gap for brand-new sign-ins.
 */
export const linkMyEntrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims.email as string | undefined)?.trim().toLowerCase();
    if (!email) return { linked: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("entrants")
      .update({ user_id: context.userId })
      .is("user_id", null)
      .ilike("email", email)
      .select("id");
    if (error) throw error;
    return { linked: data?.length ?? 0 };
  });

/**
 * Admin: entrants imported from Entry Ninja that no app account has claimed
 * yet — riders who never signed in, or signed in with a different email.
 */
export const listUnlinkedEntrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("entrants")
      .select("id, full_name, email, created_at, event_entrants(events(name, event_date))")
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;

    return (data ?? []).map((e) => {
      const rows = (e as unknown as {
        event_entrants: { events: { name: string | null; event_date: string | null } | null }[];
      }).event_entrants ?? [];
      const names = Array.from(
        new Set(rows.map((r) => r.events?.name).filter((n): n is string => Boolean(n))),
      );
      return {
        id: e.id,
        fullName: e.full_name,
        email: e.email,
        createdAt: e.created_at,
        events: names,
      };
    });
  });
