import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Info, HelpCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { lookupEntryEmail } from "@/lib/id-lookup.functions";
import { checkAccountExists } from "@/lib/account-check.functions";
import { linkMyEntry } from "@/lib/roster.functions";

import { useSession } from "@/lib/auth";
import { BrandMark } from "@/components/ui-bits";


const searchSchema = z.object({ next: z.string().optional() });

/**
 * Where we stash the ID number until a session exists (email confirmation flow).
 * sessionStorage only, and cleared the moment the entry is linked.
 */
const PENDING_ID_KEY = "rce:pending-id-link";
const PENDING_NAME_KEY = "rce:pending-id-name";

function readPending(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePending(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_ID_KEY);
    sessionStorage.removeItem(PENDING_NAME_KEY);
    // Legacy: earlier builds stored this in localStorage.
    localStorage.removeItem(PENDING_ID_KEY);
  } catch {
    /* ignore */
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Create your Rider Hub account · Red Cherry Events" },
      {
        name: "description",
        content:
          "Create a Red Cherry Events Rider Hub account with your ID number to link your Entry Ninja entries, or sign in if you already have one.",
      },
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
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [noAccount, setNoAccount] = useState(false);
  const [hasEntries, setHasEntries] = useState(false);
  const checkAccount = useServerFn(checkAccountExists);
  const linkEntry = useServerFn(linkMyEntry);
  const linkedRef = useRef(false);


  const target = next && next.startsWith("/") ? next : "/";

  // Once a session exists, claim any entries matching the ID number they gave
  // at sign-up, then continue into the app.
  useEffect(() => {
    if (loading || !user) return;
    if (linkedRef.current) {
      return;
    }
    linkedRef.current = true;
    const pending = readPending(PENDING_ID_KEY);
    const pendingName = readPending(PENDING_NAME_KEY) ?? "";
    const go = () => navigate({ to: target, replace: true });
    if (!pending) {
      clearPending();
      go();
      return;
    }
    void linkEntry({ data: { id_number: pending, surname: pendingName } })
      .catch(() => null)
      .finally(() => {
        clearPending();
        go();
      });
  }, [loading, user, target, navigate, linkEntry]);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "signup" && idNumber.trim().length >= 4) {
      writePending(PENDING_ID_KEY, idNumber.trim());
      writePending(PENDING_NAME_KEY, fullName.trim());
    }
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
    setNoAccount(false);
    try {
      if (mode === "reset") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setNotice("Check your inbox for a password reset link.");
      } else if (mode === "signup") {
        writePending(PENDING_ID_KEY, idNumber.trim());
        writePending(PENDING_NAME_KEY, fullName.trim());
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (err) throw err;
        // Supabase returns a user with no identities when the email is already
        // registered — no email is sent, so don't tell them to check their inbox.
        const alreadyRegistered =
          !data.session && (data.user?.identities?.length ?? 0) === 0;
        if (alreadyRegistered) {
          setMode("signin");
          setError(
            "You already have an account with this email. Sign in below, or use \"Forgot password?\" to reset it.",
          );
        } else if (!data.session) {
          setNotice(
            "Almost there — check your email to confirm your account, then sign in and we'll link your entries.",
          );
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) {
          // Entry Ninja logins don't exist here — tell them to create an account
          // rather than leaving them stuck on "invalid credentials".
          if (/invalid login credentials/i.test(err.message)) {
            try {
              const res = await checkAccount({ data: { email: email.trim() } });
              if (!res.hasAccount) {
                setNoAccount(true);
                setHasEntries(res.hasEntries);
                return;
              }
            } catch {
              /* fall through to the normal error */
            }
          }
          throw err;
        }
      }
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-6 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={56} />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">Red Cherry Events</p>
          <h1 className="font-display text-2xl font-bold">
            {isSignup ? "Create your Rider Hub account" : mode === "reset" ? "Reset your password" : "Sign in"}
          </h1>
        </div>

        {isSignup ? (
          <div className="mt-4 flex gap-2 rounded-2xl bg-accent/60 p-3 text-left ring-1 ring-border">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
            <p className="text-[12px] leading-snug text-ink">
              <span className="font-bold">New here? Create an account — it takes a minute.</span> Use your
              ID number and the email you entered with on Entry Ninja so we can link your events.
            </p>
          </div>
        ) : null}

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-secondary disabled:opacity-60"
        >
          <GoogleIcon />
          {isSignup ? "Sign up with Google" : "Continue with Google"}
        </button>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">or use email</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3" method="post" action="#">
          {isSignup ? (
            <>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Full name</span>
                <input
                  required
                  id="full-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Name and surname"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  ID / passport number
                </span>
                <input
                  required
                  id="id-number"
                  name="id-number"
                  type="text"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={50}
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="As entered on Entry Ninja"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-[11px] leading-snug text-ink-soft">
                  This is how we match you to your Entry Ninja entries. We never store your ID
                  number — only a scrambled version of it that can't be read back.
                </span>
              </label>
            </>
          ) : null}

          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Email</span>
            <input
              required
              id="email"
              name="email"
              type="email"
              /* username + email so Chrome / Google Password Manager offers saved logins */
              autoComplete="username email"
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
                id={isSignup ? "new-password" : "current-password"}
                name="password"
                type="password"
                minLength={6}
                autoComplete={isSignup ? "new-password" : "current-password"}
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
              : isSignup
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
          </button>
        </form>

        {noAccount ? (
          <div className="mt-3 rounded-xl bg-accent p-3 text-[12px] leading-snug text-cherry-deep ring-1 ring-border">
            <p className="font-bold">You don't have a Rider Hub account yet.</p>
            <p className="mt-1">
              Your Entry Ninja email and password only work on Entry Ninja. Create a Rider Hub
              account with this email — {hasEntries
                ? "we can already see entries under it, so your events will link up automatically."
                : "your ID number will link your entries."}
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setNoAccount(false);
                setError(null);
              }}
              className="mt-2 w-full rounded-lg cherry-gradient py-2 text-xs font-bold text-white"
            >
              Create an account with {email.trim() || "this email"}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-center text-xs font-semibold text-cherry">{error}</p> : null}

        {notice ? (
          <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
            {notice}
          </p>
        ) : null}

        {isSignup ? (
          <p className="mt-4 border-t border-border pt-3 text-center text-[11px] font-semibold text-ink-soft">
            Already have an account?{" "}
            <button
              type="button"
              className="font-bold text-cherry underline"
              onClick={() => { setMode("signin"); setError(null); setNotice(null); }}
            >
              Sign in
            </button>
          </p>
        ) : (
          <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-ink-soft">
            <button type="button" className="underline" onClick={() => { setMode("signup"); setError(null); setNotice(null); }}>
              ← Create an account
            </button>
            {mode === "signin" ? (
              <button type="button" className="underline" onClick={() => { setMode("reset"); setError(null); setNotice(null); }}>
                Forgot password?
              </button>
            ) : (
              <button type="button" className="underline" onClick={() => { setMode("signin"); setError(null); setNotice(null); }}>
                Back to sign in
              </button>
            )}
          </div>
        )}

        <FindMyEmail />



        <p className="mt-5 text-center text-[11px] text-ink-soft">
          By continuing you agree to Red Cherry Events'{" "}
          <Link to="/" className="underline">terms</Link>.
        </p>
      </div>
    </div>
  );
}


