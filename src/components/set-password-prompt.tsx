/**
 * After a rider signs in (usually with Google), ask them once to set an app
 * password so they can sign in with email + password next time — and let the
 * browser/keychain save it.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const SKIP_KEY = "rce:skip-set-password";

function hasPassword(user: { identities?: { provider: string }[] | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return true;
  if (user.user_metadata?.["password_set"] === true) return true;
  return (user.identities ?? []).some((i) => i.provider === "email");
}

async function saveToKeychain(email: string, password: string) {
  try {
    const w = window as unknown as {
      PasswordCredential?: new (d: { id: string; password: string; name?: string }) => Credential;
    };
    if (w.PasswordCredential && navigator.credentials?.store) {
      await navigator.credentials.store(new w.PasswordCredential({ id: email, password, name: email }));
    }
  } catch {
    /* browsers without the Credential Management API fall back to the form prompt */
  }
}

export function SetPasswordPrompt() {
  const { user, loading } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setOpen(false);
      return;
    }
    if (hasPassword(user)) {
      setOpen(false);
      return;
    }
    let skipped = false;
    try {
      skipped = sessionStorage.getItem(SKIP_KEY) === "1";
    } catch {
      /* ignore */
    }
    setOpen(!skipped);
  }, [user, loading]);

  if (!open || !user?.email) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await saveToKeychain(user!.email!, password);
    setDone(true);
    setTimeout(() => setOpen(false), 1400);
  }

  function skip() {
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-[9998] grid place-items-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-card p-5 shadow-2xl ring-1 ring-border">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent text-cherry-deep">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold leading-tight">Set your password</h2>
            <p className="mt-1 text-[12px] leading-snug text-ink-soft">
              Add a password for <span className="font-semibold text-ink">{user.email}</span> so you can sign in
              without Google next time. Your device can save it to your keychain.
            </p>
          </div>
        </div>

        {done ? (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
            <ShieldCheck className="h-4 w-4" /> Password saved. You're all set.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input type="email" name="email" autoComplete="username" value={user.email} readOnly hidden />
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
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Confirm password</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base"
              />
            </label>
            {error ? <p className="text-xs font-semibold text-cherry">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl cherry-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save password"}
            </button>
            <button
              type="button"
              onClick={skip}
              className="w-full rounded-xl py-2 text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Not now
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
