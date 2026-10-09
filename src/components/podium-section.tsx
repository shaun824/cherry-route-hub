// Public prize-giving section on the results tab: categories -> provisional -> final podium.
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { getPodium } from "@/lib/podium.functions";
import type { PodiumStanding } from "@/lib/podium.server";

const MEDAL = ["🥇", "🥈", "🥉"];

export function groupStandings(list: PodiumStanding[]) {
  const m = new Map<string, PodiumStanding[]>();
  for (const s of list) m.set(s.group, [...(m.get(s.group) ?? []), s]);
  return [...m.entries()];
}

export function PodiumSection({ eventId }: { eventId: string }) {
  const { data } = useQuery({
    queryKey: ["podium", eventId],
    queryFn: () => getPodium({ data: { eventId } }),
    refetchInterval: 60_000,
  });
  if (!data?.enabled) return null;
  const reveal = data.revealAt
    ? new Date(data.revealAt).toLocaleString("en-ZA", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })
    : "Sunday 12:00";

  return (
    <section className="mb-5 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Trophy className="h-5 w-5 text-cherry" /> Prize giving
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
            data.stage === "final" ? "bg-cherry text-primary-foreground" : data.stage === "provisional" ? "bg-accent text-ink" : "bg-muted text-ink-soft"
          }`}
        >
          {data.stage === "final" ? "Final podium" : data.stage === "provisional" ? "Provisional" : "Podium categories"}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {data.stage === "final"
          ? "Official podium — congratulations to all our winners!"
          : data.stage === "provisional"
            ? `Provisional standings after ${data.stagesWithResults === 1 ? "stage 1" : `${data.stagesWithResults} stages`}. Final podium at prize giving, ${reveal}.`
            : `Prize giving is ${reveal} for Weekend Pass riders. U/14 and Adult categories; the only E-Bike podium is the Gold race.`}
      </p>
      <div className="mt-3 space-y-4">
        {groupStandings(data.standings).map(([group, cats]) => (
          <div key={group}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-cherry">{group}</p>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {cats.map((c) => (
                <div key={c.key} className="rounded-xl bg-background p-2.5 ring-1 ring-border">
                  <p className="text-sm font-bold text-ink">{c.title}</p>
                  {data.stage === "preview" ? (
                    <p className="mt-1 text-xs text-ink-soft">🥇 1st · 🥈 2nd · 🥉 3rd</p>
                  ) : c.riders.length === 0 ? (
                    <p className="mt-1 text-xs text-ink-soft">No times yet</p>
                  ) : (
                    <ol className="mt-1 space-y-0.5">
                      {c.riders.slice(0, 3).map((r, i) => (
                        <li key={r.name + i} className="flex items-center gap-2 text-sm">
                          <span>{MEDAL[i]}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                          {r.time ? <span className="font-mono text-xs text-ink-soft">{r.time}</span> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
