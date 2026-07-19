import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/auth";
import { BrandMark } from "@/components/ui-bits";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · Red Cherry Events" },
      { name: "description", content: "Sign in to Red Cherry Events with Google." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useSession();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = next && next.startsWith("/") ? next : "/";

  useEffect(() => {
    if (!loading && user) navigate({ to: target, replace: true });
  }, [loading, user, target, navigate]);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      setError(result.error.message || "Sign in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: target, replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={56} />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Red Cherry Events</p>
          <h1 className="font-display text-2xl font-bold">Sign in to the Rider Hub</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Use your Google account. Admin access is granted by invitation.
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-secondary disabled:opacity-60"
        >
          <GoogleIcon />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>

        {error ? <p className="mt-3 text-center text-xs text-cherry">{error}</p> : null}

        <p className="mt-6 text-center text-[11px] text-ink-soft">
          By continuing you agree to Red Cherry Events'{" "}
          <Link to="/" className="underline">terms</Link>.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.25 1.4-1.66 4-5.5 4-3.3 0-6-2.75-6-6.1s2.7-6.1 6-6.1c1.9 0 3.15.8 3.87 1.5l2.65-2.55C16.9 3.15 14.7 2.1 12 2.1 6.9 2.1 2.8 6.2 2.8 11.3s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-8.95 0-.6-.05-1.05-.15-1.35H12z"/>
    </svg>
  );
}
