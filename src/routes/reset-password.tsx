import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/ui-bits";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password · Red Cherry Events" },
      { name: "description", content: "Choose a new password for your Red Cherry Events rider account." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/", replace: true }), 1200);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg ring-1 ring-border">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={48} />
          <h1 className="mt-3 font-display text-xl font-bold">Set a new password</h1>
        </div>
        {done ? (
          <p className="mt-5 rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
            Password updated. Taking you to the app…
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">New password</span>
              <input
                required
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl cherry-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Update password"}
            </button>
            {error ? <p className="text-center text-xs font-semibold text-cherry">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
