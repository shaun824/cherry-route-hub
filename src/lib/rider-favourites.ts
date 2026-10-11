// Starred riders: saved to the account when signed in (follows you across devices),
// otherwise kept on this device. Local stars are copied up the first time you sign in.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export type FavRider = {
  event_entrant_id: string;
  full_name: string;
  bib_number: string | null;
  category: string | null;
};

const localKey = (eventId: string) => `rc-starred:${eventId}`;
const readLocal = (eventId: string): FavRider[] => {
  try {
    return JSON.parse(localStorage.getItem(localKey(eventId)) ?? "[]");
  } catch {
    return [];
  }
};
const writeLocal = (eventId: string, list: FavRider[]) => {
  try {
    localStorage.setItem(localKey(eventId), JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
};

export function useRiderFavourites(eventId: string) {
  const { user } = useSession();
  const [list, setList] = useState<FavRider[]>([]);

  useEffect(() => {
    let alive = true;
    const local = readLocal(eventId);
    if (!user) {
      setList(local);
      return;
    }
    (async () => {
      if (local.length) {
        await supabase
          .from("rider_favourites")
          .upsert(local.map((f) => ({ ...f, user_id: user.id, event_id: eventId })), { onConflict: "user_id,event_entrant_id", ignoreDuplicates: true });
      }
      const { data } = await supabase
        .from("rider_favourites")
        .select("event_entrant_id, full_name, bib_number, category")
        .eq("event_id", eventId)
        .order("created_at");
      if (!alive) return;
      const remote = (data ?? []) as FavRider[];
      setList(remote);
      writeLocal(eventId, remote);
    })();
    return () => {
      alive = false;
    };
  }, [eventId, user?.id]);

  const isFav = useCallback((id: string) => list.some((f) => f.event_entrant_id === id), [list]);

  const toggle = useCallback(
    async (r: FavRider) => {
      const on = list.some((f) => f.event_entrant_id === r.event_entrant_id);
      const next = on ? list.filter((f) => f.event_entrant_id !== r.event_entrant_id) : [...list, r];
      setList(next);
      writeLocal(eventId, next);
      if (!user) return;
      if (on) {
        await supabase.from("rider_favourites").delete().eq("user_id", user.id).eq("event_entrant_id", r.event_entrant_id);
      } else {
        await supabase.from("rider_favourites").insert({ ...r, user_id: user.id, event_id: eventId });
      }
    },
    [list, eventId, user],
  );

  return { list, isFav, toggle, signedIn: !!user };
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** Does a results/tracking row belong to a starred rider? Matches race number, then name. */
export function matchesFav(f: FavRider, name: string | null | undefined, bib: string | null | undefined) {
  if (f.bib_number && bib && norm(f.bib_number) === norm(bib)) return true;
  return !!name && norm(f.full_name) === norm(name);
}
