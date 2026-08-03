// Site settings: admin-editable branding, quick links, and legal copy.
// Reads are public (anon SELECT). Writes require admin via RLS.
import { supabase } from "@/integrations/supabase/client";

export type QuickLinkIcon =
  | "Newspaper"
  | "MapPin"
  | "Image"
  | "Tag"
  | "Bell"
  | "Sparkles"
  | "ShieldCheck"
  | "Handshake"
  | "Trophy"
  | "Calendar";

export const QUICK_LINK_ICONS: QuickLinkIcon[] = [
  "Newspaper",
  "MapPin",
  "Image",
  "Tag",
  "Bell",
  "Sparkles",
  "ShieldCheck",
  "Handshake",
  "Trophy",
  "Calendar",
];

export type QuickLink = {
  id: string;
  label: string;
  to: string;
  icon: QuickLinkIcon;
  enabled: boolean;
};

export type Branding = {
  appName: string;
  tagline: string;
  welcomeMessage: string;
  eyebrow: string;
  // Optional platform-wide title sponsor shown on the home hero banner.
  titleSponsorName?: string;
  titleSponsorLogoUrl?: string;
  titleSponsorUrl?: string;
};

export type Waivers = {
  waiverText: string;
  termsText: string;
  waiverFullText: string;
  termsFullText: string;
};

export type Features = {
  // When false, the app hides in-app entry flows.
  // Entries currently happen on Entry Ninja; this app is the rider companion.
  entriesEnabled: boolean;
};

export type SiteSettings = {
  branding: Branding;
  quickLinks: QuickLink[];
  waivers: Waivers;
  features: Features;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  branding: {
    appName: "Red Cherry Events",
    tagline: "Rider Hub",
    welcomeMessage: "Welcome back,",
    eyebrow: "Red Cherry",
    titleSponsorName: "",
    titleSponsorLogoUrl: "",
    titleSponsorUrl: "",
  },
  quickLinks: [
    { id: "ql_news", label: "News", to: "/feed", icon: "Newspaper", enabled: true },
    { id: "ql_events", label: "Events", to: "/events", icon: "MapPin", enabled: true },
    { id: "ql_gallery", label: "Gallery", to: "/gallery", icon: "Image", enabled: true },
    { id: "ql_promos", label: "Promos", to: "/promos", icon: "Tag", enabled: true },
  ],
  waivers: {
    waiverText:
      "I accept the indemnity & liability waiver for this event and confirm I'm medically fit to ride.",
    termsText:
      "I agree to the Red Cherry Events terms and Entry Ninja processing of my data.",
    waiverFullText:
      "By entering this event, riders acknowledge the inherent risks of cycling and release Red Cherry Events, its partners, sponsors and volunteers from liability for any injury, loss or damage sustained during the event.",
    termsFullText:
      "Red Cherry Events processes your data solely to facilitate your entry, communications and race results, including sharing necessary details with Entry Ninja for entry management.",
  },
  features: {
    // Pivot: entries are handled on Entry Ninja for now.
    entriesEnabled: false,
  },
};

export async function fetchSettings(): Promise<Partial<SiteSettings> | null> {
  const { data, error } = await supabase.from("site_settings").select("key,value");
  if (error) {
    console.warn("[settings:fetch]", error);
    return null;
  }
  const out: Partial<SiteSettings> = {};
  for (const row of data ?? []) {
    const key = String((row as { key: string }).key);
    const value = (row as { value: unknown }).value;
    if (key === "branding") out.branding = value as Branding;
    else if (key === "quick_links") {
      const v = value as { items?: QuickLink[] };
      out.quickLinks = v.items ?? [];
    } else if (key === "waivers") out.waivers = value as Waivers;
    else if (key === "features") out.features = value as Features;
  }
  return out;
}

export async function saveBranding(b: Branding) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "branding", value: b as never });
  if (error) console.warn("[settings:saveBranding]", error);
  return !error;
}

export async function saveQuickLinks(items: QuickLink[]) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "quick_links", value: { items } as never });
  if (error) console.warn("[settings:saveQuickLinks]", error);
  return !error;
}

export async function saveWaivers(w: Waivers) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "waivers", value: w as never });
  if (error) console.warn("[settings:saveWaivers]", error);
  return !error;
}

export async function saveFeatures(f: Features) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "features", value: f as never });
  if (error) console.warn("[settings:saveFeatures]", error);
  return !error;
}
