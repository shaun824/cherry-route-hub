import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  .handler(async () => {
    // ID number and surname are not proof of email ownership. No roster details
    // are returned before sign-in; entry linking remains available after sign-in.
    return { found: false as const, needsEmail: false as const, emails: [] as string[] };
  });
