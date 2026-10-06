// Start-group countdowns for race control, read from the event's published schedule.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { fetchStartsCrew, fetchStartsField } from "@/lib/crew-field-link.functions";

function fmtLeft(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function StartCountdownPanel({ eventId, fieldToken }: { eventId: string; fieldToken?: string }) {
  const { data = [] } = useQuery({
    queryKey: ["race-starts", eventId, fieldToken ?? ""],
    queryFn: () =>
      fieldToken ? fetchStartsField({ data: { eventId, token: fieldToken } }) : fetchStartsCrew({ data: { eventId } }),
    refetchInterval: 5 * 60_000,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (data.length === 0) return null;
  const nextIdx = data.findIndex((s) => new Date(s.at).getTime() > now);
  const byDay = new Map<string, typeof data>();
  for (const s of data) byDay.set(s.dayLabel, [...(byDay.get(s.dayLabel) ?? []), s]);

  return (
    <section className="rounded-2xl bg-card p-3 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display font-bold text-ink">
        <Timer className="h-4 w-4 text-cherry" /> Start times
      </h2>
      <div className="mt-2 space-y-3">
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{day}</p>
            <ul className="mt-1 divide-y divide-border">
              {list.map((s) => {
                const t = new Date(s.at).getTime();
                const left = t - now;
                const isNext = data[nextIdx] === s;
                return (
                  <li key={s.at + s.label} className={`flex items-center gap-3 py-2 ${isNext ? "font-bold" : ""}`}>
                    <span className="w-12 font-mono text-sm text-ink">
                      {new Date(s.at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                        left <= 0 ? "bg-muted text-ink-soft" : isNext ? "bg-cherry text-white" : "bg-muted text-ink"
                      }`}
                    >
                      {left <= 0 ? "Started" : fmtLeft(left)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
