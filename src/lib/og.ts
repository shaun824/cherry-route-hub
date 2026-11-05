// Share-preview (link thumbnail) helpers. Every page points og:image at the
// auto-generated /api/public/og image so WhatsApp, Facebook etc. show a
// readable branded card for that exact page.
export const OG_SITE = "https://riderhub.redcherryevents.co.za";

/** Thumbnail for an event page: event photo, bottom banner with page name + event logo. */
export function eventOgImageUrl(eventId: string, page: string): string {
  return `${OG_SITE}/api/public/og?e=${encodeURIComponent(eventId)}&p=${encodeURIComponent(page)}`;
}

/** Thumbnail for a general app page: photo, big heading, Red Cherry Events logo. */
export function appOgImageUrl(heading: string, sub?: string): string {
  const s = sub ? `&s=${encodeURIComponent(sub)}` : "";
  return `${OG_SITE}/api/public/og?p=${encodeURIComponent(heading)}${s}`;
}

export function ogImageMeta(url: string, alt: string) {
  return [
    { property: "og:image", content: url },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: url },
  ];
}

export const EVENT_TAB_LABELS: Record<string, string> = {
  info: "Event info",
  village: "Village map",
  routes: "Routes",
  results: "Results",
  news: "News",
  photos: "Photos",
  chat: "Event chat",
  ask: "Ask admin",
  packing: "Packing list",
  sponsors: "Sponsors",
  accommodation: "Accommodation",
  riders: "Riders",
  live: "Live tracking",
};

export function eventTabLabel(tab: unknown, fallback = "Event info"): string {
  return (typeof tab === "string" && EVENT_TAB_LABELS[tab]) || fallback;
}
