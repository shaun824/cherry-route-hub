import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Users, Eye, Timer, RefreshCw, MonitorSmartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

type Row = {
  id: string;
  session_id: string;
  user_id: string | null;
  event_name: string;
  path: string;
  route_label: string | null;
  duration_ms: number | null;
  device: string | null;
  referrer: string | null;
  created_at: string;
};

const RANGES = [
  { key: "1", label: "Today", days: 1 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
] as const;

function fmtDuration(ms: number) {
  if (!ms || ms < 1000) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

type Summary = {
  visitors: number;
  signed_in: number;
  page_views: number;
  unique_screens: number;
  avg_time_ms: number;
  bounce_pct: number;
  per_page: { path: string; views: number; sessions: number; avg: number }[];
  trend: { date: string; views: number; sessions: number }[];
  devices: { device: string; count: number }[];
  journeys: { id: string; last: string; user: boolean; steps: string[] }[];
};

function AdminAnalytics() {
  const [rangeKey, setRangeKey] = useState<string>("7");
  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 7;
  const since = useMemo(
    () => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    [days],
  );

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["analytics-summary", rangeKey],
    queryFn: async (): Promise<Summary> => {
      const { data, error } = await supabase.rpc("analytics_summary", { _since: since });
      if (error) throw error;
      return data as unknown as Summary;
    },
    staleTime: 60_000,
  });

  const sessions = { size: Number(data?.visitors ?? 0) };
  const signedIn = { size: Number(data?.signed_in ?? 0) };
  const views = { length: Number(data?.page_views ?? 0) };
  const perPage = (data?.per_page ?? []).map((p) => ({ ...p, views: Number(p.views), sessions: Number(p.sessions), avg: Number(p.avg) }));
  const uniqueScreens = Number(data?.unique_screens ?? 0);
  const devices = (data?.devices ?? []).map((d) => ({ ...d, count: Number(d.count) }));
  const trend = (data?.trend ?? []).map((t) => ({ ...t, views: Number(t.views), sessions: Number(t.sessions) }));
  const journeys = data?.journeys ?? [];
  const bounced = Number(data?.bounce_pct ?? 0);
  const avgSession = Number(data?.avg_time_ms ?? 0);

  const maxViews = Math.max(1, ...trend.map((t) => t.views));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Usage analytics</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Who's using the rider app, what they open, and how long they stay. Admin pages aren't tracked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-secondary p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  rangeKey === r.key ? "bg-card text-ink shadow-sm" : "text-ink-soft"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void refetch()}
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-ink-soft transition hover:text-cherry"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading analytics…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Users} label="Visitors" value={sessions.size} sub={`${signedIn.size} signed in`} />
            <Stat icon={Eye} label="Page views" value={views.length} sub={`${perPage.length} unique screens`} />
            <Stat icon={Timer} label="Avg time on page" value={fmtDuration(avgSession)} sub="Per screen visit" />
            <Stat icon={Activity} label="Single-screen visits" value={`${bounced}%`} sub="Left after one screen" />
          </div>

          <Card title="Traffic">
            <div className="flex h-40 items-end gap-1">
              {trend.map((t) => (
                <div key={t.date} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-cherry/80 transition group-hover:bg-cherry"
                    style={{ height: `${Math.max(2, (t.views / maxViews) * 150)}px` }}
                  />
                  <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-semibold text-white group-hover:block">
                    {t.date}: {t.views} views · {t.sessions} visitors
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-ink-soft">
              <span>{trend[0]?.date}</span>
              <span>{trend[trend.length - 1]?.date}</span>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Most viewed screens">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-ink-soft">
                        <th className="pb-2">Screen</th>
                        <th className="pb-2 text-right">Views</th>
                        <th className="pb-2 text-right">Visitors</th>
                        <th className="pb-2 text-right">Avg time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perPage.slice(0, 20).map((p) => (
                        <tr key={p.path} className="border-t border-border">
                          <td className="py-2 pr-3 font-medium">{p.path}</td>
                          <td className="py-2 text-right tabular-nums">{p.views}</td>
                          <td className="py-2 text-right tabular-nums">{p.sessions}</td>
                          <td className="py-2 text-right tabular-nums text-ink-soft">{fmtDuration(p.avg)}</td>
                        </tr>
                      ))}
                      {perPage.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-ink-soft">
                            No activity recorded yet in this period.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card title="Devices">
              <div className="space-y-2">
                {devices.map((d) => {
                  const pct = sessions.size ? Math.round((d.count / sessions.size) * 100) : 0;
                  return (
                    <div key={d.device}>
                      <div className="flex justify-between text-xs font-semibold capitalize">
                        <span className="flex items-center gap-1.5">
                          <MonitorSmartphone className="h-3.5 w-3.5 text-ink-soft" />
                          {d.device}
                        </span>
                        <span className="text-ink-soft">
                          {d.count} · {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-secondary">
                        <div className="h-2 rounded-full bg-cherry" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {devices.length === 0 ? <p className="text-sm text-ink-soft">No data yet.</p> : null}
              </div>
            </Card>
          </div>

          <Card title="Recent visitor journeys">
            <p className="mb-3 text-xs text-ink-soft">
              The path each visitor took through the app — useful for spotting where people get stuck.
            </p>
            <div className="space-y-2">
              {journeys.map((j) => (
                <div key={j.id} className="rounded-xl bg-secondary/50 p-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-ink-soft">
                    <span>{new Date(j.last).toLocaleString()}</span>
                    <span className="font-semibold">{j.user ? "Signed in" : "Guest"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    {j.steps.map((s, i) => (
                      <span key={`${j.id}-${i}`} className="flex items-center gap-1">
                        <span className="rounded-md bg-card px-2 py-0.5 font-medium ring-1 ring-border">{s}</span>
                        {i < j.steps.length - 1 ? <span className="text-ink-soft">→</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {journeys.length === 0 ? <p className="text-sm text-ink-soft">No visits recorded yet.</p> : null}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-cherry-deep">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
      <p className="text-[11px] text-ink-soft">{sub}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
      {children}
    </section>
  );
}
