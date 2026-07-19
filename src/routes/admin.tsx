import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Newspaper, Tag, Handshake, ArrowLeft, LogOut, Users } from "lucide-react";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { useIsAdmin, signOut } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Red Cherry Events" },
      { name: "description", content: "Super admin dashboard for managing events, feed, promos and sponsors." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/feed", label: "News feed", icon: Newspaper },
  { to: "/admin/promos", label: "Promos", icon: Tag },
  { to: "/admin/sponsors", label: "Sponsors", icon: Handshake },
  { to: "/admin/riders", label: "Riders", icon: Users },
];


function AdminLayout() {
  useHydratedStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, loading, user } = useIsAdmin();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-ink-soft">Loading admin…</div>;
  }
  if (!user) return <Navigate to="/auth" search={{ next: "/admin" }} />;
  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/40 px-6 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="font-display text-xl font-bold">No admin access</h1>
          <p className="text-sm text-ink-soft">
            You're signed in as <b>{user.email}</b>, but your account isn't a super admin.
            Contact <b>shaun@redcherryevents.co.za</b> to request access.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link to="/" className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white">Go to rider app</Link>
            <button onClick={() => void signOut()} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40 text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg cherry-gradient text-white font-black">
              RC
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Red Cherry · Admin
              </p>
              <p className="font-display text-sm font-bold leading-tight">Super admin console</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-ink-soft md:inline">{user.email}</span>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-secondary"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Rider app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-8">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold ${
                    active ? "bg-cherry text-white shadow-sm" : "text-ink-soft hover:bg-card"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile nav pills */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold ${
                  active ? "bg-cherry text-white" : "text-ink-soft"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
