// Admin-editable content store.
// Events are in-memory (seeded from mock-data). Feed / promos / sponsors are
// hydrated from Lovable Cloud on mount (see use-hydrated-store.ts) and mutations
// fire cloud writes; RLS blocks non-admins.
import { create } from "zustand";
import {
  events as seedEvents,
  feed as seedFeed,
  promos as seedPromos,
  type Event,
  type FeedPost,
  type Promo,
} from "./mock-data";
import {
  upsertFeedCloud, deleteFeedCloud,
  upsertPromoCloud, deletePromoCloud,
  upsertSponsorCloud, deleteSponsorCloud,
} from "./cloud";
import { DEFAULT_SETTINGS, type SiteSettings } from "./settings";

export type Sponsor = {
  id: string;
  name: string;
  tier: "Platinum" | "Gold" | "Silver" | "Bronze";
  logoText: string;
  logoUrl?: string;
  accent: string;
  url?: string;
  active: boolean;
};

const seedSponsors: Sponsor[] = [
  { id: "sp_torq", name: "Torq Nutrition", tier: "Platinum", logoText: "TORQ", accent: "oklch(0.6 0.18 25)", url: "https://torq.example", active: true },
  { id: "sp_oakley", name: "Oakley SA", tier: "Gold", logoText: "OAKLEY", accent: "oklch(0.3 0.02 260)", url: "https://oakley.example", active: true },
  { id: "sp_ccs", name: "Cape Cycle Systems", tier: "Gold", logoText: "CCS", accent: "oklch(0.5 0.12 240)", active: true },
  { id: "sp_giant", name: "Giant Bicycles", tier: "Platinum", logoText: "GIANT", accent: "oklch(0.55 0.2 20)", active: true },
];

type AdminState = {
  events: Event[];
  feed: FeedPost[];
  promos: Promo[];
  sponsors: Sponsor[];
  settings: SiteSettings;

  upsertEvent: (e: Event) => void;
  deleteEvent: (id: string) => void;

  upsertPost: (p: FeedPost) => void;
  deletePost: (id: string) => void;

  upsertPromo: (p: Promo) => void;
  deletePromo: (id: string) => void;

  upsertSponsor: (s: Sponsor) => void;
  deleteSponsor: (id: string) => void;

  setSettings: (s: Partial<SiteSettings>) => void;

  resetLocal: () => void;
};

export const useAdminStore = create<AdminState>()((set) => ({
  events: seedEvents,
  feed: seedFeed,
  promos: seedPromos,
  sponsors: seedSponsors,
  settings: DEFAULT_SETTINGS,

  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  upsertEvent: (e) =>
    set((s) => {
      const i = s.events.findIndex((x) => x.id === e.id);
      if (i === -1) return { events: [e, ...s.events] };
      const next = [...s.events];
      next[i] = e;
      return { events: next };
    }),
  deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

  upsertPost: (p) => {
    set((s) => {
      const i = s.feed.findIndex((x) => x.id === p.id);
      if (i === -1) return { feed: [p, ...s.feed] };
      const next = [...s.feed]; next[i] = p;
      return { feed: next };
    });
    void upsertFeedCloud(p);
  },
  deletePost: (id) => {
    set((s) => ({ feed: s.feed.filter((p) => p.id !== id) }));
    void deleteFeedCloud(id);
  },

  upsertPromo: (p) => {
    set((s) => {
      const i = s.promos.findIndex((x) => x.id === p.id);
      if (i === -1) return { promos: [p, ...s.promos] };
      const next = [...s.promos]; next[i] = p;
      return { promos: next };
    });
    void upsertPromoCloud(p);
  },
  deletePromo: (id) => {
    set((s) => ({ promos: s.promos.filter((p) => p.id !== id) }));
    void deletePromoCloud(id);
  },

  upsertSponsor: (sp) => {
    set((s) => {
      const i = s.sponsors.findIndex((x) => x.id === sp.id);
      if (i === -1) return { sponsors: [sp, ...s.sponsors] };
      const next = [...s.sponsors]; next[i] = sp;
      return { sponsors: next };
    });
    void upsertSponsorCloud(sp);
  },
  deleteSponsor: (id) => {
    set((s) => ({ sponsors: s.sponsors.filter((sp) => sp.id !== id) }));
    void deleteSponsorCloud(id);
  },

  resetLocal: () =>
    set({ events: seedEvents, feed: seedFeed, promos: seedPromos, sponsors: seedSponsors, settings: DEFAULT_SETTINGS }),
}));

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

