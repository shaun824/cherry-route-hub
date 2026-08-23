// Client-side read of an event's price book.
import { supabase } from "@/integrations/supabase/client";
import type { PriceRow } from "./entry-pricing";

export async function fetchPriceBook(eventId: string): Promise<PriceRow[]> {
  const { data, error } = await supabase
    .from("event_price_book")
    .select("id, event_id, kind, label, price_cents, notes")
    .eq("event_id", eventId)
    .order("kind")
    .order("label");
  if (error) {
    console.warn("[price-book]", error);
    return [];
  }
  return (data ?? []) as PriceRow[];
}
