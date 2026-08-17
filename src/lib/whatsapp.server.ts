// Server-only WhatsApp Cloud API helpers. Never import from client code.

const GRAPH = "https://graph.facebook.com/v21.0";

/** Meta's free-form reply window after a rider's last inbound message. */
export const WA_WINDOW_MS = 24 * 60 * 60 * 1000;

export function whatsappConfigured(): boolean {
  return Boolean(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]);
}

/** What's wired up and what's still missing — powers the admin readiness panel. */
export function whatsappReadiness() {
  return {
    token: Boolean(process.env["WHATSAPP_TOKEN"]),
    phoneNumberId: Boolean(process.env["WHATSAPP_PHONE_NUMBER_ID"]),
    verifyToken: Boolean(process.env["WHATSAPP_VERIFY_TOKEN"]),
    appSecret: Boolean(process.env["WHATSAPP_APP_SECRET"]),
  };
}

export function normalizePhone(raw: string): string {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

async function callGraph(body: unknown): Promise<string> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneId) throw new Error("WhatsApp is not configured");

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(`[whatsapp] send failed [${res.status}]: ${errorBody}`);
    throw new Error(`WhatsApp send failed [${res.status}]: ${errorBody}`);
  }
  const json: any = await res.json().catch(() => ({}));
  return String(json?.messages?.[0]?.id ?? "");
}

/** Sends a free-form text message. Only valid inside the 24h customer window. */
export async function sendWhatsAppText(to: string, body: string): Promise<string> {
  return callGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    type: "text",
    text: { preview_url: false, body },
  });
}

/**
 * Sends an approved template — the only way to start a conversation outside
 * the 24h window. `variables` fill {{1}}, {{2}}… in the template body.
 */
export async function sendWhatsAppTemplate(
  to: string,
  name: string,
  language: string,
  variables: string[] = [],
): Promise<string> {
  return callGraph({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhone(to),
    type: "template",
    template: {
      name,
      language: { code: language || "en" },
      ...(variables.length
        ? {
            components: [
              {
                type: "body",
                parameters: variables.map((v) => ({ type: "text", text: String(v).slice(0, 900) })),
              },
            ],
          }
        : {}),
    },
  });
}

/** Phones that have sent STOP — never message these again. */
export async function loadOptOuts(admin: any, phones: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < phones.length; i += 500) {
    const { data } = await admin
      .from("whatsapp_opt_outs")
      .select("phone")
      .in("phone", phones.slice(i, i + 500));
    for (const r of data ?? []) out.add(String(r.phone));
  }
  return out;
}

/**
 * True when the rider messaged us within the last 24 hours, so a free-form
 * reply is allowed. Anything older needs an approved template.
 */
export async function waWindowOpen(admin: any, phone: string): Promise<boolean> {
  const at = await lastInboundAt(admin, phone);
  return Boolean(at && Date.now() - at.getTime() < WA_WINDOW_MS);
}

export async function lastInboundAt(admin: any, phone: string): Promise<Date | null> {
  const p = normalizePhone(phone);
  if (!p) return null;
  const { data: threads } = await admin
    .from("admin_qa_threads")
    .select("id")
    .eq("channel", "whatsapp")
    .eq("wa_phone", p);
  const ids = (threads ?? []).map((t: any) => t.id);
  if (!ids.length) return null;
  const { data: msg } = await admin
    .from("admin_qa_messages")
    .select("created_at")
    .in("thread_id", ids)
    .eq("is_admin_msg", false)
    .eq("is_bot", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return msg?.created_at ? new Date(msg.created_at) : null;
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body. */
export async function verifyMetaSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env["WHATSAPP_APP_SECRET"];
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
