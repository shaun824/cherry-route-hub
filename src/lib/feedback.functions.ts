import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FEEDBACK_TO = "team@redcherryevents.co.za";

const feedbackSchema = z.object({
  message: z.string().trim().min(5).max(4000),
  category: z.enum(["issue", "question", "suggestion", "other"]).default("issue"),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  page_path: z.string().trim().max(300).optional(),
  user_agent: z.string().trim().max(400).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => feedbackSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email ? data.email.toLowerCase() : null;

    const { error } = await supabaseAdmin.from("feedback").insert({
      message: data.message,
      category: data.category,
      name: data.name || null,
      email,
      page_path: data.page_path || null,
      user_agent: data.user_agent || null,
    });
    if (error) throw error;

    let emailed = false;
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const result = await sendTemplateEmail("feedback-notification", FEEDBACK_TO, {
        templateData: {
          category: data.category,
          name: data.name || "",
          fromEmail: email || "",
          pagePath: data.page_path || "",
          message: data.message,
          userAgent: data.user_agent || "",
        },
        ...(email ? { replyTo: email } : {}),
      });
      emailed = result.sent;
    } catch (err) {
      console.error("feedback email failed", err);
      emailed = false;
    }

    return { ok: true as const, emailed };
  });
