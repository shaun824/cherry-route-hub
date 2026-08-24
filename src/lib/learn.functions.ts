import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "@/lib/is-admin";

const schema = z.object({
  kind: z.enum(["business", "event", "department"]),
  eventId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});

/** Admin: (re)build a training course from the app's live event data. */
export const generateLearnCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Forbidden");
    const mod = await import("@/lib/learn.server");
    const client = context.supabase as never;

    if (data.kind === "business") return mod.generateBusinessCourse(client);
    if (data.kind === "event") {
      if (!data.eventId) throw new Error("Pick an event first.");
      return mod.generateEventCourse(client, data.eventId);
    }
    if (!data.departmentId) throw new Error("Pick a department first.");
    return mod.generateDepartmentCourse(client, data.departmentId);
  });
