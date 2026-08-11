import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Ticket, Binoculars, User, LogIn, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { Footer } from "@/components/footer";
import { BrandMark } from "@/components/ui-bits";
import { FeedbackWidget } from "@/components/feedback-widget";

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

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("rce.signin-cta-dismissed", "1");
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30 md:flex">
      {/* Tablet / desktop side navigation */}
      <aside className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col border-r border-border bg-card px-4 py-6 md:flex lg:w-[17rem]">
        <Link to="/" className="flex items-center gap-3">
          <BrandMark size={40} />
          <span className="font-display text-sm font-bold leading-tight">
            Red Cherry
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              Rider Hub
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="mt-8 flex-1">
          <ul className="space-y-1">
            {tabs.map((t) => {
              const active = t.match(pathname);
              const Icon = t.icon;
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
                        : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-secondary"
                    }
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.4 : 2} />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {showSignInCta ? (
          <div className="rounded-2xl bg-ink px-3 py-3 text-white">
            <p className="text-[13px] font-bold">Sign in for your events</p>
            <p className="mt-0.5 text-[11px] opacity-75">Race packs, routes, chat &amp; more</p>
            <Link
              to="/auth"
              search={{ next: nextPath }}
              className="mt-2 inline-flex rounded-full bg-cherry px-3 py-1.5 text-xs font-bold text-white"
            >
              Sign in
            </Link>
          </div>
        ) : null}
      </aside>

      {/* Content column: phone-width on mobile, roomy centred column on larger screens */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background md:max-w-3xl md:shadow-sm md:ring-1 md:ring-border/60 lg:max-w-4xl">
        <main className="flex-1 pb-28 md:pb-10">
          <div key={pathname} className="page-enter">{children}</div>
          <Footer />
        </main>
      </div>

      {/* Mobile-only sign-in banner */}
      {showSignInCta ? (
        <div
          className="fixed inset-x-0 z-30 mx-auto w-full max-w-md px-3 md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}
        >
          <div className="flex items-center gap-2 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-lg ring-1 ring-black/20">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
              <LogIn className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[13px] font-bold">Sign in for your events</p>
              <p className="text-[11px] opacity-75">Race packs, routes, chat &amp; more</p>
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
              onClick={dismiss}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/70 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile-only bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-border/70 bg-card md:hidden"
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
                  preload="intent"
                  className="flex select-none flex-col items-center gap-1 py-3 text-[11px] font-medium"
                >
                  <span
                    className={
                      active
                        ? "grid h-9 w-14 place-items-center rounded-full bg-cherry text-white transition-all duration-200"
                        : "grid h-9 w-14 place-items-center rounded-full text-ink-soft transition-all duration-200"
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

      <FeedbackWidget />
    </div>
  );
}
