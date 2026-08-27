// Server-only: records every app email we send so admins can re-open the exact
// message a rider received, and adds open/click tracking to the HTML.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function trackingBaseUrl(): string {
  return (
    process.env["PUBLIC_SITE_URL"] ??
    process.env["VITE_PUBLIC_SITE_URL"] ??
    "https://riderapp.redcherryevents.co.za"
  ).replace(/\/+$/, "");
}

/** Stores the rendered email and returns its id (null when storage fails). */
export async function recordEmailSend(input: {
  recipient: string;
  template: string;
  subject: string;
  html: string;
}): Promise<string | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("email_sends")
      .insert({
        recipient: input.recipient,
        template: input.template,
        subject: input.subject,
        html: input.html,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data?.id as string) ?? null;
  } catch (err) {
    console.error("[email-tracking] could not record send", err);
    return null;
  }
}

const SKIP_PROTOCOLS = /^(mailto:|tel:|sms:|#|\{)/i;

function decodeHref(rawUrl: string): string {
  // React Email correctly escapes query separators as &amp; in the HTML. The
  // tracking redirect must store the actual URL, otherwise Google receives a
  // parameter named "amp;destination" and opens Maps without the venue.
  return rawUrl
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"');
}

/** Rewrites links through the click tracker and appends an open pixel. */
export function instrumentEmailHtml(html: string, sendId: string): string {
  const base = trackingBaseUrl();

  const withLinks = html.replace(/href="([^"]+)"/gi, (match, rawUrl: string) => {
    const url = decodeHref(rawUrl.trim());
    if (SKIP_PROTOCOLS.test(url)) return match;
    if (!/^https?:\/\//i.test(url)) return match;
    if (url.includes("/api/public/e/")) return match;
    const tracked = `${base}/api/public/e/c/${sendId}?u=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });

  const pixel = `<img src="${base}/api/public/e/o/${sendId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
  return withLinks.includes("</body>")
    ? withLinks.replace("</body>", `${pixel}</body>`)
    : withLinks + pixel;
}

export async function markEmailSuppressed(sendId: string) {
  try {
    await (supabaseAdmin as any).from("email_sends").update({ suppressed: true }).eq("id", sendId);
  } catch (err) {
    console.error("[email-tracking] suppression flag failed", err);
  }
}
