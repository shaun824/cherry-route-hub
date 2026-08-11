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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM_EMAIL"] || "Red Cherry Rider Hub <noreply@redcherryevents.co.za>";

    if (apiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [FEEDBACK_TO],
            reply_to: email ?? undefined,
            subject: `Rider Hub feedback (${data.category})${data.name ? ` — ${data.name}` : ""}`,
            html: `
              <h2>New feedback from the Rider Hub</h2>
              <p><strong>Category:</strong> ${escapeHtml(data.category)}</p>
              <p><strong>From:</strong> ${escapeHtml(data.name || "Anonymous")} ${email ? `(${escapeHtml(email)})` : ""}</p>
              <p><strong>Page:</strong> ${escapeHtml(data.page_path || "unknown")}</p>
              <hr />
              <p style="white-space:pre-wrap">${escapeHtml(data.message)}</p>
              <p style="color:#888;font-size:12px">${escapeHtml(data.user_agent || "")}</p>
            `,
          }),
        });
        emailed = res.ok;
      } catch {
        emailed = false;
      }
    }

    return { ok: true as const, emailed };
  });
