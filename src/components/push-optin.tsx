import { useEffect, useState } from "react";
import { Bell, BellOff, Share, X } from "lucide-react";
import { toast } from "sonner";

import {
  disablePush,
  enablePush,
  hasActiveSubscription,
  isStandalone,
  pushBlockedHere,
  pushState,
  type PushState,
} from "@/lib/push-client";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "rce.push.dismissed";

/** Small inline card that invites a signed-in rider to turn on race-day alerts. */
export function PushOptIn({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSignedIn(Boolean(data.session));
      setState(pushState());
      setSubscribed(await hasActiveSubscription());
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!signedIn || state === null) return null;
  if (pushBlockedHere()) return null;
  if (state === "unsupported") return null;
  if (subscribed || state === "denied") return null;
  if (dismissed && !compact) return null;

  const needsInstall = state === "needs-install";

  async function turnOn() {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setSubscribed(true);
      toast.success("Race-day alerts are on");
    } else {
      toast.error(res.reason ?? "Couldn't turn on alerts");
    }
  }

  return (
    <div className="rounded-2xl border border-cherry/20 bg-cherry/5 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cherry text-white">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Get race-day alerts</p>
          {needsInstall ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              On iPhone, tap <Share className="inline h-3 w-3" /> <b>Share</b> then{" "}
              <b>Add to Home Screen</b>, open the Rider Hub from your home screen and turn alerts on there.
            </p>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Start-time changes, weather warnings, route updates and results — straight to your phone.
            </p>
          )}
          {!needsInstall && (
            <button
              onClick={() => void turnOn()}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Bell className="h-3.5 w-3.5" />
              {busy ? "Turning on…" : "Turn on alerts"}
            </button>
          )}
        </div>
        {!compact && (
          <button
            aria-label="Dismiss"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="text-ink-soft hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Toggle used on the profile page. */
export function PushToggle() {
  const [subscribed, setSubscribed] = useState(false);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setState(pushState());
      setSubscribed(await hasActiveSubscription());
    })();
  }, []);

  if (state === null) return null;

  const blocked = pushBlockedHere();

  async function toggle() {
    setBusy(true);
    if (subscribed) {
      await disablePush();
      setSubscribed(false);
      toast("Alerts turned off");
    } else {
      const res = await enablePush();
      if (res.ok) {
        setSubscribed(true);
        toast.success("Race-day alerts are on");
      } else {
        toast.error(res.reason ?? "Couldn't turn on alerts");
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Push notifications</p>
        <p className="text-xs text-ink-soft">
          {blocked
            ? "Open the published app on your phone to switch these on."
            : state === "needs-install"
              ? "Add the Rider Hub to your iPhone home screen first, then open it from there."
              : state === "denied"
                ? "Blocked in your browser settings — allow notifications for this site."
                : subscribed
                  ? "This device will receive alerts."
                  : "Turn on to get alerts on this device."}
        </p>
      </div>
      <button
        onClick={() => void toggle()}
        disabled={busy || blocked || state === "needs-install" || state === "denied"}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          subscribed ? "border border-border bg-background text-ink" : "bg-cherry text-white"
        }`}
      >
        {subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        {subscribed ? "Turn off" : "Turn on"}
      </button>
    </div>
  );
}

/** "Add to home screen" nudge for Android/desktop (uses beforeinstallprompt). */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || pushBlockedHere()) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setHidden(localStorage.getItem("rce.install.dismissed") === "1");
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || hidden) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <p className="min-w-0 flex-1 text-xs text-ink-soft">
        Install the Rider Hub for one-tap access and race-day alerts.
      </p>
      <button
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
        className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
      >
        Install
      </button>
      <button
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem("rce.install.dismissed", "1");
          setHidden(true);
        }}
        className="text-ink-soft"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
