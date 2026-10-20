import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { campaignCanSend, readEverlyticCampaigns } from "./everlytic-data";

export const manageEverlytic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ action: z.enum(["list", "lists", "preview", "send"]), campaignId: z.string().regex(/^\d+$/).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: role, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (error || !role) throw new Error("Admins only");
    const username = process.env['EVERLYTIC_USERNAME'];
    const apiKey = process.env['EVERLYTIC_API_KEY'];
    if (!username || !apiKey) throw new Error("Everlytic account details are not configured");
    const { everlyticRequest } = await import("./everlytic.server");
    if (data.action === "lists") {
      const lists = [];
      for (let page = 1; page <= 20; page++) {
        const raw = await everlyticRequest(`/api/2.0/lists?count=25&page=${page}`, "GET", username, apiKey);
        const collection = raw.collection ?? [];
        for (const item of collection) {
          const d = item.data ?? item;
          if (/bicycles/i.test(d.name ?? '')) lists.push({ id: String(d.id), name: String(d.name), active: Number(d.email_active_contacts ?? 0), lastSend: Number(d.last_send_date ?? 0) });
        }
        if (collection.length < 25) break;
      }
      return { campaigns: [], message: JSON.stringify(lists) };
    }
    if (data.action === "list") {
      const campaigns = readEverlyticCampaigns(await everlyticRequest("/api/2.0/emails?count=20&page=1", "GET", username, apiKey));
      return { campaigns, message: "Everlytic connected" };
    }
    if (!data.campaignId) throw new Error("Choose an Everlytic campaign");
    if (data.action === "preview") {
      await everlyticRequest(`/api/2.0/email_preview/${data.campaignId}/${encodeURIComponent("shaun@redcherryevents.co.za")}`, "POST", username, apiKey);
      return { campaigns: [], message: "Everlytic accepted the preview request for Shaun" };
    }
    const raw = await everlyticRequest(`/api/2.0/emails/${data.campaignId}`, "GET", username, apiKey);
    const campaign = readEverlyticCampaigns(Array.isArray(raw?.collection) ? raw : { collection: [{ data: raw?.data ?? raw }] }).find(c => c.id === data.campaignId);
    if (!campaign || !campaignCanSend(campaign)) throw new Error("Only a composing campaign with a subscriber list can be sent. Check it in Everlytic.");
    await everlyticRequest(`/api/2.0/email_actions/send/${data.campaignId}`, "POST", username, apiKey);
    return { campaigns: [], message: "Everlytic accepted the campaign send request" };
  });