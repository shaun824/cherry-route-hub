import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Ticket, Binoculars, User } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/my-events", label: "My Events", icon: Ticket, match: (p: string) => p.startsWith("/my-events") || p.startsWith("/events") },
  { to: "/spectate", label: "Spectate", icon: Binoculars, match: (p: string) => p.startsWith("/spectate") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 pb-28">{children}</main>

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
