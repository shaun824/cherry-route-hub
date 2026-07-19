// Admin-editable content store.
// Seeds from mock-data, persists to localStorage. All public pages should read
// from these hooks so admin edits reflect immediately.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  events as seedEvents,
  feed as seedFeed,
  promos as seedPromos,
  type Event,
  type FeedPost,
  type Promo,
} from "./mock-data";

export type Sponsor = {
  id: string;
  name: string;
  tier: "Platinum" | "Gold" | "Silver" | "Bronze";
  logoText: string; // short logotype (used in the scroller)
  accent: string; // css color
  url?: string;
  active: boolean;
};

const seedSponsors: Sponsor[] = [
  { id: "sp_torq", name: "Torq Nutrition", tier: "Platinum", logoText: "TORQ", accent: "oklch(0.6 0.18 25)", url: "https://torq.example", active: true },
  { id: "sp_oakley", name: "Oakley SA", tier: "Gold", logoText: "OAKLEY", accent: "oklch(0.3 0.02 260)", url: "https://oakley.example", active: true },
  { id: "sp_ccs", name: "Cape Cycle Systems", tier: "Gold", logoText: "CCS", accent: "oklch(0.5 0.12 240)", active: true },
  { id: "sp_giant", name: "Giant Bicycles", tier: "Platinum", logoText: "GIANT", accent: "oklch(0.55 0.2 20)", active: true },
  { id: "sp_shimano", name: "Shimano", tier: "Gold", logoText: "SHIMANO", accent: "oklch(0.45 0.15 240)", active: true },
  { id: "sp_garmin", name: "Garmin", tier: "Silver", logoText: "GARMIN", accent: "oklch(0.35 0.05 240)", active: true },
  { id: "sp_castelli", name: "Castelli", tier: "Silver", logoText: "CASTELLI", accent: "oklch(0.5 0.2 25)", active: true },
  { id: "sp_maxxis", name: "Maxxis", tier: "Bronze", logoText: "MAXXIS", accent: "oklch(0.4 0.15 30)", active: true },
];

type AdminState = {
  events: Event[];
  feed: FeedPost[];
  promos: Promo[];
  sponsors: Sponsor[];

  // Events
  upsertEvent: (e: Event) => void;
  deleteEvent: (id: string) => void;

  // Feed
  upsertPost: (p: FeedPost) => void;
  deletePost: (id: string) => void;

  // Promos
  upsertPromo: (p: Promo) => void;
  deletePromo: (id: string) => void;

  // Sponsors
  upsertSponsor: (s: Sponsor) => void;
  deleteSponsor: (id: string) => void;

  resetAll: () => void;
};

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      events: seedEvents,
      feed: seedFeed,
      promos: seedPromos,
      sponsors: seedSponsors,

      upsertEvent: (e) =>
        set((s) => {
          const i = s.events.findIndex((x) => x.id === e.id);
          if (i === -1) return { events: [e, ...s.events] };
          const next = [...s.events];
          next[i] = e;
          return { events: next };
        }),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      upsertPost: (p) =>
        set((s) => {
          const i = s.feed.findIndex((x) => x.id === p.id);
          if (i === -1) return { feed: [p, ...s.feed] };
          const next = [...s.feed];
          next[i] = p;
          return { feed: next };
        }),
      deletePost: (id) => set((s) => ({ feed: s.feed.filter((p) => p.id !== id) })),

      upsertPromo: (p) =>
        set((s) => {
          const i = s.promos.findIndex((x) => x.id === p.id);
          if (i === -1) return { promos: [p, ...s.promos] };
          const next = [...s.promos];
          next[i] = p;
          return { promos: next };
        }),
      deletePromo: (id) => set((s) => ({ promos: s.promos.filter((p) => p.id !== id) })),

      upsertSponsor: (sp) =>
        set((s) => {
          const i = s.sponsors.findIndex((x) => x.id === sp.id);
          if (i === -1) return { sponsors: [sp, ...s.sponsors] };
          const next = [...s.sponsors];
          next[i] = sp;
          return { sponsors: next };
        }),
      deleteSponsor: (id) => set((s) => ({ sponsors: s.sponsors.filter((sp) => sp.id !== id) })),

      resetAll: () =>
        set({ events: seedEvents, feed: seedFeed, promos: seedPromos, sponsors: seedSponsors }),
    }),
    {
      name: "rce-admin-store-v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
      skipHydration: true,
    },
  ),
);

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
