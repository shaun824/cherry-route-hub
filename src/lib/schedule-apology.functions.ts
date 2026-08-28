// Admin-only server functions for the schedule-correction apology mail.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const testSchema = z.object({
  eventId: z.string().uuid(),
  email: z.string().trim().email().optional(),
  category: z.string().trim().optional(),
});

/** Sends one preview copy of the apology mail to an admin. */
export const sendTestScheduleApology = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => testSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const to = (data.email || (context.claims as any)?.email || "").trim().toLowerCase();
    if (!to) throw new Error("No admin email address to send to");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendApologyTest } = await import("./schedule-apology.server");
    return sendApologyTest(supabaseAdmin, {
      eventId: data.eventId,
      to,
      category: data.category ?? null,
    });
  });

const batchSchema = z.object({
  eventId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).optional(),
  /** Restrict the send to these addresses (re-sends even if already apologised). */
  emails: z.array(z.string().trim().email()).max(200).optional(),
});

/** Sends the apology to every entered rider who hasn't had it yet. */
export const sendScheduleApologyBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => batchSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendScheduleApologies } = await import("./schedule-apology.server");
    return sendScheduleApologies(supabaseAdmin, {
      eventId: data.eventId,
      ...(data.limit ? { limit: data.limit } : {}),
      ...(data.emails?.length ? { emails: data.emails } : {}),
    });
  });
