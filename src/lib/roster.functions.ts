// Server functions for roster management and rider entry linking.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const extraItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qty: z.number().int().min(1).max(999).default(1),
  size: z.string().trim().max(40).optional(),
  price: z.number().nonnegative().optional(),
});

// Accept "Jacket M x2; Buff x1" shorthand or a JSON array string, produce ExtraItem[].
function parseExtras(raw: string | undefined | null): z.infer<typeof extraItemSchema>[] {
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
  category: z.string().trim().max(80).optional().default(""),
  batch: z.string().trim().max(80).optional().default(""),
  bib_number: z.string().trim().max(40).optional().default(""),
  jacket_size: z.string().trim().max(20).optional().default(""),
  tshirt_size: z.string().trim().max(20).optional().default(""),
  extras: z.string().max(2000).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

const importSchema = z.object({
  rows: z.array(rosterRowSchema).min(1).max(5000),
});

export const importRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify admin
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
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

    function resolveEventId(raw: string): { id: string } | { error: string } {
      const trimmed = raw.trim();
      const byName = eventByName.get(trimmed.toLowerCase());
      if (byName) return { id: byName };
      // Accept raw UUIDs as-is
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(trimmed)) return { id: trimmed };
      return { error: `'${trimmed}' did not match any event name or UUID` };
    }

    let created = 0;
    let updated = 0;
    let linkedToEvent = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
        const resolved = resolveEventId(r.event_id);
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
            },
            { onConflict: "event_id,entrant_id" },
          );
        if (eeErr) throw eeErr;
        linkedToEvent++;
      } catch (err) {
        errors.push({ row: i + 1, error: (err as Error).message ?? "unknown" });
      }
    }

    return { created, updated, linkedToEvent, errors };
  });

const linkSchema = z.object({
  id_number: z.string().trim().min(4).max(50),
});

export const linkMyEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => linkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { hashIdNumber } = await import("./id-hash.server");
    const { userId, supabase } = context;

    const email = (context.claims.email as string | undefined)?.toLowerCase() ?? null;
    const idHash = hashIdNumber(data.id_number);

    // Try email match first; fall back to ID-hash match so riders whose
    // login email differs from the roster email can still self-link.
    // Admin client is used only for the lookup — we still write the user_id
    // under RLS via the user's client below.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let match: { id: string; user_id: string | null; id_number_hash: string | null } | null = null;
    if (email) {
      const { data: byEmail } = await supabaseAdmin
        .from("entrants")
        .select("id, user_id, id_number_hash")
        .ilike("email", email)
        .maybeSingle();
      if (byEmail) match = byEmail;
    }
    if (!match) {
      const { data: byId } = await supabaseAdmin
        .from("entrants")
        .select("id, user_id, id_number_hash")
        .eq("id_number_hash", idHash)
        .maybeSingle();
      if (byId) match = byId;
    }

    if (!match) return { ok: false as const, reason: "no_match" as const };
    if (match.id_number_hash && match.id_number_hash !== idHash) {
      return { ok: false as const, reason: "id_mismatch" as const };
    }
    if (match.user_id && match.user_id !== userId) {
      return { ok: false as const, reason: "already_linked" as const };
    }

    // Write with admin client so RLS can't block the claim on a legacy row.
    const { error: upErr } = await supabaseAdmin
      .from("entrants")
      .update({ user_id: userId, id_number_hash: idHash })
      .eq("id", match.id);
    if (upErr) throw upErr;

    // Ensure the signed-in user actually has SELECT visibility now.
    void supabase;
    return { ok: true as const, entrantId: match.id };
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
      }),
    )
    .min(1)
    .max(50),
});

export const quickAddEntrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => quickAddSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
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
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
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
