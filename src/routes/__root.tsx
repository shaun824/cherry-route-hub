import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "../components/app-shell";
import { AssistantWidget } from "../components/assistant-widget";
import { SetPasswordPrompt } from "../components/set-password-prompt";
import { supabase } from "../integrations/supabase/client";
import { usePageTracking } from "../lib/analytics";
import { ensureOfflineWorker } from "../lib/offline-pack";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// After a new app version is published, an already-open (or installed-PWA)
// session still references the previous build's hashed JS chunks. Navigating
// to a page it hasn't cached then fails with a dynamic-import error. The only
// correct recovery is a full reload to pick up the new build.
function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading chunk/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    if (isChunkLoadError(error)) {
      try {
        // At most one auto-reload per minute, so a genuinely broken deploy
        // shows the error UI instead of looping forever.
        const last = Number(window.sessionStorage.getItem("rce:chunk-reload") ?? 0);
        if (Date.now() - last > 60_000) {
          window.sessionStorage.setItem("rce:chunk-reload", String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        // sessionStorage unavailable — fall through to the error UI
      }
      return;
    }

    // Any other first-navigation failure (a loader that raced a cold start, a
    // dropped request on mobile data) recovers on a manual refresh, so do that
    // refresh automatically instead of dead-ending the rider. One silent retry
    // per route per minute, then a hard reload, then the error UI.
    let cancelled = false;
    const key = `rce:auto-retry:${window.location.pathname}`;
    let attempt = 0;
    try {
      const raw = window.sessionStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as { at: number; n: number }) : null;
      attempt = parsed && Date.now() - parsed.at < 60_000 ? parsed.n : 0;
      window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), n: attempt + 1 }));
    } catch {
      attempt = 0;
    }

    if (attempt === 0) {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        router.invalidate();
        reset();
      }, 350);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    if (attempt === 1) {
      window.location.reload();
    }
  }, [error, router, reset]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Rider Hub" },
      { title: "Red Cherry Events — Rider Hub" },
      { name: "description", content: "The rider hub for Red Cherry Events: race news, event info, live tracking, SOS and loyalty rewards." },
      { name: "author", content: "Red Cherry Events" },
      { property: "og:title", content: "Red Cherry Events — Rider Hub" },
      { property: "og:description", content: "News, events, live tracking and loyalty for Red Cherry riders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon-v2.png?v=2", type: "image/png" },
      { rel: "shortcut icon", href: "/favicon-v2.png?v=2", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest?v=2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-180-v2.png?v=2" },

    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const isAdmin = useRouterState({
    select: (s) => s.location.pathname.startsWith("/admin") || s.location.pathname.startsWith("/auth"),
  });
  // Embed routes render bare for third-party iframes: no shell, no assistant,
  // no prompts — just the embedded content.
  const isEmbed = useRouterState({
    select: (s) => s.location.pathname.startsWith("/embed"),
  });
  const onAuthPages = useRouterState({
    select: (s) =>
      s.location.pathname.startsWith("/auth") ||
      s.location.pathname.startsWith("/reset-password") ||
      s.location.pathname.startsWith("/embed") ||
      s.location.pathname.startsWith("/crew"),
  });


  usePageTracking();

  // Register the caching/push service worker so saved maps work with no signal.
  useEffect(() => {
    void ensureOfflineWorker();
  }, []);


  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Never call back into supabase (router loaders do) from inside this
      // callback — the auth client still holds its lock and the sign-in
      // promise deadlocks. Defer to the next tick.
      setTimeout(() => {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      {isAdmin ? (
        <>
          <Outlet />
          <AssistantWidget />
        </>
      ) : (
        <AppShell>
          <Outlet />
        </AppShell>
      )}
      {onAuthPages ? null : <SetPasswordPrompt />}
    </QueryClientProvider>
  );
}


