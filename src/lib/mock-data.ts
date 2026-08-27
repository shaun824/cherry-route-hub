// Mock data — shaped to be replaced later by Entry Ninja / backend integrations.
// Every entity carries an `externalId` field for future sync.

export type BatchPrice = {
  id: string;
  label: string;       // e.g. "Early Bird", "Regular", "Late Entry"
  priceZAR: number;
  expiresAt?: string;  // ISO — after this, next tier applies. Empty on the final/regular tier.
};

export type Batch = {
  id: string;
  name: string;         // e.g. "A Bunch", "Wave 1", "Elite"
  startTime: string;    // "HH:MM" — race-day start time
  capacity?: number;    // optional cap
  description?: string; // optional note (e.g. "Seeded, licensed riders only")
  prices?: BatchPrice[]; // optional tiered pricing; overrides the class price when set
};

export type RouteTier = "Gold" | "Silver" | "Bronze" | "Custom";

export type CustomMarker = {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  color?: string;      // hex; falls back to the route colour
  logoUrl?: string;    // optional sponsor/partner logo shown instead of the icon glyph
  icon?: "pin" | "start" | "finish" | "aid" | "warning" | "photo" | "food" | "water";

};

export type EventRoute = {
  id: string;
  tier: RouteTier;
  name: string;            // e.g. "Gold — 120km Queen Stage"
  distanceKm: number;
  elevationM?: number;
  description?: string;
  gpxUrl?: string;
  mapEmbedUrl?: string;
  kmlUrls?: string[];      // one or more KML files layered on the interactive map
  color?: string;          // optional override for the polyline colour on the map
  customMarkers?: CustomMarker[]; // admin-added markers shown on the interactive map
};

export type EventDay = {
  id: string;
  date: string;            // ISO date (YYYY-MM-DD acceptable)
  label?: string;          // e.g. "Day 1 — Prologue"
  routes: EventRoute[];
};

export type ScheduleItem = {
  time: string;
  label: string;
  details?: string;        // optional longer description shown under the label
  dayId?: string;          // optional link to an EventDay
};

export type SocialLinks = {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  strava?: string;
};

export type Event = {
  id: string;
  externalId: string | null; // Entry Ninja event ID
  name: string;
  discipline: string;
  date: string; // ISO
  location: string;
  distanceKm: number;
  status: "open" | "closed" | "live" | "upcoming";
  lifecycle?: "draft" | "published" | "archived";
  heroColor: string;
  logoUrl?: string;    // event logo (square/transparent works best)
  coverUrl?: string;   // wide cover image shown behind the hero
  description: string;
  schedule: ScheduleItem[];
  mapQuery: string; // used for embed
  entered: boolean;
  classes?: EntryCategory[]; // admin-managed race classes / categories
  batches?: Batch[];         // admin-managed start batches / waves
  days?: EventDay[];         // multi-day itinerary with routes per day
  socialLinks?: SocialLinks; // per-event follow links
  spectatorMode?: boolean;   // when true, event unlocks on the public Spectate tab
  entryUrl?: string;         // external entry page (Entry Ninja / entries site) for this event
  websiteUrl?: string;       // official event website; assistant bot scans it for answers
  faqUrl?: string;           // optional dedicated FAQ page for the bot to prioritise
  photosAlbumUrl?: string;   // public Google Photos shared album link for this event's gallery

  spectatorParking?: string; // where spectators can park at the venue
  spectatorFood?: string;    // food / refreshments available at the venue
  spectatorNotes?: string;   // any extra spectator-only notes
  hasToilets?: boolean;      // toilets available on-site (default true)
  titleSponsorName?: string;    // headline / title sponsor for this event
  titleSponsorLogoUrl?: string; // logo shown on the event banner
  titleSponsorUrl?: string;     // sponsor website
};

// Returns the currently active price tier for a batch, or null if none defined.
export function activeBatchPrice(batch: Batch | undefined | null, now: Date = new Date()): BatchPrice | null {
  if (!batch?.prices || batch.prices.length === 0) return null;
  for (const p of batch.prices) {
    if (!p.expiresAt) return p; // untimed tier = active
    if (new Date(p.expiresAt).getTime() > now.getTime()) return p;
  }
  return batch.prices[batch.prices.length - 1];
}