function FindMyEmail() {
  const lookup = useServerFn(lookupEntryEmail);
  const [open, setOpen] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [result, setResult] = useState<{ found: boolean; needsEmail: boolean; emails: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await lookup({ data: { id_number: idNumber.trim() } });
      setResult({ found: res.found, needsEmail: res.needsEmail, emails: res.emails });
    } catch {
      setErr("Couldn't check that right now. Please try again.");
    } finally {
      setBusy(false);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 3000);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-soft underline"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Not sure which email you used?
      </button>

      {open ? (
        <form onSubmit={handleLookup} className="mt-3 space-y-2 rounded-xl bg-secondary/60 p-3 ring-1 ring-border">
          <p className="text-[11px] leading-snug text-ink-soft">
            Enter the ID number you entered with and we'll show a hidden version of the email on your entry.
          </p>
          <input
            required
            minLength={6}
            inputMode="numeric"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="ID number"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || cooldown}
            className="w-full rounded-lg border border-border bg-card py-2 text-xs font-bold text-ink disabled:opacity-60"
          >
            {busy ? "Checking…" : cooldown ? "Please wait…" : "Find my email"}
          </button>

          {err ? <p className="text-[11px] font-semibold text-cherry">{err}</p> : null}

          {result ? (
            result.found ? (
              <div className="rounded-lg bg-accent px-3 py-2 text-[11px] text-cherry-deep">
                <p className="font-bold">
                  {result.emails.length > 1 ? "We found these entries:" : "We have an entry under:"}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {result.emails.map((e) => (
                    <li key={e} className="font-mono text-[12px]">{e}</li>
                  ))}
                </ul>
                <p className="mt-1">Sign in with that address above.</p>
              </div>
            ) : result.needsEmail ? (
              <div className="rounded-lg bg-accent px-3 py-2 text-[11px] text-cherry-deep">
                <p className="font-bold">We found your entry, but no email on file.</p>
                <p className="mt-1">
                  Create an account above with any email you use, then go to Adventure Awaits and link your
                  entry with this ID number — we'll save that email to your entry.
                </p>
              </div>
            ) : (
              <p className="rounded-lg bg-card px-3 py-2 text-[11px] text-ink-soft ring-1 ring-border">
                No entry found for that ID number. Double-check the number, or contact us and we'll help.
              </p>
            )

          ) : null}
        </form>
      ) : null}
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
