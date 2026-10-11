// First-visit walkthrough of the tracking page. Shown once per person (device + account),
// replayable from the link at the bottom of the tracking page.
import { useEffect, useState } from "react";
import { HeartPulse, MapPinned, Navigation, Star, Trophy, Users, Radio, X, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const KEY = "rc-tracking-tour-v1";
export const REPLAY_EVENT = "rc-tracking-tour-replay";
export const replayTrackingTutorial = () => window.dispatchEvent(new Event(REPLAY_EVENT));

const STEPS = [
  {
    icon: Radio,
    title: "Welcome to live tracking",
    body: "This is race-day HQ. Follow riders on the course, see who has finished, check results and keep yourself safe — all from one place. Tap through for a quick tour.",
  },
  {
    icon: Navigation,
    title: "Share your location (riders)",
    body: "Entered in the event? On the Live tab you'll see “You are entered”. Tap “Check my location”, then “Start tracking” about 30 minutes before your start. Add the Rider Hub to your home screen first so your phone keeps sending your position when the screen locks.",
  },
  {
    icon: HeartPulse,
    title: "SOS — help when you need it",
    body: "If something goes wrong, pick what happened (Medical, Mechanical, Lost…), add a short note, then hold the SOS button for 2 seconds. Race control and the medics get your exact position and your message straight away.",
  },
  {
    icon: Star,
    title: "Star your friends",
    body: "Open the Riders tab and tap the star next to anyone you want to follow. Starred riders stay at the top of the list and the results, and they're saved to your profile under “Riders you follow”.",
  },
  {
    icon: MapPinned,
    title: "Follow them on the map",
    body: "Tap “Track live” next to a starred rider and the map follows them around the course. Use the Day and route buttons to switch routes, and tap waterpoints or sponsor logos to open them in Google Maps.",
  },
  {
    icon: Users,
    title: "Find any rider",
    body: "Search by name or race number, filter by class, or sort by start times. Tap a rider to see their race number, start time for each day and their day-by-day results.",
  },
  {
    icon: Trophy,
    title: "Results & prize giving",
    body: "The Results tab fills in as times come off the timing system. Your starred riders show at the top with their place and time, and the podium appears here at prize giving.",
  },
  {
    icon: BellRing,
    title: "You're ready to ride",
    body: "That's it! You can replay this tour any time from the link at the bottom of the tracking page. Enjoy the race!",
  },
];

export function TrackingTutorial() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (user?.user_metadata?.tracking_tour_seen) seen = true;
    if (!seen) {
      setI(0);
      setOpen(true);
    }
  }, [user?.id]);

  useEffect(() => {
    const replay = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable */
    }
    if (user && !user.user_metadata?.tracking_tour_seen) {
      void supabase.auth.updateUser({ data: { tracking_tour_seen: true } });
    }
  };

  if (!open) return null;
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[9997] grid place-items-center bg-ink/60 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tracking tutorial"
      onClick={() => (last ? close() : setI(i + 1))}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-border animate-fade-in"
        key={i}
      >
        <button
          type="button"
          aria-label="Close tutorial"
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-ink-soft"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="bg-gradient-to-br from-cherry to-cherry-deep px-6 pb-6 pt-8 text-primary-foreground">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-background/15">
            <Icon className="h-7 w-7" />
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-widest opacity-80">
            Step {i + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold leading-tight">{step.title}</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-ink">{step.body}</p>
          <div className="mt-5 flex items-center gap-1.5">
            {STEPS.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-cherry" : "w-1.5 bg-border"}`} />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-2">
            {i > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setI(i - 1);
                }}
                className="text-sm font-semibold text-ink-soft"
              >
                Back
              </button>
            ) : (
              <span />
            )}
            <span className="rounded-full bg-cherry px-5 py-2 text-sm font-bold text-primary-foreground">
              {last ? "Let's go" : "Tap to continue"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
