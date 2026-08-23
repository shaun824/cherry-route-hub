// Refresh the signed-in rider's Entry Ninja entries when they open the app.
// Throttled so we never hammer the Entry Ninja API.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { syncMyEntriesNow } from "@/lib/my-entries-sync.functions";

const KEY = "rce.entry-autosync-at";
const MIN_GAP_MS = 5 * 60 * 1000; // at most once every 5 minutes per device

export function useEntryAutoSync(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const last = Number(window.localStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return;
    window.localStorage.setItem(KEY, String(Date.now()));

    let cancelled = false;
    void (async () => {
      try {
        const res = await syncMyEntriesNow({});
        if (!cancelled && res.ok && res.saved > 0) {
          void qc.invalidateQueries({ queryKey: ["my-events"] });
          void qc.invalidateQueries({ queryKey: ["my-entry"] });
          void qc.invalidateQueries({ queryKey: ["my-entrant"] });
        }
      } catch {
        // silent — the manual sync button and the scheduled sync cover us
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, qc]);
}
