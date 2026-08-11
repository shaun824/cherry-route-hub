import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Info, HelpCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { lookupEntryEmail } from "@/lib/id-lookup.functions";
import { useSession } from "@/lib/auth";
import { BrandMark } from "@/components/ui-bits";


const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · Red Cherry Events" },
      { name: "description", content: "Sign in to Red Cherry Events with Google or your Entry Ninja email address." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

function AuthPage() {
  const { user, loading } = useSession();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const target = next && next.startsWith("/") ? next : "/";

  useEffect(() => {
    if (!loading && user) navigate({ to: target, replace: true });
  }, [loading, user, target, navigate]);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setNotice(null);
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

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "reset") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setNotice("Check your inbox for a password reset link.");
      } else if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (!data.session) {
          setNotice("Almost there — check your email to confirm your account, then sign in.");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={56} />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Red Cherry Events</p>
          <h1 className="font-display text-2xl font-bold">Sign in to the Rider Hub</h1>
        </div>

        <div className="mt-4 flex gap-2 rounded-2xl bg-accent/60 p-3 text-left ring-1 ring-border">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
          <p className="text-[12px] leading-snug text-ink">
            <span className="font-bold">Use the same details you entered with on Entry Ninja.</span>{" "}
            Matching your Entry Ninja email is how we link you to your events.
          </p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-secondary disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">or use email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          {mode !== "reset" ? (
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Password</span>
              <input
                required
                type="password"
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl cherry-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
          </button>
        </form>

        {error ? <p className="mt-3 text-center text-xs font-semibold text-cherry">{error}</p> : null}
        {notice ? (
          <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
            {notice}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-ink-soft">
          {mode === "signin" ? (
            <>
              <button type="button" className="underline" onClick={() => { setMode("signup"); setError(null); setNotice(null); }}>
                Create an account
              </button>
              <button type="button" className="underline" onClick={() => { setMode("reset"); setError(null); setNotice(null); }}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" className="underline" onClick={() => { setMode("signin"); setError(null); setNotice(null); }}>
              ← Back to sign in
            </button>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-ink-soft">
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
