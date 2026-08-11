import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { maskEmail } from "./mask-email";

const lookupSchema = z.object({
  id_number: z.string().trim().min(6).max(50),
});

// Public: given a full ID number, return masked versions of the emails we
// have on file for that rider. Never returns the raw email or any other field.
export const lookupEntryEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lookupSchema.parse(data))
  .handler(async ({ data }) => {
    const { hashIdNumber } = await import("./id-hash.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const idHash = hashIdNumber(data.id_number);
    const { data: rows, error } = await supabaseAdmin
      .from("entrants")
      .select("email")
      .eq("id_number_hash", idHash)
      .limit(10);

    if (error) throw error;

    const emails = Array.from(
      new Set(
        (rows ?? [])
          .map((r) => (r.email ?? "").trim().toLowerCase())
          .filter((e) => e.includes("@")),
      ),
    ).map(maskEmail);

    if (emails.length === 0) {
      // Slow down bulk guessing on misses.
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { found: false as const, emails: [] as string[] };
    }

    return { found: true as const, emails };
  });
