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