export type FeedPost = {
  id: string;
  externalId: string | null;
  type: "news" | "notice" | "weather" | "update";
  title: string;
  body: string;
  author: string;
  postedAt: string; // ISO
  sourceUrl?: string; // link to the full article on the website

  eventId?: string;
  pinned?: boolean;
  order?: number; // admin-controlled manual sort (lower = higher in feed within its pinned group)
};

export type MediaPost = {
  id: string;
  eventId: string;
  caption: string;
  imagePrompt: string;
  imageUrl: string;
  postedAt: string;
  likes: number;
};

export type Promo = {
  id: string;
  brand: string;
  title: string;
  code: string;
  discount: string;
  expires: string;
  accent: string;
  logoUrl?: string;
  url?: string;
  /** Short description shown under the title. */
  blurb?: string;
  /** How to redeem, when there is no code. */
  redeem?: string;
  /** Comma-separated event-name keywords; blank = show on every event. */
  eventMatch?: string;
  active?: boolean;
  sortOrder?: number;
};

export type Rider = {
  id: string;
  entryNinjaUserId: string | null;
  name: string;
  handle: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  points: number;
  pointsToNext: number;
  nextTier: string;
  eventsCompleted: number;
  memberSince: string;
};

export const currentRider: Rider = {
  id: "rider_local_1",
  entryNinjaUserId: "en_usr_pending", // stub — populated on API sync
  name: "Alex Morgan",
  handle: "@alexm",
  tier: "Gold",
  points: 1840,
  pointsToNext: 660,
  nextTier: "Platinum",
  eventsCompleted: 14,
  memberSince: "2023",
};

export const events: Event[] = [
  {
    id: "evt_cherry_classic",
    externalId: "en_evt_00812",
    name: "Cherry Classic 100",
    discipline: "Road Cycling",
    date: "2026-08-02T06:30:00Z",
    location: "Stellenbosch, WC",
    distanceKm: 100,
    status: "open",
    heroColor: "from-[oklch(0.55_0.23_25)] to-[oklch(0.4_0.18_20)]",
    description:
      "A fast, rolling 100km road race through the Cape Winelands. Neutral start from Coetzenburg with three timed KOM sectors.",
    schedule: [
      { time: "05:30", label: "Registration & number collection" },
      { time: "06:30", label: "Neutral roll-out" },
      { time: "07:00", label: "KOM Sector 1 — Helshoogte" },
      { time: "10:30", label: "Estimated finish window" },
      { time: "12:00", label: "Prize giving" },
    ],
    mapQuery: "Coetzenburg Stadium Stellenbosch",
    entered: true,
  },
  {
    id: "evt_karoo_gravel",
    externalId: "en_evt_00815",
    name: "Karoo Gravel Grinder",
    discipline: "Gravel",
    date: "2026-09-14T05:45:00Z",
    location: "Prince Albert, WC",
    distanceKm: 165,
    status: "open",
    heroColor: "from-[oklch(0.5_0.14_60)] to-[oklch(0.35_0.1_40)]",
    description:
      "165km of pure Karoo gravel with two neutral water points. Self-sufficiency required between P2 and P3.",
    schedule: [
      { time: "05:00", label: "Race village opens" },
      { time: "05:45", label: "Mass start" },
      { time: "08:30", label: "Water point 1 — Prince Albert Road" },
      { time: "14:00", label: "Cut-off — P3" },
    ],
    mapQuery: "Prince Albert Karoo",
    entered: false,
  },
  {
    id: "evt_night_crit",
    externalId: "en_evt_00819",
    name: "Cherry Night Crit",
    discipline: "Criterium",
    date: "2026-07-25T18:00:00Z",
    location: "V&A Waterfront, CT",
    distanceKm: 30,
    status: "live",
    heroColor: "from-[oklch(0.45_0.18_15)] to-[oklch(0.28_0.12_20)]",
    description:
      "45-minute + 5 lap criterium under floodlights. Cat A, B and women's races back-to-back.",
    schedule: [
      { time: "17:15", label: "Course open for warm-up" },
      { time: "18:00", label: "Women's A + Men's C" },
      { time: "19:15", label: "Men's A + B" },
    ],
    mapQuery: "V&A Waterfront Cape Town",
    entered: true,
  },
  {
    id: "evt_mtb_shootout",
    externalId: "en_evt_00821",
    name: "Table Mountain MTB Shootout",
    discipline: "MTB",
    date: "2026-10-05T07:00:00Z",
    location: "Tokai Forest, CT",
    distanceKm: 65,
    status: "upcoming",
    heroColor: "from-[oklch(0.42_0.09_150)] to-[oklch(0.28_0.06_150)]",
    description:
      "Technical singletrack shootout with 1,800m of climbing. Full-suspension recommended.",
    schedule: [
      { time: "06:00", label: "Bike check-in" },
      { time: "07:00", label: "Elite wave start" },
      { time: "07:10", label: "General waves" },
    ],
    mapQuery: "Tokai Forest Cape Town",
    entered: false,
  },
];

