import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";

import { useSession } from "@/lib/auth";
import { isStandalone } from "@/lib/push-client";

const DISMISS_KEY = "rce.install-prompt-dismissed-at";
/** Re-invite riders to install once a day, never once they've installed. */
const SNOOZE_MS = 24 * 60 * 60 * 1000;

type BipEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIos() || /Android|Mobile/i.test(navigator.userAgent);
}

/**
 * Invites signed-in riders on a phone to install the Rider Hub.
 * Android/Chrome uses the native install prompt; iOS gets Add to Home Screen steps.
 */
export function InstallAppPrompt() {
  const { user, loading } = useSession();
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [deferred, setDeferred] = useState<BipEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    setMobile(isMobile());
    setIos(isIos());
    setInstalled(isStandalone());
    const at = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    setDismissed(Number.isFinite(at) && Date.now() - at < SNOOZE_MS);
    setReady(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BipEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    setShowIosSheet(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (ios || !deferred) {
      setShowIosSheet(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setInstalled(true);
  }

  if (loading || !user || !ready || !mobile || installed || dismissed) return null;

  return (
    <>
      <div
        className="fixed inset-x-0 z-30 mx-auto w-full max-w-md px-3 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-lg ring-1 ring-black/20">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
            <Download className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[13px] font-bold">Get the Rider Hub app</p>
            <p className="text-[11px] opacity-75">
              {ios ? "Add it to your home screen in 3 taps" : "Install for alerts & faster access"}
            </p>
          </div>
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-cherry px-3 py-1.5 text-xs font-bold text-white"
          >
            {ios ? "How to" : "Install"}
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/70 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showIosSheet ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:items-center md:justify-center">
          <div className="w-full rounded-t-3xl bg-card p-5 ring-1 ring-border md:max-w-sm md:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold text-ink">Add to your home screen</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {ios
                    ? "Safari on iPhone installs apps from the Share menu."
                    : "Use your browser menu to install the Rider Hub."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowIosSheet(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="mt-4 space-y-3">
              <li className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cherry text-xs font-bold text-white">
                  1
                </span>
                <p className="text-sm text-ink">
                  Tap the <Share className="mx-1 inline h-4 w-4 text-cherry" />
                  <span className="font-semibold">Share</span> button at the bottom of Safari.
                </p>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cherry text-xs font-bold text-white">
                  2
                </span>
                <p className="text-sm text-ink">
                  Scroll down and choose{" "}
                  <PlusSquare className="mx-1 inline h-4 w-4 text-cherry" />
                  <span className="font-semibold">Add to Home Screen</span>.
                </p>
              </li>
              <li className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cherry text-xs font-bold text-white">
                  3
                </span>
                <p className="text-sm text-ink">
                  Tap <span className="font-semibold">Add</span> — the Rider Hub icon appears on
                  your home screen, and you can turn on race-day alerts from your profile.
                </p>
              </li>
            </ol>

            <button
              type="button"
              onClick={dismiss}
              className="mt-4 w-full rounded-xl bg-ink py-2.5 text-sm font-bold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
