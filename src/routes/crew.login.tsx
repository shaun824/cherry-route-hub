// Dedicated sign-in door for on-site event crew. Same accounts as riders,
// but a focused entry point crew can bookmark on their phones.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { HardHat, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useIsCrew } from "@/lib/auth";
import { BrandMark } from "@/components/ui-bits";
import { loginIdentifierToEmail, isEmailAddress } from "@/lib/crew-username";

export const Route = createFileRoute("/crew/login")({
  // Shared links (e.g. the field build map) send crew here with ?next=… so a
  // sign-in lands straight on the page they were sent, not the dashboard.
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search["next"] === "string" ? (search["next"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Crew sign in · Red Cherry Events" },
      {
        name: "description",
        content: "Sign in to the Red Cherry Events crew dashboard to look up riders, rooming lists and the race village map.",
      },
      { property: "og:title", content: "Crew sign in · Red Cherry Events" },
      {
        property: "og:description",
        content: "On-site crew access to rider lookups, rooming lists and the village map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrewLoginPage,
});

function CrewLoginPage() {
  const { user, isCrew, loading } = useIsCrew();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const goOn = () => {
    if (safeNext) window.location.assign(safeNext);
    else void navigate({ to: "/crew" });
  };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && isCrew) goOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, isCrew, safeNext]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const loginEmail = loginIdentifierToEmail(identifier);
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setBusy(false);
    if (err) {
      setError(
        err.message === "Invalid login credentials"
          ? `That ${isEmailAddress(identifier) ? "email" : "username"} and password don't match.`
          : err.message,
      );
      return;
    }
    goOn();
  }

  async function google() {
    setError(null);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${safeNext ?? "/crew"}` });
    } catch {
      setError("Google sign-in didn't complete. Try your email and password.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-5 px-4 pb-10 pt-8">
      <header className="text-center">
        <BrandMark />
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-cherry/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cherry">
          <HardHat className="h-3.5 w-3.5" /> Crew access
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Crew sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Use your crew username (or your Red Cherry email) to open the crew dashboard.
        </p>
      </header>

      {user && !isCrew && !loading ? (
        <div className="rounded-2xl bg-secondary p-4 text-center text-sm text-ink-soft">
          You're signed in, but your account doesn't have crew access yet. Ask an admin to switch it on, then reload
          this page.
        </div>
      ) : null}

      <form onSubmit={signIn} className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Username or email</span>
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-cherry"
            placeholder="RedCherryCrew"
          />
          <span className="mt-1 block text-[11px] text-ink-soft">No email needed — your username works on its own.</span>
        </label>
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none focus:border-cherry"
          />
        </label>

        {error ? <p className="text-xs font-semibold text-cherry">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cherry px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Sign in
        </button>

        <button
          type="button"
          onClick={google}
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-ink"
        >
          Continue with Google
        </button>
      </form>

      <p className="text-center text-xs text-ink-soft">
        Not crew?{" "}
        <Link to="/auth" className="font-bold text-cherry">
          Rider sign in
        </Link>
      </p>
    </div>
  );
}
