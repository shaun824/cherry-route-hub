// Server-only: push to the iOS / Android store apps through Firebase Cloud
// Messaging (HTTP v1). Web Push for browsers stays in push.server.ts.
//
// Needs one secret: FIREBASE_SERVICE_ACCOUNT_JSON — the full JSON of a Firebase
// service account with the "Firebase Cloud Messaging API Admin" role.
// Without it every call is a quiet no-op, so the website is unaffected.
//
// Uses only fetch + WebCrypto, so it runs on the Cloudflare worker.

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string };

export type NativePushPayload = {
  title: string;
  body: string;
  url?: string | null;
  imageUrl?: string | null;
  urgent?: boolean;
  notificationId?: string | null;
  tag?: string | null;
};

export type NativePushTarget = { id: string; user_id: string; token: string; platform: string };

export type NativePushResult = { ok: boolean; gone?: boolean; error?: string };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

export function nativePushConfigured(): boolean {
  return serviceAccount() !== null;
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value;
  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function sendNativePush(target: { token: string }, payload: NativePushPayload): Promise<NativePushResult> {
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: "native push not configured" };
  try {
    const bearer = await accessToken(sa);
    const urgent = Boolean(payload.urgent);
    const data: Record<string, string> = { url: payload.url || "/" };
    if (payload.notificationId) data.notificationId = payload.notificationId;
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: target.token,
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
          },
          data,
          android: {
            priority: urgent ? "HIGH" : "NORMAL",
            notification: { sound: "default", ...(payload.tag ? { tag: payload.tag } : {}) },
          },
          apns: {
            headers: {
              "apns-priority": urgent ? "10" : "5",
              ...(payload.tag ? { "apns-collapse-id": payload.tag.slice(0, 64) } : {}),
            },
            payload: { aps: { sound: "default", ...(payload.imageUrl ? { "mutable-content": 1 } : {}) } },
          },
        },
      }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    const gone = res.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(text) ||
      (res.status === 400 && /INVALID_ARGUMENT/.test(text) && /token/i.test(text));
    return { ok: false, gone, error: `HTTP ${res.status} ${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200) };
  }
}

/**
 * Fan-out to store-app devices, mirroring the Web Push rules in
 * notifications.server.ts (audience + per-kind opt-outs; urgent ignores opt-outs).
 * Call it from dispatchNotification() after the Web Push loop:
 *
 *   const native = await dispatchNativePush(admin, { userIds, kind, urgent, skip: input.skipPush, payload: {...} });
 *   delivered += native.delivered; failed += native.failed;
 */
export async function dispatchNativePush(
  admin: any,
  opts: {
    userIds: string[] | null;
    kind: "news" | "event_reminder" | "safety" | "general";
    urgent: boolean;
    skip?: boolean;
    payload: NativePushPayload;
  },
): Promise<{ recipients: number; delivered: number; failed: number }> {
  const none = { recipients: 0, delivered: 0, failed: 0 };
  if (opts.skip || !nativePushConfigured()) return none;
  if (opts.userIds !== null && opts.userIds.length === 0) return none;

  let q = admin.from("native_push_tokens").select("id, user_id, token, platform");
  if (opts.userIds !== null) q = q.in("user_id", opts.userIds.slice(0, 1000));
  const { data, error } = await q;
  if (error) throw error;
  let targets = (data ?? []) as NativePushTarget[];

  const col = opts.kind === "news" ? "news" : opts.kind === "event_reminder" ? "event_reminders" : null;
  if (!opts.urgent && col && targets.length) {
    const users = Array.from(new Set(targets.map((t) => t.user_id)));
    const optedOut = new Set<string>();
    for (let i = 0; i < users.length; i += 500) {
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select(`user_id, ${col}`)
        .in("user_id", users.slice(i, i + 500));
      for (const p of prefs ?? []) if ((p as any)[col] === false) optedOut.add(p.user_id);
    }
    targets = targets.filter((t) => !optedOut.has(t.user_id));
  }

  let delivered = 0;
  let failed = 0;
  const dead: string[] = [];
  for (let i = 0; i < targets.length; i += 20) {
    const slice = targets.slice(i, i + 20);
    const results = await Promise.all(slice.map((t) => sendNativePush(t, opts.payload)));
    results.forEach((r, idx) => {
      if (r.ok) delivered += 1;
      else {
        failed += 1;
        if (r.gone) dead.push(slice[idx]!.id);
      }
    });
  }
  if (dead.length) await admin.from("native_push_tokens").delete().in("id", dead);
  return { recipients: targets.length, delivered, failed };
}
