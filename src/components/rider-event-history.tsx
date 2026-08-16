import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { History, RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncMyEntryNinjaHistory } from "@/lib/entryninja-history.functions";

type Row = {
  id: string;
  en_event_id: number;
  event_id: string | null;
  event_name: string;
  event_date: string | null;
  venue: string | null;
  category: string | null;
  bib_number: string | null;
  paid: boolean | null;
};

function fmtDate(value: string | null) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

/** Past events this rider has entered, pulled from the entry system. */
export function RiderEventHistory({ userId }: { userId: string }) {
  const sync = useServerFn(syncMyEntryNinjaHistory);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [surname, setSurname] = useState("");
  const [askIdentity, setAskIdentity] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("rider_event_history")
      .select("id, en_event_id, event_id, event_name, event_date, venue, category, bib_number, paid")
      .eq("user_id", userId)
      .order("event_date", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await sync({ data: { id_number: idNumber.trim(), surname: surname.trim() } });
      if (!res.ok && res.reason === "no_identity") {
        setAskIdentity(true);
        setMsg("Add your ID number and surname so we can find your entries.");
      } else if (!res.ok) {
        setMsg(res.error ?? "Couldn't reach the entry system. Try again shortly.");
      } else if (res.matched === 0) {
        setAskIdentity(true);
        setMsg("No entries found yet. Check your ID number and surname below, then sync again.");
      } else {
        setMsg(`Found ${res.matched} event${res.matched === 1 ? "" : "s"} you've entered.`);
        await load();
      }
    } catch (err) {
      setMsg((err as Error).message ?? "Sync failed.");
    }
    setBusy(false);
  }

  return (
    <section className="mx-5 mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-cherry" />
        <h2 className="font-display text-sm font-bold">Your event history</h2>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-ink disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Pulling…" : "Sync entries"}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Every Red Cherry event you've entered, pulled straight from the entry system.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-ink-soft">Nothing here yet — tap “Sync entries” to pull your history.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => {
            const body = (
              <>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-cherry-deep">
                  <Trophy className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.event_name}</span>
                  <span className="block truncate text-[11px] text-ink-soft">
                    {[fmtDate(r.event_date), r.category, r.bib_number ? `#${r.bib_number}` : null, r.venue]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </>
            );
            return (
              <li key={r.id}>
                {r.event_id ? (
                  <Link
                    to="/my-events/$eventId"
                    params={{ eventId: r.event_id }}
                    className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 ring-1 ring-border"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 ring-1 ring-border">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {msg ? <p className="mt-3 text-xs text-ink-soft">{msg}</p> : null}

      {askIdentity ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="ID number"
            inputMode="numeric"
            autoComplete="off"
          />
          <input
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Surname"
            autoComplete="family-name"
          />
        </div>
      ) : null}
    </section>
  );
}
