import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Newspaper, Tag, Handshake, ArrowLeft, LogOut, Users, Settings, UserPlus, MessagesSquare, BedDouble, Plug, BarChart3 , Package, Tent, Brain, Bot, BellRing, ShieldCheck, HardHat, CalendarClock, KeyRound, Trophy, Medal, ClipboardList, Instagram, Wallet, GraduationCap, LogIn, Mail, Radar } from "lucide-react";
import rceLogo from "@/assets/rce-logo.png.asset.json";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { useIsAdmin, signOut } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Red Cherry Events" },
      { name: "description", content: "Admin dashboard for managing events, feed, promos and sponsors." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/tracking", label: "Live tracking", icon: Radar },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/event-info", label: "Rider info", icon: Newspaper },
  { to: "/admin/village", label: "Village maps", icon: Tent },
  { to: "/admin/roster", label: "Roster", icon: UserPlus },
  { to: "/admin/entry-ninja", label: "Entry Ninja", icon: Plug },
  { to: "/admin/merchandise", label: "Merchandise", icon: Package },
  { to: "/admin/pricing", label: "Price book", icon: Wallet },
  { to: "/admin/results", label: "Results", icon: Trophy },


  { to: "/admin/loyalty", label: "Loyalty", icon: Medal },
  { to: "/admin/rooming", label: "Rooming", icon: BedDouble },
  { to: "/admin/run-sheet", label: "Run sheets", icon: ClipboardList },
  { to: "/admin/learn", label: "Crew training", icon: GraduationCap },
  { to: "/crew", label: "Crew finder", icon: HardHat },

  { to: "/admin/messages", label: "Messages", icon: MessagesSquare },
  { to: "/admin/knowledge", label: "Bot knowledge", icon: Brain },
  { to: "/admin/bot-log", label: "Bot Q&A log", icon: Bot },
  { to: "/admin/notifications", label: "Notifications", icon: BellRing },
  { to: "/admin/feed", label: "News feed", icon: Newspaper },
  { to: "/admin/promos", label: "Promos", icon: Tag },
  { to: "/admin/sponsors", label: "Sponsors", icon: Handshake },
  { to: "/admin/social", label: "Social feeds", icon: Instagram },
  { to: "/admin/riders", label: "Riders", icon: Users },
  { to: "/admin/sign-ins", label: "Sign-in activity", icon: LogIn },
  { to: "/admin/emails", label: "Email log", icon: Mail },
  { to: "/admin/crew", label: "Crew logins", icon: KeyRound },
  { to: "/admin/schedule-sync", label: "Schedule sync", icon: CalendarClock },
  { to: "/admin/email-content", label: "Email content", icon: Mail },

  { to: "/admin/audit", label: "Content check", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: Settings },
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
            You're signed in as <b>{user.email}</b>, but your account isn't an admin.
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
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white p-1 ring-1 ring-border">
              <img src={rceLogo.url} alt="Red Cherry Events" className="h-full w-full object-contain" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
                Red Cherry · Admin
              </p>
              <p className="font-display text-sm font-bold leading-tight">Admin console</p>
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
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] space-y-1 overflow-y-auto overscroll-contain pr-1">
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
