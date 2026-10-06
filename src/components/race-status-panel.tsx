// Finished / still-out board for race control, driven by the results system.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag, Timer } from "lucide-react";
import { fetchRaceStatusCrew, fetchRaceStatusField } from "@/lib/crew-field-link.functions";

const fmtClock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }) : null;

export function RaceStatusPanel({ eventId, fieldToken }: { eventId: string; fieldToken?: string }) {
  const [day, setDay] = useState<string | null>(null);
  const [tab, setTab] = useState<"finished" | "out">("out");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["race-status", eventId, fieldToken ?? "", day],
    queryFn: () =>
      fieldToken
        ? fetchRaceStatusField({ data: { eventId, token: fieldToken, day } })
        : fetchRaceStatusCrew({ data: { eventId, day } }),
    refetchInterval: 60_000,
  });

  const list = (tab === "finished" ? data?.finished : data?.stillOut) ?? [];
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? list.filter((r) => r.name.toLowerCase().includes(needle) || (r.bib ?? "").toLowerCase().includes(needle))
    : list;

  return (
    <section className="rounded-2xl bg-card p-3 ring-1 ring-border">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display font-bold text-ink">
          <Flag className="h-4 w-4 text-cherry" /> Finish line
        </h2>
        {data && data.days.length > 1 ? (
          <div className="flex gap-1">
            {data.days.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDay(d.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-border ${data.dayKey === d.key ? "bg-ink text-background" : "bg-card text-ink"}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-2 text-sm text-ink-soft">Checking results…</p>
      ) : !data || data.source === "none" ? (
        <p className="mt-2 text-sm text-ink-soft">
          No results from timing yet. Finishers will show here as soon as the results system has them.
        </p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTab("out")}
              className={`rounded-xl p-2 text-left ring-1 ${tab === "out" ? "bg-cherry/10 ring-cherry" : "ring-border"}`}
            >
              <p className="text-2xl font-black text-ink">{data.stillOut.length}</p>
              <p className="text-xs font-semibold text-ink-soft">Still out</p>
            </button>
            <button
              type="button"
              onClick={() => setTab("finished")}
              className={`rounded-xl p-2 text-left ring-1 ${tab === "finished" ? "bg-primary/10 ring-primary" : "ring-border"}`}
            >
              <p className="text-2xl font-black text-ink">{data.finished.length}</p>
              <p className="text-xs font-semibold text-ink-soft">Finished</p>
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or race number…"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <ul className="mt-2 max-h-80 divide-y divide-border overflow-y-auto">
            {shown.length === 0 ? (
              <li className="py-3 text-sm text-ink-soft">
                {tab === "finished" ? "Nobody has finished yet." : "Everyone is in."}
              </li>
            ) : (
              shown.map((r, i) => (
                <li key={`${r.bib ?? r.name}-${i}`} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-12 shrink-0 text-xs font-bold text-ink-soft">{r.bib ? `#${r.bib}` : ""}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{r.name}</span>
                    {r.category ? <span className="block truncate text-xs text-ink-soft">{r.category}</span> : null}
                  </span>
                  {tab === "finished" ? (
                    <span className="text-right text-xs">
                      {fmtClock(r.finishedAt) ? <span className="block font-bold text-ink">in at {fmtClock(r.finishedAt)}</span> : null}
                      {r.timeText ? (
                        <span className="inline-flex items-center gap-1 text-ink-soft">
                          <Timer className="h-3 w-3" /> {r.timeText}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          <p className="mt-2 text-[11px] text-ink-soft">
            From the official timing results · updates every minute{data.error ? " · timing feed slow, showing last import" : ""}.
          </p>
        </>
      )}
    </section>
  );
}
