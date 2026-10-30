import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ email: z.string().email().max(200) });

/**
 * Tells the sign-in page whether a failed login was because the person has no
 * Rider Hub account yet (they only ever used Entry Ninja), and whether we can
 * see entries under that email so we can promise their events will link up.
 */
export const checkAccountExists = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async () => {
    // Uniform response prevents disclosure of accounts and registration emails.
    return { hasAccount: true, hasEntries: false };
  });
