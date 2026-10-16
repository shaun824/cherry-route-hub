import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search["next"] === "string" && search["next"].startsWith("/") && !search["next"].startsWith("//") ? search["next"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset password · Red Cherry Events" },
      { name: "description", content: "Choose a new password for your Red Cherry Events rider account." },
      { property: "og:title", content: "Reset password · Red Cherry Events" },
      { property: "og:description", content: "Secure password recovery for your Red Cherry Events rider account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [accountEmail, setAccountEmail] = useState("");
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const verification = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let active = true;
    verification.current ??= (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const incomingToken = hash.get("access_token");
      // A failed recovery must never fall back to a different account already
      // signed in on this device. The auth client consumes implicit link tokens.
      if ([url.searchParams, hash].some((p) => p.has("error") || p.has("error_code") || p.has("error_description"))) return null;
      const tokenHash = url.searchParams.get("token_hash");
      if (tokenHash && url.searchParams.get("type") === "recovery") {
        const { error: tokenError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        url.searchParams.delete("token_hash");
        url.searchParams.delete("type");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
        if (tokenError) return null;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) return null;
      if (incomingToken && data.session.access_token !== incomingToken) return null;
      if (url.searchParams.has("code")) return null;
      const { data: identity, error: identityError } = await supabase.auth.getUser();
      return identityError ? null : identity.user?.email ?? null;
    })().catch(() => null);
    void verification.current.then((verifiedEmail) => {
      if (!active) return;
      setAccountEmail(verifiedEmail ?? "");
      setStatus(verifiedEmail ? "ready" : "invalid");
    });
    return () => { active = false; };
  }, []);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const redirect = new URL("/reset-password", window.location.origin);
      if (next) redirect.searchParams.set("next", next);
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect.href });
      if (sendError) throw sendError;
      setNotice("If an account exists for this email, a new link is on its way. Open the newest email’s link.");
    } catch {
      setError("We couldn’t send a new link just now. Please wait a minute and try again.");
    } finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "ready" || busy) return;
    if (password !== confirm) { setError("Those passwords don’t match."); return; }
    setBusy(true);
    setError(null);
    try {
      const { data, error: identityError } = await supabase.auth.getUser();
      if (identityError || !data.user || data.user.email !== accountEmail) {
        setStatus("invalid");
        setError("Your reset session has ended. Request a new link below.");
        return;
      }
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        if (err.status === 401 || err.status === 403 || /session|authorization|expired|jwt/i.test(err.message)) {
          setStatus("invalid");
          setError("Your reset session has ended. Request a new link below.");
        } else setError(err.message);
        return;
      }
      setDone(true);
      setTimeout(() => navigate({ to: next ?? "/", replace: true }), 1200);
    } catch {
      setError("We couldn’t update your password. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-secondary/40 px-6 py-8">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={48} />
          <h1 className="mt-3 font-display text-xl font-bold">Set a new password</h1>
        </div>
        {done ? (
          <p className="mt-5 rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
            Password updated. Taking you to the app…
          </p>
        ) : status === "checking" ? (
          <p role="status" className="mt-5 text-center text-sm text-muted-foreground">Checking your reset link…</p>
        ) : status === "invalid" ? (
          <form onSubmit={resend} className="mt-5 space-y-4">
            <p className="text-sm text-muted-foreground">This reset link is missing, expired or already used. Request a fresh link for the account you want to access.</p>
            <label className="block text-sm font-semibold">Account email
              <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base" />
            </label>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Send new reset link"}</Button>
            {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button variant="link" asChild className="w-full"><Link to="/auth">Back to sign in</Link></Button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <p className="break-all text-center text-sm text-muted-foreground">{accountEmail}</p>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">New password</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
              />
            </label>
            <label className="block text-sm font-semibold">Confirm password
              <input required type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base" />
            </label>
            <Button
              type="submit"
              disabled={busy}
              className="w-full"
            >
              {busy ? "Saving…" : "Update password"}
            </Button>
            {error ? <p className="text-center text-xs font-semibold text-cherry">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
