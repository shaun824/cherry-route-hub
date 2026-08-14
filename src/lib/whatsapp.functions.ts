import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReplyInput = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

/**
 * Delivers an admin reply to a WhatsApp-channel thread over the Cloud API.
 * The message row itself is written by the admin inbox; this only sends.
 */
export const sendWhatsAppReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1);
    if (!roles?.length) throw new Error("Forbidden");

    const { data: thread, error } = await supabase
      .from("admin_qa_threads")
      .select("channel, wa_phone")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Thread not found");
    if (thread.channel !== "whatsapp" || !thread.wa_phone) {
      return { sent: false, reason: "not-whatsapp" as const };
    }

    const { whatsappConfigured, sendWhatsAppText } = await import("@/lib/whatsapp.server");
    if (!whatsappConfigured()) return { sent: false, reason: "not-configured" as const };

    await sendWhatsAppText(thread.wa_phone, data.body);
    return { sent: true, reason: null };
  });
