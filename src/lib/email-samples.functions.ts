// Admin-only: send the signed-in admin one copy of every email a rider or crew
// member can receive, built with the same data the live mailers use.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const schema = z.object({
  email: z.string().trim().email().optional(),
  /** Build the rider mails from this event; defaults to the next open event. */
  eventId: z.string().uuid().optional(),
});

export const sendAllEmailSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Admins only");
    const to = (data.email || (context.claims as any)?.email || "").trim().toLowerCase();
    if (!to) throw new Error("No admin email address to send to");
    const { sendEmailSamples } = await import("./email-samples.server");
    return sendEmailSamples({ to, eventId: data.eventId ?? null });
  });

export const sendScheduleEmailsForAllEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Admins only");
    const to = (data.email || (context.claims as any)?.email || "").trim().toLowerCase();
    if (!to) throw new Error("No admin email address to send to");
    const { sendScheduleSamplesForAllEvents } = await import("./email-samples.server");
    return sendScheduleSamplesForAllEvents({ to });
  });