// Real news is loaded from Lovable Cloud (feed_posts); no seeded sample posts.
export const feed: FeedPost[] = [];


export const media: MediaPost[] = [
  {
    id: "media_1",
    eventId: "evt_night_crit",
    caption: "Bell lap under the floodlights — Men's A. What a finish.",
    imagePrompt: "night criterium bike race under floodlights, red jerseys",
    imageUrl: "",
    postedAt: "2026-07-18T20:45:00Z",
    likes: 214,
  },
  {
    id: "media_2",
    eventId: "evt_night_crit",
    caption: "Women's A podium — congrats to all three.",
    imagePrompt: "women cyclists on race podium with red banner",
    imageUrl: "",
    postedAt: "2026-07-18T19:30:00Z",
    likes: 168,
  },
  {
    id: "media_3",
    eventId: "evt_cherry_classic",
    caption: "Recon ride through the Winelands ahead of Cherry Classic.",
    imagePrompt: "cyclists riding through vineyard road at sunrise",
    imageUrl: "",
    postedAt: "2026-07-15T07:15:00Z",
    likes: 92,
  },
];

// Rider offers are admin-managed in Lovable Cloud (public.promos) — no seed data.
export const promos: Promo[] = [];

// ─── Event entry / merchandise ──────────────────────────────────────────────
export type MerchItem = {
  id: string;
  name: string;
  description: string;
  priceZAR: number;
  sizes?: string[]; // if sized garment
  colors?: string[];
  image: string; // emoji / short label placeholder
  limited?: boolean;
};

export type EntryCategory = {
  id: string;
  label: string;
  distanceKm: number;
  priceZAR: number;
  description: string;
};

