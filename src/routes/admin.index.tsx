import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Newspaper, Tag, Handshake, ArrowUpRight, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAdminStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const events = useAdminStore((s) => s.events);
  const feed = useAdminStore((s) => s.feed);
  const promos = useAdminStore((s) => s.promos);
  const sponsors = useAdminStore((s) => s.sponsors);

  const stats = [
    { label: "Events", value: events.length, to: "/admin/events", icon: CalendarDays, sub: `${events.filter((e) => e.status === "open").length} open for entry` },
    { label: "Feed posts", value: feed.length, to: "/admin/feed", icon: Newspaper, sub: `${feed.filter((f) => f.pinned).length} pinned` },
    { label: "Promos", value: promos.length, to: "/admin/promos", icon: Tag, sub: "Active discount codes" },
    { label: "Sponsors", value: sponsors.length, to: "/admin/sponsors", icon: Handshake, sub: `${sponsors.filter((s) => s.active).length} on scroller` },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Everything the rider hub sees is managed here. Edits appear live on the app.
        </p>
      </div>
      <NeedsAttentionBanner />



      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              to={s.to}
              className="group rounded-2xl bg-card p-4 ring-1 ring-border transition hover:ring-cherry"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-cherry-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-ink-soft group-hover:text-cherry" />
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                {s.label}
              </p>
              <p className="mt-1 font-display text-3xl font-black text-ink">{s.value}</p>
              <p className="mt-1 text-[11px] text-ink-soft">{s.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Recent feed posts</h2>
            <Link to="/admin/feed" className="text-xs font-semibold text-cherry">
              Manage →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {feed.slice(0, 4).map((p) => (
              <li key={p.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <p className="font-semibold text-ink">{p.title}</p>
                <p className="text-[11px] text-ink-soft">{p.author} · {p.type}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold">Upcoming events</h2>
            <Link to="/admin/events" className="text-xs font-semibold text-cherry">
              Manage →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {events.slice(0, 4).map((e) => (
              <li key={e.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <p className="font-semibold text-ink">{e.name}</p>
                <p className="text-[11px] text-ink-soft">
                  {new Date(e.date).toLocaleDateString()} · {e.location} · {e.status}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

type StubEvent = {
  id: string;
  name: string;
  auto_created: boolean | null;
  logo_url: string | null;
  cover_url: string | null;
  distance_km: number | null;
  description: string | null;
  location: string | null;
  discipline: string | null;
};

function missingFields(e: StubEvent): string[] {
  const missing: string[] = [];
  if (!e.logo_url) missing.push("logo");
  if (!e.cover_url) missing.push("cover image");
  if (!e.distance_km || e.distance_km === 0) missing.push("distance");
  if (!e.description) missing.push("description");
  if (!e.location || e.location === "TBC") missing.push("location");
  if (!e.discipline || e.discipline === "Cycling") missing.push("discipline");
  return missing;
}

function NeedsAttentionBanner() {
  const q = useQuery({
    queryKey: ["admin-events-needs-attention"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, auto_created, logo_url, cover_url, distance_km, description, location, discipline")
        .eq("auto_created", true);
      return (data ?? []) as StubEvent[];
    },
  });
  const events = q.data ?? [];
  if (events.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-200 text-amber-900">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-amber-900">
            {events.length} event{events.length === 1 ? "" : "s"} synced from Entry Ninja need attention
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80">
            These were auto-created during a roster import and are still missing details riders will expect to see.
          </p>
          <ul className="mt-3 space-y-1.5">
            {events.map((e) => {
              const missing = missingFields(e);
              return (
                <li key={e.id} className="rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-amber-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{e.name}</span>
                    <Link to="/admin/events" className="text-[11px] font-bold text-cherry">
                      Fix →
                    </Link>
                  </div>
                  {missing.length > 0 ? (
                    <p className="mt-0.5 text-[11px] text-ink-soft">
                      Missing: {missing.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-emerald-700">All key fields filled — mark it as ready in the editor.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
