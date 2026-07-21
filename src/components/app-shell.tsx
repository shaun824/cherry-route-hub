import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Ticket, Binoculars, User, LogIn, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/auth";

const tabs = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { to: "/my-events", label: "My Events", icon: Ticket, match: (p: string) => p.startsWith("/my-events") || p.startsWith("/events") },
  { to: "/spectate", label: "Spectate", icon: Binoculars, match: (p: string) => p.startsWith("/spectate") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem("rce.signin-cta-dismissed") === "1");
  }, []);

  const showSignInCta = !loading && !user && !dismissed;
  const nextPath = pathname === "/auth" ? "/" : pathname;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 pb-28">{children}</main>

      {showSignInCta ? (
        <div
          className="fixed inset-x-0 z-30 mx-auto w-full max-w-md px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-lg ring-1 ring-black/20">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
              <LogIn className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[13px] font-bold">Sign in for your events</p>
              <p className="text-[11px] opacity-75">Race packs, routes, chat & more</p>
            </div>
            <Link
              to="/auth"
              search={{ next: nextPath }}
              className="shrink-0 rounded-full bg-cherry px-3 py-1.5 text-xs font-bold text-white"
            >
              Sign in
            </Link>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => {
                setDismissed(true);
                if (typeof window !== "undefined") {
                  window.sessionStorage.setItem("rce.signin-cta-dismissed", "1");
                }
              }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/70 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

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

