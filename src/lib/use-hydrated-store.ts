// Hydrates the zustand store from Lovable Cloud on mount and subscribes to
// realtime changes so admin edits reflect live across sessions.
import { useEffect, useState } from "react";
import { useAdminStore } from "./store";
import { fetchFeed, fetchPromos, fetchSponsors } from "./cloud";
import { fetchSettings } from "./settings";
import { supabase } from "@/integrations/supabase/client";

let started = false;

export function useHydratedStore() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (started) { setHydrated(true); return; }
    started = true;

    const setState = useAdminStore.setState;

    const load = async () => {
      const [feed, promos, sponsors] = await Promise.all([
        fetchFeed(), fetchPromos(), fetchSponsors(),
      ]);
      setState((s) => ({
        feed: feed ?? s.feed,
        promos: promos ?? s.promos,
        sponsors: sponsors ?? s.sponsors,
      }));
      setHydrated(true);
    };
    load();

    const ch = supabase
      .channel("admin-content")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => {
        fetchFeed().then((feed) => feed && setState({ feed }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "promos" }, () => {
        fetchPromos().then((promos) => promos && setState({ promos }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sponsors" }, () => {
        fetchSponsors().then((sponsors) => sponsors && setState({ sponsors }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return hydrated;
}
