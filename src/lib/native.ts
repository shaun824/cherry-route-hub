// Native (App Store / Google Play) bridge for the Rider Hub.
//
// The store apps are a Capacitor shell that loads the live site, so this file
// is the only place the web code needs to know about it. On the website every
// export is a no-op: `isNativeApp()` is false and nothing is patched.
//
// What it does inside the store app:
//   • Live tracking keeps running with the screen locked. navigator.geolocation
//     .watchPosition is routed through @capacitor-community/background-geolocation,
//     so tracker-panel.tsx works unchanged. Background mode (Android's
//     "Live tracking" notification, iOS "Always" location) is only used while a
//     tracking session is active (the `rce-track-active-*` flag the tracker sets).
//   • Push notifications use Firebase Cloud Messaging instead of Web Push
//     (push-client.ts calls the helpers below).
//   • The "add to home screen" prompts are hidden — the app is already installed.
//   • Android back button navigates back instead of closing the app.
//
// Call `initNative()` once from the client (see __root.tsx). Browser-only.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

const TRACKING_FLAG_PREFIX = "rce-track-active-";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (!isNativeApp()) return "web";
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

let initialised = false;

export async function initNative(): Promise<void> {
  if (initialised || !isNativeApp()) return;
  initialised = true;
  markAsInstalledApp();
  installGeolocationBridge();
  await Promise.allSettled([setupStatusBar(), setupBackButton(), setupPushListeners()]);
}

// ---------------------------------------------------------------------------
// Installed-app detection

/** The web code checks display-mode / navigator.standalone to decide whether to
 *  nag riders to "Add to Home Screen". Inside the store app that's already true. */
function markAsInstalledApp() {
  try {
    Object.defineProperty(window.navigator, "standalone", { configurable: true, get: () => true });
  } catch {
    /* read-only on this platform — harmless */
  }
  const original = window.matchMedia?.bind(window);
  if (!original) return;
  window.matchMedia = ((query: string) => {
    if (/display-mode:\s*standalone/i.test(query)) {
      const noop = () => undefined;
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: noop,
        removeListener: noop,
        addEventListener: noop,
        removeEventListener: noop,
        dispatchEvent: () => false,
      } as MediaQueryList;
    }
    return original(query);
  }) as typeof window.matchMedia;
}

// ---------------------------------------------------------------------------
// Background location

function trackingSessionActive(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TRACKING_FLAG_PREFIX) && localStorage.getItem(key) === "1") return true;
    }
  } catch {
    /* storage unavailable */
  }
  return false;
}

function toPosition(loc: Location): GeolocationPosition {
  const coords = {
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy,
    altitude: loc.altitude,
    altitudeAccuracy: loc.altitudeAccuracy,
    heading: loc.bearing,
    speed: loc.speed,
  };
  const timestamp = loc.time ?? Date.now();
  return {
    coords: { ...coords, toJSON: () => coords },
    timestamp,
    toJSON: () => ({ coords, timestamp }),
  } as GeolocationPosition;
}

