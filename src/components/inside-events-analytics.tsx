// Admin → Analytics "Inside events": tab popularity, Info sections read,
// top actions, sign-in walls and "possible confusion" loops, per event.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Summary = {
  events: { event_id: string; event_name: string | null; views: number }[];
  tabs: { tab: string; views: number; riders: number; avg_ms: number }[];
  sections: { section: string; tab: string; views: number; riders: number; avg_ms: number }[];
  actions: { action: string; tab: string; count: number; riders: number }[];
  walls: { wall: string | null; tab: string; seen: number; clicked: number; visitors: number }[];
  confusion: { label: string; tab: string | null; opens: number; signed_in: boolean; last_at: string }[];
};

const TAB_LABELS: Record<string, string> = {
  info: "Info", routes: "Routes", village: "Village", accommodation: "Accommodation", news: "News",
  photos: "Photos", packing: "Packing", chat: "Event chat", ask: "Ask admin", sponsors: "Sponsors", profile: "Profile",
};
const nice = (s: string | null | undefined) => (s ? TAB_LABELS[s] ?? s.replaceAll("_", " ") : "—");

function dur(ms: number) {
  const n = Number(ms);
  if (!n || n < 1000) return "—";
  const s = Math.round(n / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function InsideEventsAnalytics({ since, rangeKey }: { since: string; rangeKey: string }) {
  const [eventId, setEventId] = useState<string>("");
  const { data, isLoading } = useQuery({
    queryKey: ["inside-events-summary", rangeKey, eventId],
    queryFn: async (): Promise<Summary> => {
      const rpc = supabase.rpc as unknown as (
        n: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("inside_events_summary", { _since: since, _event_id: eventId || null });
      if (error) throw error;
      return data as Summary;
    },
    staleTime: 60_000,
  });

  const th = "pb-2 text-right";
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-soft">Inside events</h2>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold"
        >
          <option value="">All events</option>
          {(data?.events ?? []).map((e) => (
            <option key={e.event_id} value={e.event_id}>{e.event_name ?? e.event_id}</option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : !data ? (
        <p className="text-sm text-ink-soft">No data.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Block title="Tab popularity">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="pb-2">Tab</th><th className={th}>Views</th><th className={th}>Riders</th><th className={th}>Avg time</th></tr></thead>
              <tbody>
                {data.tabs.map((t) => (
                  <tr key={t.tab} className="border-t border-border"><td className="py-1.5">{nice(t.tab)}</td><td className="text-right tabular-nums">{t.views}</td><td className="text-right tabular-nums">{t.riders}</td><td className="text-right tabular-nums text-ink-soft">{dur(t.avg_ms)}</td></tr>
                ))}
                {data.tabs.length === 0 ? <Empty cols={4} /> : null}
              </tbody>
            </table>
          </Block>
          <Block title="Most-read sections">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="pb-2">Section</th><th className={th}>Views</th><th className={th}>Riders</th><th className={th}>Avg time</th></tr></thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={`${s.tab}-${s.section}`} className="border-t border-border"><td className="py-1.5 capitalize">{nice(s.section)} <span className="text-[10px] text-ink-soft">· {nice(s.tab)}</span></td><td className="text-right tabular-nums">{s.views}</td><td className="text-right tabular-nums">{s.riders}</td><td className="text-right tabular-nums text-ink-soft">{dur(s.avg_ms)}</td></tr>
                ))}
                {data.sections.length === 0 ? <Empty cols={4} /> : null}
              </tbody>
            </table>
          </Block>
          <Block title="Top actions">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="pb-2">Action</th><th className={th}>Count</th><th className={th}>Riders</th></tr></thead>
              <tbody>
                {data.actions.map((a) => (
                  <tr key={`${a.tab}-${a.action}`} className="border-t border-border"><td className="py-1.5 capitalize">{nice(a.action)} <span className="text-[10px] text-ink-soft">· {nice(a.tab)}</span></td><td className="text-right tabular-nums">{a.count}</td><td className="text-right tabular-nums">{a.riders}</td></tr>
                ))}
                {data.actions.length === 0 ? <Empty cols={3} /> : null}
              </tbody>
            </table>
          </Block>
          <Block title="Where signed-out visitors hit sign-in walls">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="pb-2">Locked content</th><th className={th}>Seen</th><th className={th}>Tapped sign in</th></tr></thead>
              <tbody>
                {data.walls.map((w, i) => (
                  <tr key={i} className="border-t border-border"><td className="py-1.5">{w.wall ?? "—"} <span className="text-[10px] text-ink-soft">· {nice(w.tab)}</span></td><td className="text-right tabular-nums">{w.seen}</td><td className="text-right tabular-nums">{w.clicked}</td></tr>
                ))}
                {data.walls.length === 0 ? <Empty cols={3} /> : null}
              </tbody>
            </table>
          </Block>
          <div className="lg:col-span-2">
            <Block title="Possible confusion">
              <p className="mb-2 text-xs text-ink-soft">Visitors who reopened the same event tab or their profile 3+ times within 10 minutes without doing anything — they may be looking for something they can't find.</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="pb-2">Where</th><th className={th}>Opens</th><th className={th}>Visitor</th><th className={th}>Last seen</th></tr></thead>
                <tbody>
                  {data.confusion.map((c, i) => (
                    <tr key={i} className="border-t border-border"><td className="py-1.5">{c.label} › {nice(c.tab)}</td><td className="text-right tabular-nums">{c.opens}</td><td className="text-right text-ink-soft">{c.signed_in ? "Signed in" : "Guest"}</td><td className="text-right text-xs text-ink-soft">{new Date(c.last_at).toLocaleString()}</td></tr>
                  ))}
                  {data.confusion.length === 0 ? <Empty cols={4} /> : null}
                </tbody>
              </table>
            </Block>
          </div>
        </div>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs font-bold text-ink">{title}</p>
      {children}
    </div>
  );
}
function Empty({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="py-3 text-center text-xs text-ink-soft">Nothing recorded yet in this period.</td></tr>;
}
