// Feature discovery for the home-page bell. Tracks (per device) which parts of
// the app a person has opened, and unlocks one more "try this" tip each day
// until every feature has been surfaced. Tips disappear once the page is used.
const VISITED_KEY = "rce.discover.visited";
const FIRST_SEEN_KEY = "rce.discover.first-seen";
const BELL_SEEN_KEY = "rce.bell.last-seen";

export type DiscoverTip = {
  id: string;
  title: string;
  body: string;
  to: string;
  /** pathname prefixes that count as "used" */
  match: string[];
  needsSignIn?: boolean;
};

// Ordered: the most useful features surface first.
export const DISCOVER_TIPS: DiscoverTip[] = [
  { id: "events-hub", title: "Your Events Hub", body: "Race info, schedule, packing list, routes and chat for every event you've entered.", to: "/my-events", match: ["/my-events"], needsSignIn: true },
  { id: "track", title: "Track riders live", body: "Follow friends and family on the live map during race day — star riders to keep them at the top.", to: "/spectate", match: ["/spectate"] },
  { id: "events", title: "Browse upcoming events", body: "See every Red Cherry event, the routes and what's included, then enter in a few taps.", to: "/events", match: ["/events"] },
  { id: "promos", title: "Sponsor deals", body: "Rider-only promo codes and offers from our event partners.", to: "/promos", match: ["/promos"] },
  { id: "profile", title: "Complete your profile", body: "Add your sizes, emergency contact and notification settings so race day runs smoothly.", to: "/profile", match: ["/profile"], needsSignIn: true },
  { id: "rewards", title: "Cherry Miles rewards", body: "Earn rewards for every event you ride and see what you can unlock.", to: "/rewards", match: ["/rewards"], needsSignIn: true },
  { id: "gallery", title: "Event photos", body: "Relive the weekend — browse photos from our events.", to: "/gallery", match: ["/gallery"] },
  { id: "feed", title: "All the latest news", body: "Race notices, weather alerts and event updates in one place.", to: "/feed", match: ["/feed"] },
];

const DAY = 24 * 60 * 60 * 1000;
const START_TIPS = 2;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function recordVisit(pathname: string) {
  if (typeof window === "undefined") return;
  const visited = new Set(readJson<string[]>(VISITED_KEY, []));
  let changed = false;
  for (const tip of DISCOVER_TIPS) {
    if (!visited.has(tip.id) && tip.match.some((m) => pathname.startsWith(m))) {
      visited.add(tip.id);
      changed = true;
    }
  }
  if (!window.localStorage.getItem(FIRST_SEEN_KEY)) {
    window.localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
  }
  if (changed) window.localStorage.setItem(VISITED_KEY, JSON.stringify([...visited]));
}

/** Tips to show today: unused features, one more unlocked per day. */
export function todaysTips(signedIn: boolean): DiscoverTip[] {
  if (typeof window === "undefined") return [];
  const first = Number(window.localStorage.getItem(FIRST_SEEN_KEY) ?? Date.now());
  const days = Math.max(0, Math.floor((Date.now() - first) / DAY));
  const visited = new Set(readJson<string[]>(VISITED_KEY, []));
  const eligible = DISCOVER_TIPS.filter((t) => signedIn || !t.needsSignIn);
  const unlocked = eligible.slice(0, START_TIPS + days);
  return unlocked.filter((t) => !visited.has(t.id));
}

export function bellLastSeen(): number {
  if (typeof window === "undefined") return Date.now();
  return Number(window.localStorage.getItem(BELL_SEEN_KEY) ?? 0);
}

export function markBellSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BELL_SEEN_KEY, String(Date.now()));
  window.localStorage.setItem(`${BELL_SEEN_KEY}.day`, new Date().toDateString());
}

export function bellSeenToday(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(`${BELL_SEEN_KEY}.day`) === new Date().toDateString();
}
