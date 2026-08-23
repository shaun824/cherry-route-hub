// Shared validation + guards for the content audit server functions.
import { z } from "zod";

export const auditActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("archive_event"), eventId: z.string().uuid(), label: z.string() }),
  z.object({
    kind: z.literal("set_event_distance"),
    eventId: z.string().uuid(),
    distanceKm: z.number(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("drop_orphan_schedule"),
    eventId: z.string().uuid(),
    dayId: z.string(),
    label: z.string(),
  }),
]);

export const approveFixSchema = z.object({
  issueKey: z.string().min(1),
  area: z.string().optional(),
  message: z.string().optional(),
  action: auditActionSchema,
});

export const dismissIssueSchema = z.object({
  issueKey: z.string().min(1),
  area: z.string().optional(),
  eventId: z.string().uuid().nullable().optional(),
  message: z.string().optional(),
});

export const issueKeySchema = z.object({ issueKey: z.string().min(1) });

/** Throws unless the calling user holds the admin role. */
export async function assertAuditAdmin(context: any) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admins only");
}
