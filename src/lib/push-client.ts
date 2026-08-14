// Browser-only Web Push helpers. Every function must be called from an event
// handler or useEffect — never during render or module evaluation.
import { getVapidPublicKey, removePushSubscription, savePushSubscription } from "./push.functions";

const SW_URL = "/push-sw.js";

export type PushState = "unsupported" | "needs-install" | "default" | "granted" | "denied";

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/** Lovable preview / iframe contexts can't hold a real push subscription. */
export function pushBlockedHere(): boolean {
  if (typeof window === "undefined") return true;
  if (window.top !== window.self) return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(window.location.search).get("sw") === "off"
  );
}

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  }
  if (isIos() && !isStandalone()) return "needs-install";
  return Notification.permission as PushState;
}

async function registerWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToB64url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Asks for permission, subscribes the device and stores it against the rider. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (pushBlockedHere()) return { ok: false, reason: "Open the published app (not the preview) to enable alerts." };
  const state = pushState();
  if (state === "unsupported") return { ok: false, reason: "This browser doesn't support notifications." };
  if (state === "needs-install") return { ok: false, reason: "Add the app to your home screen first." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "Notifications were blocked." };

  const { key } = await getVapidPublicKey();
  if (!key) return { ok: false, reason: "Notifications aren't configured yet." };

  const reg = await registerWorker();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: keyToB64url(sub.getKey("p256dh")),
      auth: keyToB64url(sub.getKey("auth")),
      userAgent: navigator.userAgent.slice(0, 400),
    },
  });

  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await removePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
}

export async function hasActiveSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}
