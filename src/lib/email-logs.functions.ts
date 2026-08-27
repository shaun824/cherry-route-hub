// Admin-only: email delivery log + template preview.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";
import type { EmailLogResult, EmailTemplateInfo } from "./email-logs.server";

export type { EmailLogRow, EmailLogResult, EmailTemplateInfo } from "./email-logs.server";

export const listEmailDeliveryLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient?: string; eventType?: string; since?: string; limit?: number }) => input)
  .handler(async ({ data, context }): Promise<EmailLogResult> => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { fetchEmailLogs } = await import("./email-logs.server");
    return fetchEmailLogs(data ?? {});
  });

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailTemplateInfo[]> => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { listTemplates } = await import("./email-logs.server");
    return listTemplates();
  });

export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data, context }): Promise<{ html: string; subject: string }> => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { renderTemplateHtml } = await import("./email-logs.server");
    return renderTemplateHtml(data.name);
  });

export type { SentEmailRow, SentEmailDetail } from "./email-logs.server";

export const listSentEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient?: string; template?: string; limit?: number }) => input ?? {})
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { fetchSentEmails } = await import("./email-logs.server");
    return fetchSentEmails(data ?? {});
  });

export const getSentEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { fetchSentEmail } = await import("./email-logs.server");
    return fetchSentEmail(data.id);
  });
