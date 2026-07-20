// Server functions for roster management and rider entry linking.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rosterRowSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(255),
  id_number: z.string().trim().min(4).max(50),
  phone: z.string().trim().max(40).optional().default(""),
  event_id: z.string().trim().min(1),
  category: z.string().trim().max(80).optional().default(""),
  batch: z.string().trim().max(80).optional().default(""),
  bib_number: z.string().trim().max(40).optional().default(""),
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

    let created = 0;
    let updated = 0;
    let linkedToEvent = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i];
      try {
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
        const { error: eeErr } = await context.supabase
          .from("event_entrants")
          .upsert(
            {
              event_id: r.event_id,
              entrant_id: entrantId,
              category: r.category || null,
              batch: r.batch || null,
              bib_number: r.bib_number || null,
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

    // Look up the authenticated user's email from claims
    const email = (context.claims.email as string | undefined)?.toLowerCase();
    if (!email) throw new Error("Your account has no email address.");

    const idHash = hashIdNumber(data.id_number);

    const { data: match, error: findErr } = await supabase
      .from("entrants")
      .select("id, user_id, id_number_hash")
      .ilike("email", email)
      .maybeSingle();
    if (findErr) throw findErr;

    if (!match) {
      return { ok: false as const, reason: "no_match" as const };
    }
    if (match.id_number_hash && match.id_number_hash !== idHash) {
      return { ok: false as const, reason: "id_mismatch" as const };
    }
    if (match.user_id && match.user_id !== userId) {
      return { ok: false as const, reason: "already_linked" as const };
    }

    const { error: upErr } = await supabase
      .from("entrants")
      .update({ user_id: userId })
      .eq("id", match.id);
    if (upErr) throw upErr;

    return { ok: true as const, entrantId: match.id };
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
