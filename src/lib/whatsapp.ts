// Client-safe WhatsApp helpers (deep links + support number from site settings).
import { supabase } from "@/integrations/supabase/client";

export type SupportSettings = {
  whatsappEnabled: boolean;
  /** International format, digits only, e.g. 27821234567 */
  whatsappNumber: string;
  whatsappLabel: string;
};

export const DEFAULT_SUPPORT: SupportSettings = {
  whatsappEnabled: false,
  whatsappNumber: "",
  whatsappLabel: "Chat on WhatsApp",
};

/** Strips spaces, dashes and a leading + / 0 (SA local numbers become 27…). */
export function normalizeWaNumber(raw: string): string {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

export function waLink(number: string, message: string): string {
  const n = normalizeWaNumber(number);
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export async function fetchSupportSettings(): Promise<SupportSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "support")
    .maybeSingle();
  if (error || !data) return DEFAULT_SUPPORT;
  return { ...DEFAULT_SUPPORT, ...((data.value ?? {}) as Partial<SupportSettings>) };
}

export async function saveSupportSettings(s: SupportSettings) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "support", value: s as never });
  if (error) console.warn("[settings:saveSupport]", error);
  return !error;
}
