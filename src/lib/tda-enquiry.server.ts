import { everlyticRequest } from "./everlytic.server";
import { mayAddMembership } from "./entry-interest-audience";
import { isAllowedTdaOrigin, parseTdaEnquiry, shouldSyncToEverlytic, tdaCorsHeaders, tdaListIds, TDA_TEAM_EMAIL } from "./tda-enquiry";

async function sha(value: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Adds one contact to each list where it is missing. Never changes existing memberships or opt-outs. */
export async function syncContactToLists(email: string, lists: string[], username: string, apiKey: string) {
  async function lookup() {
    const raw = await everlyticRequest(`/api/2.0/contacts?filters[email]=${encodeURIComponent(email)}&count=25`, "GET", username, apiKey);
    return (raw.collection ?? []).map((item: { data?: Record<string, unknown> }) => item.data ?? item).find((c: Record<string, unknown>) => String(c.email).toLowerCase() === email);
  }
  let contact = await lookup();
  if (!contact) {
    await everlyticRequest("/api/2.0/contacts", "POST", username, apiKey, { contact_email: email, list_id: lists[0] });
    contact = await lookup();
  }
  if (!contact?.id) throw new Error("Could not verify mailing-list contact");
  async function membership(list: string) {
    try {
      return await everlyticRequest(`/api/2.0/list_subscriptions/${list}/${contact.id}`, "GET", username, apiKey);
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
      throw error;
    }
  }
  for (const list of lists) {
    const mapping = await membership(list);
    if (mayAddMembership(contact, mapping)) {
      await everlyticRequest(`/api/2.0/list_subscriptions/${list}`, "POST", username, apiKey, { contact_id: contact.id, email_status: "subscribed" });
      if (!(await membership(list))) throw new Error("Could not verify mailing-list membership");
    }
  }
}

/** Syncs one stored enquiry to Everlytic and records the outcome on the row. */
export async function syncEnquiryToEverlytic(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin.from("website_enquiries").select("id, email, consent").eq("id", id).maybeSingle();
  if (!row || !row.consent) return { synced: false };
  const username = process.env["EVERLYTIC_USERNAME"];
  const apiKey = process.env["EVERLYTIC_API_KEY"];
  try {
    if (!username || !apiKey) throw new Error("Everlytic is not connected");
    await syncContactToLists(row.email, tdaListIds(process.env["TDA_ENQUIRY_EVERLYTIC_LIST_IDS"]), username, apiKey);
    await supabaseAdmin.from("website_enquiries").update({ everlytic_synced: true, everlytic_error: null }).eq("id", id);
    return { synced: true };
  } catch (error) {
    await supabaseAdmin.from("website_enquiries").update({ everlytic_error: (error as Error).message.slice(0, 300) }).eq("id", id);
    return { synced: false };
  }
}

async function readFields(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  form.forEach((v, k) => { if (typeof v === "string") out[k] = v; });
  return out;
}

export async function handleTdaEnquiry(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const cors = tdaCorsHeaders(origin);
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
  if (!isAllowedTdaOrigin(origin)) return json({ ok: false, error: "This form only accepts enquiries from tourdeaddo.com." }, 403);

  let fields: Record<string, unknown>;
  try { fields = await readFields(request); } catch { return json({ ok: false, error: "Please check the form and try again." }, 400); }
  const parsed = parseTdaEnquiry(fields);
  if (parsed.kind === "honeypot") return json({ ok: true });
  if (parsed.kind === "invalid") return json({ ok: false, error: parsed.error }, 400);
  const e = parsed.enquiry;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const quota = async (scope: string, actor: string, limit: number, seconds: number) => {
    const { data, error } = await supabaseAdmin.rpc("consume_request_quota", { _scope: scope, _actor_hash: await sha(actor), _limit: limit, _window_seconds: seconds });
    return !error && data === true;
  };
  if (!(await quota("tda-enquiry-all", "all", 20, 60)) || !(await quota("tda-enquiry-email", e.email, 5, 3600))) {
    return json({ ok: false, error: "We've received a lot of messages. Please try again in a little while or call (041) 581 5335." }, 429);
  }

  const now = new Date().toISOString();
  const { data: row, error } = await supabaseAdmin.from("website_enquiries").insert({
    name: e.name, email: e.email, phone: e.phone, trip: e.trip, message: e.message,
    consent: e.consent, consent_at: e.consent ? now : null,
  }).select("id").single();
  if (error || !row) {
    console.error("tda-enquiry insert failed", error?.message);
    return json({ ok: false, error: "Something went wrong. Please try again or call (041) 581 5335." }, 500);
  }

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const data = { name: e.name, email: e.email, phone: e.phone, trip: e.trip, message: e.message, consent: e.consent, receivedAt: now };
  try {
    await sendTemplateEmail("tda-enquiry-notification", TDA_TEAM_EMAIL, { templateData: data, idempotencyKey: `tda-enquiry-notify-${row.id}`, replyTo: e.email });
    await supabaseAdmin.from("website_enquiries").update({ notified: true }).eq("id", row.id);
  } catch (err) { console.error("tda-enquiry team email failed", (err as Error).message); }
  try {
    const sent = await sendTemplateEmail("tda-enquiry-auto-reply", e.email, { templateData: data, idempotencyKey: `tda-enquiry-reply-${row.id}`, replyTo: TDA_TEAM_EMAIL });
    if (sent.sent) await supabaseAdmin.from("website_enquiries").update({ auto_replied: true }).eq("id", row.id);
  } catch (err) { console.error("tda-enquiry auto-reply failed", (err as Error).message); }

  if (shouldSyncToEverlytic(e)) {
    const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 10_000));
    const outcome = await Promise.race([syncEnquiryToEverlytic(row.id).catch(() => null), timeout]);
    if (outcome === "timeout") {
      await supabaseAdmin.from("website_enquiries").update({ everlytic_error: "Timed out. Use retry in Admin." }).eq("id", row.id).eq("everlytic_synced", false);
    }
  }
  return json({ ok: true });
}
