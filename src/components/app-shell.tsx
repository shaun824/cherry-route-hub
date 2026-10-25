import { APP_SCROLL_ID } from "@/lib/app-scroll";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Ticket, Binoculars, User, LogIn, X, HardHat, BedDouble, Smartphone, ClipboardList, GraduationCap, RefreshCw } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/auth";
import { usePullToRefresh } from "@/lib/use-pull-to-refresh";
import { useEntryAutoSync } from "@/lib/use-entry-autosync";
import { Footer } from "@/components/footer";
import { BrandMark } from "@/components/ui-bits";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { recordVisit } from "@/lib/feature-discovery";

const LazyAssistantWidget = lazy(() =>
  import("@/components/assistant-widget").then((module) => ({ default: module.AssistantWidget })),
);

const riderTabs = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  // Short label keeps the 4-up bottom bar readable; fullLabel is used on desktop + screen readers.
  { to: "/my-events", label: "Events", fullLabel: "Events Hub", icon: Ticket, match: (p: string) => p.startsWith("/my-events") || p.startsWith("/events") },
  { to: "/spectate", label: "Track", icon: Binoculars, match: (p: string) => p.startsWith("/spectate") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
] as const;

const crewTabs = [
  { to: "/crew", label: "Crew", fullLabel: "Crew dashboard", icon: HardHat, match: (p: string) => p === "/crew" || p === "/crew/" },
  { to: "/crew/run-sheet", label: "Run sheet", fullLabel: "Run sheet", icon: ClipboardList, match: (p: string) => p.startsWith("/crew/run-sheet") || p.startsWith("/crew/department") },
  { to: "/crew/learn", label: "Learn", fullLabel: "Crew training", icon: GraduationCap, match: (p: string) => p.startsWith("/crew/learn") },
  { to: "/crew/rooming", label: "Rooming", fullLabel: "Rooming finder", icon: BedDouble, match: (p: string) => p.startsWith("/crew/rooming") },
  { to: "/", label: "Rider app", fullLabel: "Rider app", icon: Smartphone, match: () => false },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  // Crew screens are a distinct area of the app; riders never see /crew paths.
  const inCrewArea = pathname.startsWith("/crew") && !pathname.startsWith("/crew/login");

  const [dismissed, setDismissed] = useState(false);
  const { pull, refreshing } = usePullToRefresh();
  useEntryAutoSync(Boolean(user));

  useEffect(() => {
    recordVisit(pathname);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem("rce.signin-cta-dismissed") === "1");
  }, []);

  const tabs: readonly {
    to: string;
    label: string;
    fullLabel?: string;
    icon: typeof Home;
    match: (p: string) => boolean;
  }[] = inCrewArea ? crewTabs : riderTabs;
  const showSignInCta = !loading && !user && !dismissed && !inCrewArea;

  const nextPath = pathname === "/auth" ? "/" : pathname;

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("rce.signin-cta-dismissed", "1");
    }
  }


  return (
    <div className="app-frame flex h-[100dvh] flex-col overflow-hidden bg-secondary/30 md:h-auto md:min-h-screen md:flex-row md:overflow-visible">
      {/* Pull-to-refresh indicator (mobile) */}
      {pull > 0 || refreshing ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center md:hidden"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
          aria-live="polite"
        >
          <div
            className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-md ring-1 ring-border transition-opacity"
            style={{
              opacity: refreshing ? 1 : Math.min(1, pull / 60),
              transform: `translateY(${refreshing ? 0 : Math.min(pull, 48) - 12}px)`,
            }}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-cherry ${refreshing ? "animate-spin" : ""}`}
              style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
            />
            {refreshing ? "Refreshing…" : pull >= 80 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      ) : null}

      {/* Tablet / desktop side navigation */}
      <aside className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col border-r border-border bg-card px-4 py-6 md:flex lg:w-[17rem]">
        <Link to={inCrewArea ? "/crew" : "/"} className="flex items-center gap-3">
          <BrandMark size={40} />
          <span className="font-display text-sm font-bold leading-tight">
            Red Cherry
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              {inCrewArea ? "Crew Tools" : "Rider Hub"}
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
                    to={t.to as never}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-xl bg-cherry px-3 py-2.5 text-sm font-bold text-white"
                        : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-secondary"
                    }
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={active ? 2.4 : 2} />
                    {t.fullLabel ?? t.label}
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
      <div
        id={APP_SCROLL_ID}
        data-scroll-restoration-id={APP_SCROLL_ID}
        className="mx-auto flex min-h-0 w-full min-w-0 max-w-md flex-1 flex-col overflow-y-auto overscroll-contain bg-background md:mx-0 md:min-h-screen md:max-w-none md:overflow-visible"
      >
        <main className="mx-auto w-full flex-1 pb-6 md:max-w-3xl md:pb-10 lg:max-w-5xl xl:max-w-6xl">
          <div key={pathname} className="page-enter">{children}</div>
          <Footer />
        </main>
      </div>

      {/* Mobile bottom stack: an ordinary last row of a one-screen-tall frame (not
          position:fixed), so iPhone Safari's toolbar can never strand it mid-screen. */}
      <div className="relative z-30 mx-auto w-full max-w-md shrink-0 bg-background md:hidden">
      {/* Mobile-only sign-in banner */}
      {showSignInCta ? (
        <div
          className="pb-2 pl-3 pr-[4.5rem]"
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
        className="w-full border-t border-border/70 bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className={inCrewArea ? "grid grid-cols-5" : "grid grid-cols-4"}>
          {tabs.map((t) => {
            const active = t.match(pathname);
            const Icon = t.icon;
            return (
              <li key={t.to}>
                <Link
                  to={t.to as never}
                  preload="intent"
                  aria-label={t.fullLabel ?? t.label}
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
      </div>

      <InstallAppPrompt />
      <Suspense fallback={null}><LazyAssistantWidget /></Suspense>
    </div>
  );
}
