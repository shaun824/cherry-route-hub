import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { syncMyEntriesNow } from "@/lib/my-entries-sync.functions";

/** Rider-triggered "I've just entered" refresh — pulls only this rider's entries. */
export function SyncMyEntryButton({ className = "" }: { className?: string }) {
  const run = useServerFn(syncMyEntriesNow);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await run({});
      if (!res.ok) {
        setStatus(
          res.reason === "no_identity"
            ? "Add your ID number on your profile so we can match your entry."
            : "Entry Ninja didn't respond. Please try again in a moment.",
        );
      } else if (res.saved > 0) {
        setStatus("Found it! Loading your entry…");
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["my-entry"] }),
          qc.invalidateQueries({ queryKey: ["my-events"] }),
          qc.invalidateQueries({ queryKey: ["my-entrant"] }),
        ]);
      } else {
        setStatus("No new entry found yet — entries can take a minute to appear after payment.");
      }
    } catch (err) {
      setStatus((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-ink disabled:opacity-60"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Checking Entry Ninja…" : "Already entered? Sync my entry"}
      </button>
      {status ? <p className="mt-2 px-1 text-[11px] text-ink-soft">{status}</p> : null}
    </div>
  );
}
