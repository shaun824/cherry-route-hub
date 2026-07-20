import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Ticket, Radio, User, Siren } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/my-events", label: "My Events", icon: Ticket, match: (p: string) => p.startsWith("/my-events") || p.startsWith("/events") },
  { to: "/tracker", label: "Tracker", icon: Radio, match: (p: string) => p.startsWith("/tracker") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 pb-28">{children}</main>

      {/* Floating SOS — always reachable */}
      <Link
        to="/tracker"
        aria-label="Emergency SOS"
        className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg shadow-cherry/40 ring-4 ring-background cherry-gradient active:scale-95 transition-transform"
      >
        <Siren className="h-6 w-6" strokeWidth={2.4} />
        <span className="sr-only">SOS</span>
      </Link>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-border/70 bg-card/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4">
          {tabs.map((t) => {
            const active = t.match(pathname);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium"
                >
                  <span
                    className={
                      active
                        ? "grid h-9 w-14 place-items-center rounded-full bg-cherry text-white"
                        : "grid h-9 w-14 place-items-center rounded-full text-ink-soft"
                    }
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  </span>
                  <span className={active ? "text-cherry" : "text-ink-soft"}>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
