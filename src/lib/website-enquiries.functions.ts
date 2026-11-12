import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admins only");
}

export const listWebsiteEnquiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { unsyncedOnly?: boolean }) => ({ unsyncedOnly: !!input?.unsyncedOnly }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    let q = (context as any).supabase
      .from("website_enquiries")
      .select("id, event_key, name, email, phone, trip, message, consent, consent_at, everlytic_synced, everlytic_error, notified, auto_replied, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.unsyncedOnly) q = q.eq("consent", true).eq("everlytic_synced", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { enquiries: rows ?? [] };
  });

export const retryEnquiryEverlytic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.id ?? "")) throw new Error("Invalid enquiry");
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { syncEnquiryToEverlytic } = await import("./tda-enquiry.server");
    return syncEnquiryToEverlytic(data.id);
  });