function toError(err: { code?: string; message?: string }): GeolocationPositionError {
  const denied = err.code === "NOT_AUTHORIZED";
  return {
    code: denied ? 1 : 2,
    message: denied ? "Location permission was not granted." : err.message || "Location unavailable.",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function installGeolocationBridge() {
  const geo = navigator.geolocation;
  if (!geo) return;

  let nextId = 1;
  const watchers = new Map<number, Promise<string | null>>();

  const addWatcher = (
    background: boolean,
    onPos: PositionCallback,
    onErr?: PositionErrorCallback | null,
  ): Promise<string | null> =>
    BackgroundGeolocation.addWatcher(
      {
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
        ...(background
          ? {
              backgroundTitle: "Rider Hub live tracking",
              backgroundMessage: "Sharing your position with race control. Stop tracking in the app to end it.",
            }
          : {}),
      },
      (loc, err) => {
        if (err) onErr?.(toError(err));
        else if (loc) onPos(toPosition(loc));
      },
    ).catch((e: unknown) => {
      onErr?.(toError({ message: e instanceof Error ? e.message : String(e) }));
      return null;
    });

  geo.watchPosition = (onPos, onErr) => {
    const id = nextId++;
    // The tracker sets its "active" flag in the same click handler, right after
    // starting the watch — wait a tick so we see it and pick background mode.
    watchers.set(
      id,
      new Promise<string | null>((resolve) => {
        setTimeout(() => resolve(addWatcher(trackingSessionActive(), onPos, onErr)), 0);
      }),
    );
    return id;
  };

  geo.clearWatch = (id) => {
    const pending = watchers.get(id);
    watchers.delete(id);
    void pending?.then((watcherId) => {
      if (watcherId) void BackgroundGeolocation.removeWatcher({ id: watcherId });
    });
  };

  // One-off fixes (start-area check, SOS) also go native so riders only ever
  // see the app's own permission prompt, not a second "website" prompt.
  geo.getCurrentPosition = (onPos, onErr, options) => {
    let done = false;
    let watcherId: string | null = null;
    const finish = () => {
      done = true;
      window.clearTimeout(timer);
      if (watcherId) void BackgroundGeolocation.removeWatcher({ id: watcherId });
    };
    const timeoutMs = options?.timeout && Number.isFinite(options.timeout) ? options.timeout : 20_000;
    const timer = window.setTimeout(() => {
      if (done) return;
      finish();
      onErr?.({ code: 3, message: "Location timed out.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    }, timeoutMs);
    void addWatcher(
      false,
      (pos) => {
        if (done) return;
        finish();
        onPos(pos);
      },
      (err) => {
        if (done) return;
        finish();
        onErr?.(err);
      },
    ).then((id) => {
      watcherId = id;
      if (done && id) void BackgroundGeolocation.removeWatcher({ id });
    });
  };
}

/** Opens the app's settings page (e.g. after location was denied). */
export async function openAppSettings(): Promise<void> {
  if (!isNativeApp()) return;
  await BackgroundGeolocation.openSettings();
}

// ---------------------------------------------------------------------------
// Status bar + Android back button

async function setupStatusBar() {
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  await StatusBar.setStyle({ style: Style.Light });
}

async function setupBackButton() {
  if (nativePlatform() !== "android") return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
}

// ---------------------------------------------------------------------------
// Push notifications (Firebase Cloud Messaging)

export type NativePushState = "default" | "granted" | "denied";

async function messaging() {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
  return FirebaseMessaging;
}

export async function nativePushState(): Promise<NativePushState> {
  const fm = await messaging();
  const { receive } = await fm.checkPermissions();
  return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "default";
}

async function saveToken(token: string) {
  const { saveNativePushToken } = await import("./native-push.functions");
  await saveNativePushToken({
    data: { token, platform: nativePlatform() === "ios" ? "ios" : "android", userAgent: navigator.userAgent.slice(0, 400) },
  });
}

export async function enableNativePush(): Promise<{ ok: boolean; reason?: string }> {
  const fm = await messaging();
  const { receive } = await fm.requestPermissions();
  if (receive !== "granted") {
    return { ok: false, reason: "Notifications are off for Rider Hub. Turn them on in your phone's Settings." };
  }
  const { token } = await fm.getToken();
  if (!token) return { ok: false, reason: "Couldn't register this phone for alerts. Try again in a moment." };
  await saveToken(token);
  try {
    localStorage.setItem("rce-native-push-token", token);
  } catch {
    /* ignore */
  }
  return { ok: true };
}

export async function disableNativePush(): Promise<void> {
  const fm = await messaging();
  let token: string | null = null;
  try {
    token = localStorage.getItem("rce-native-push-token");
    localStorage.removeItem("rce-native-push-token");
  } catch {
    /* ignore */
  }
  if (token) {
    const { removeNativePushToken } = await import("./native-push.functions");
    await removeNativePushToken({ data: { token } }).catch(() => undefined);
  }
  await fm.deleteToken().catch(() => undefined);
}

export async function hasNativePushToken(): Promise<boolean> {
  try {
    return Boolean(localStorage.getItem("rce-native-push-token")) && (await nativePushState()) === "granted";
  } catch {
    return false;
  }
}

async function setupPushListeners() {
  const fm = await messaging();
  // FCM rotates tokens now and then — keep the server copy current.
  await fm.addListener("tokenReceived", ({ token }) => {
    let previous: string | null = null;
    try {
      previous = localStorage.getItem("rce-native-push-token");
    } catch {
      /* ignore */
    }
    if (!previous || previous === token) return; // only refresh tokens the rider opted in with
    try {
      localStorage.setItem("rce-native-push-token", token);
    } catch {
      /* ignore */
    }
    void saveToken(token).catch(() => undefined);
  });
  // Tapping a notification opens the page it points at.
  await fm.addListener("notificationActionPerformed", ({ notification }) => {
    const data = (notification.data ?? {}) as Record<string, unknown>;
    const url = typeof data.url === "string" ? data.url : null;
    if (!url) return;
    try {
      const target = new URL(url, window.location.origin);
      if (target.origin === window.location.origin) window.location.assign(target.pathname + target.search + target.hash);
    } catch {
      /* bad url — ignore */
    }
  });
}
