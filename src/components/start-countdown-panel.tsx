// Start-group countdowns for race control, read from the event's published schedule.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Timer, Users } from "lucide-react";
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
  const { data: res } = useQuery({
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

  const data = res?.starts ?? [];
  const classes = res?.classes ?? [];
  const total = classes.reduce((n, c) => n + c.count, 0);
  if (data.length === 0 && classes.length === 0) return null;
  const nextIdx = data.findIndex((s) => new Date(s.at).getTime() > now);

  // Assign each class to the start waves it rides in (tier + e-bike + optional weekday).
  const TIERS = ["gold", "silver", "bronze"];
  const WD = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const matches = (cls: string, s: (typeof data)[number]) => {
    const c = cls.toLowerCase();
    const l = s.label.toLowerCase();
    const tier = TIERS.find((t) => c.includes(t));
    if (!tier) return false;
    if (/e-?bike/.test(c) !== /e-?bike/.test(l)) return false;
    if (TIERS.find((t) => l.includes(t)) !== tier) return false;
    const only = WD.find((w) => c.includes(w));
    if (only) {
      const wd = new Date(s.at).toLocaleDateString("en-ZA", { weekday: "long", timeZone: "Africa/Johannesburg" }).toLowerCase();
      if (wd !== only) return false;
    }
    return true;
  };
  const assigned = new Set<string>();
  const waveClasses = data.map((s) => {
    const list = classes.filter((c) => matches(c.name, s));
    list.forEach((c) => assigned.add(c.name));
    return list;
  });
  const unassigned = classes.filter((c) => !assigned.has(c.name));
  const byDay = new Map<string, number[]>();
  data.forEach((s, i) => byDay.set(s.dayLabel, [...(byDay.get(s.dayLabel) ?? []), i]));

  return (
    <section className="rounded-2xl bg-card p-3 ring-1 ring-border">
      <h2 className="flex items-center justify-between gap-2 font-display font-bold text-ink">
        <span className="flex items-center gap-2"><Timer className="h-4 w-4 text-cherry" /> Start waves</span>
        {total > 0 ? (
          <span className="flex items-center gap-1 rounded-full bg-cherry px-2 py-0.5 text-xs text-white">
            <Users className="h-3 w-3" /> {total} entered
          </span>
        ) : null}
      </h2>
      <div className="mt-2 space-y-3">
        {[...byDay.entries()].map(([day, idxs]) => (
          <div key={day}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{day}</p>
            <ul className="mt-1 divide-y divide-border">
              {idxs.map((i) => {
                const s = data[i];
                const left = new Date(s.at).getTime() - now;
                const isNext = i === nextIdx;
                const wc = waveClasses[i];
                const riders = wc.reduce((n, c) => n + c.count, 0);
                return (
                  <li key={s.at + s.label} className="py-2">
                    <div className={`flex items-center gap-2 ${isNext ? "font-bold" : ""}`}>
                      <span className="w-12 font-mono text-sm text-ink">
                        {new Date(s.at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{s.label}</span>
                      <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-xs font-bold text-background">
                        {riders}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                          left <= 0 ? "bg-muted text-ink-soft" : isNext ? "bg-cherry text-white" : "bg-muted text-ink"
                        }`}
                      >
                        {left <= 0 ? "Started" : fmtLeft(left)}
                      </span>
                    </div>
                    {wc.length > 0 ? (
                      <p className="mt-1 pl-14 text-xs text-ink-soft">
                        {wc.map((c) => `${c.name.replace(/\s*Weekend Warrior\s*/i, "").trim()} (${c.count})`).join(" · ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {unassigned.length > 0 ? (
          <div className="rounded-xl bg-muted p-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              Not in a wave yet · {unassigned.reduce((n, c) => n + c.count, 0)} riders
            </p>
            <ul className="mt-1 space-y-1">
              {unassigned.map((c) => (
                <li key={c.name} className="flex items-center justify-between text-xs text-ink">
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono">{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
