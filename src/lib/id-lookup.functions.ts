import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { maskEmail } from "./mask-email";

const lookupSchema = z.object({
  id_number: z.string().trim().min(6).max(50),
  surname: z.string().trim().min(2).max(80),
});

/**
 * Public: given an ID number AND the rider's surname, return masked versions of
 * the emails we have on file. Two factors, uniform failures, constant timing and
 * rate limiting so this can't be used to enumerate registrations.
 */
export const lookupEntryEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lookupSchema.parse(data))
  .handler(async ({ data }) => {
    const startedAt = Date.now();
    const { hashIdNumber } = await import("./id-hash.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { clientIpFrom, hashIp, isRateLimited, recordAttempt, surnameMatches, padTo } =
      await import("./id-lookup.server");

    const idHash = hashIdNumber(data.id_number);
    const ipHash = hashIp(clientIpFrom(getRequest().headers));

    const miss = async (outcome: "miss" | "blocked") => {
      await recordAttempt(supabaseAdmin as never, ipHash, idHash, outcome);
      await padTo(startedAt);
      return { found: false as const, needsEmail: false as const, emails: [] as string[] };
    };

    if (await isRateLimited(supabaseAdmin as never, ipHash, idHash)) {
      return miss("blocked");
    }

    const { data: rows, error } = await supabaseAdmin
      .from("entrants")
      .select("email, full_name")
      .eq("id_number_hash", idHash)
      .limit(10);

    if (error) throw error;

    // Second factor: the surname must match the roster name for this ID.
    const matched = (rows ?? []).filter((r) => surnameMatches(r.full_name, data.surname));
    if (matched.length === 0) return miss("miss");

    const emails = Array.from(
      new Set(
        matched
          .map((r) => (r.email ?? "").trim().toLowerCase())
          .filter((e) => e.includes("@")),
      ),
    ).map(maskEmail);

    await recordAttempt(supabaseAdmin as never, ipHash, idHash, "hit");
    await padTo(startedAt);

    if (emails.length === 0) {
      // An entry exists but has no email on file — sign up with any email and
      // link the entry with the ID number afterwards.
      return { found: false as const, needsEmail: true as const, emails: [] as string[] };
    }

    return { found: true as const, needsEmail: false as const, emails };
  });
