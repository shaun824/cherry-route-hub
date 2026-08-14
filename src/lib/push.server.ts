// Server-only Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) implemented with
// Web Crypto so it runs in the edge/worker runtime. Never import from the client.

const b64urlToBytes = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const enc = new TextEncoder();

export function vapidPublicKey(): string {
  return process.env["VAPID_PUBLIC_KEY"] ?? "";
}

function vapidPrivateJwk(): JsonWebKey {
  const pub = b64urlToBytes(vapidPublicKey());
  const d = process.env["VAPID_PRIVATE_KEY"] ?? "";
  if (!d || pub.length !== 65) throw new Error("VAPID keys are not configured");
  return {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d,
    ext: true,
  };
}

async function vapidAuthHeader(audience: string): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", vapidPrivateJwk(), { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: process.env["VAPID_SUBJECT"] || "mailto:team@redcherryevents.co.za",
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${vapidPublicKey()}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function encryptPayload(
  plaintext: string,
  p256dh: string,
  authSecret: string,
): Promise<Uint8Array> {
  const clientPub = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);

  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPub as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, ephemeral.privateKey, 256),
  );

  const prkInfo = concat(enc.encode("WebPush: info\0"), clientPub, asPublic);
  const ikm = await hkdf(auth, shared, prkInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const body = concat(enc.encode(plaintext), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, body as BufferSource),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([asPublic.length]), asPublic);
  return concat(header, ciphertext);
}

export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushResult = { ok: true } | { ok: false; status: number; gone: boolean; error: string };

/** Sends one encrypted push message. Never throws — returns a result. */
export async function sendWebPush(
  target: PushTarget,
  payload: Record<string, unknown>,
  opts: { ttl?: number; urgent?: boolean } = {},
): Promise<PushResult> {
  try {
    const url = new URL(target.endpoint);
    const authHeader = await vapidAuthHeader(url.origin);
    const bodyBytes = await encryptPayload(JSON.stringify(payload), target.p256dh, target.auth);

    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttl ?? (opts.urgent ? 3600 : 86400)),
        Urgency: opts.urgent ? "high" : "normal",
      },
      body: bodyBytes as BodyInit,
    });

    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: text.slice(0, 300) || `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      gone: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
