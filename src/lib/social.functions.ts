import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Re-scrape the event websites for their latest Instagram content. Admins only. */
export const runSocialSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: role } = await (context as any).supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", (context as any).userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Admins only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncEventSocial, syncAllEventSocial } = await import("@/lib/social-scrape.server");

    if (data.eventId) {
      const { data: event, error } = await supabaseAdmin
        .from("events")
        .select("id, name, website_url, social_links")
        .eq("id", data.eventId)
        .maybeSingle();
      if (error || !event) throw new Error(error?.message ?? "Event not found");
      return { results: [await syncEventSocial(supabaseAdmin, event as any)] };
    }

    return { results: await syncAllEventSocial(supabaseAdmin) };
  });
