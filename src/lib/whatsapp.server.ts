// Server-only WhatsApp Cloud API helpers. Never import from client code.

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]);
}

/** Sends a free-form text message. Only valid inside the 24h customer window. */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneId) throw new Error("WhatsApp is not configured");

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    console.error(`[whatsapp] send failed [${res.status}]: ${errorBody}`);
    throw new Error(`WhatsApp send failed [${res.status}]: ${errorBody}`);
  }
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