export type EventEntryConfig = {
  categories: EntryCategory[];
  jacketSizes: string[];
  tshirtSizes: string[];
  jacketIncluded: boolean;
  tshirtIncluded: boolean;
  merch: MerchItem[];
  cutOff: string; // ISO
  entryNinjaUrl: string;
};

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export const eventEntryConfig: Record<string, EventEntryConfig> = {
  evt_cherry_classic: {
    categories: [
      { id: "cat_100", label: "Cherry Classic 100", distanceKm: 100, priceZAR: 950, description: "Full route, 3 timed KOMs, seeded start pens." },
      { id: "cat_60", label: "Cherry 60 Social", distanceKm: 60, priceZAR: 650, description: "Shorter loop, single feed zone, mass start." },
      { id: "cat_junior", label: "Junior (U18)", distanceKm: 60, priceZAR: 350, description: "Junior category, licensed riders only." },
    ],
    jacketSizes: APPAREL_SIZES,
    tshirtSizes: APPAREL_SIZES,
    jacketIncluded: true,
    tshirtIncluded: true,
    cutOff: "2026-07-28T23:59:00Z",
    entryNinjaUrl: "https://entryninja.com/e/cherry-classic-100",
    merch: [
      { id: "m_jersey", name: "Race Jersey 2026", description: "Aero fit, Italian fabric, cherry red / carbon", priceZAR: 1450, sizes: APPAREL_SIZES, image: "🚴", limited: true },
      { id: "m_bibs", name: "Pro Bib Shorts", description: "Elastic interface pad, 6-hour rated", priceZAR: 1650, sizes: APPAREL_SIZES, image: "🩳" },
      { id: "m_socks", name: "Cherry Tall Socks", description: "15cm cuff, merino blend", priceZAR: 220, sizes: ["S/M", "L/XL"], image: "🧦" },
      { id: "m_cap", name: "Classic Cotton Cap", description: "One size, embroidered cherry", priceZAR: 250, image: "🧢" },
      { id: "m_bottle", name: "Insulated Bottle 600ml", description: "Purist Chrome, keeps cold 4h", priceZAR: 320, image: "🍶" },
      { id: "m_musette", name: "Finisher Musette", description: "Cotton canvas, race-day print", priceZAR: 180, image: "👜" },
    ],
  },
  evt_karoo_gravel: {
    categories: [
      { id: "cat_165", label: "Karoo 165", distanceKm: 165, priceZAR: 1250, description: "Full self-supported gravel epic." },
      { id: "cat_95", label: "Karoo 95", distanceKm: 95, priceZAR: 850, description: "Shorter route, still remote — bring spares." },
    ],
    jacketSizes: APPAREL_SIZES,
    tshirtSizes: APPAREL_SIZES,
    jacketIncluded: false,
    tshirtIncluded: true,
    cutOff: "2026-09-07T23:59:00Z",
    entryNinjaUrl: "https://entryninja.com/e/karoo-gravel",
    merch: [
      { id: "m_gravel_jersey", name: "Karoo Gravel Jersey", description: "Relaxed fit, dust-print colourway", priceZAR: 1350, sizes: APPAREL_SIZES, image: "🚵", limited: true },
      { id: "m_buff", name: "Dust Buff", description: "UPF50, breathable microfiber", priceZAR: 240, image: "🧣" },
      { id: "m_toolroll", name: "Frame Tool Roll", description: "Waxed canvas, 3-pocket", priceZAR: 480, image: "🧰" },
      { id: "m_bottle_gravel", name: "Karoo 750ml Bottle", description: "High-flow valve", priceZAR: 220, image: "🍶" },
    ],
  },
  evt_night_crit: {
    categories: [
      { id: "cat_a", label: "Men's A / Elite", distanceKm: 30, priceZAR: 400, description: "45min + 5 laps, UCI-style crit." },
      { id: "cat_b", label: "Men's B / C", distanceKm: 25, priceZAR: 350, description: "40min + 3 laps." },
      { id: "cat_women", label: "Women's A + Open", distanceKm: 25, priceZAR: 350, description: "40min + 3 laps, all levels welcome." },
    ],
    jacketSizes: APPAREL_SIZES,
    tshirtSizes: APPAREL_SIZES,
    jacketIncluded: false,
    tshirtIncluded: true,
    cutOff: "2026-07-24T18:00:00Z",
    entryNinjaUrl: "https://entryninja.com/e/cherry-night-crit",
    merch: [
      { id: "m_crit_tee", name: "Night Crit Tee", description: "Glow-print, 100% organic cotton", priceZAR: 380, sizes: APPAREL_SIZES, image: "👕" },
      { id: "m_hoodie", name: "Cherry Zip Hoodie", description: "Heavyweight, embroidered logo", priceZAR: 890, sizes: APPAREL_SIZES, image: "🧥" },
      { id: "m_cap_crit", name: "Reflective Cap", description: "3M piping, one size", priceZAR: 280, image: "🧢" },
    ],
  },
  evt_mtb_shootout: {
    categories: [
      { id: "cat_elite", label: "Elite / Sub-vet", distanceKm: 65, priceZAR: 780, description: "Seeded start, full timing splits." },
      { id: "cat_masters", label: "Masters 40+", distanceKm: 65, priceZAR: 780, description: "Own start pen, own podium." },
      { id: "cat_short", label: "Short Course", distanceKm: 35, priceZAR: 550, description: "Skips the technical black sectors." },
    ],
    jacketSizes: APPAREL_SIZES,
    tshirtSizes: APPAREL_SIZES,
    jacketIncluded: true,
    tshirtIncluded: false,
    cutOff: "2026-09-28T23:59:00Z",
    entryNinjaUrl: "https://entryninja.com/e/tm-mtb-shootout",
    merch: [
      { id: "m_mtb_jersey", name: "Trail Jersey", description: "Loose fit, back pocket, MTB cut", priceZAR: 1250, sizes: APPAREL_SIZES, image: "🚵" },
      { id: "m_gloves", name: "Trail Gloves", description: "Full finger, silicone grip", priceZAR: 420, sizes: ["S", "M", "L", "XL"], image: "🧤" },
      { id: "m_pack", name: "Hydration Pack 3L", description: "Fits 2 bottles + tools", priceZAR: 1450, image: "🎒", limited: true },
    ],
  },
};

export function getEntryConfig(eventId: string): EventEntryConfig | null {
  return eventEntryConfig[eventId] ?? null;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
