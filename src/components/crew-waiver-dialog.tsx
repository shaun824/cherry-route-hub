// Liability waiver a crew member must accept before their department's
// instructions unlock. Acceptance is recorded once per event.
import { useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { DEFAULT_WAIVER, acceptWaiver } from "@/lib/run-sheet";

export function CrewWaiverDialog({
  userId,
  eventId,
  eventName,
  departmentId,
  defaultName,
  waiverText,
  onAccepted,
}: {
  userId: string;
  eventId: string;
  eventName: string;
  departmentId: string | null;
  defaultName?: string;
  waiverText?: string | null;
  onAccepted: () => void;
}) {
  const [fullName, setFullName] = useState(defaultName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!fullName.trim() || !agreed) return;
    setBusy(true);
    setError(null);
    try {
      await acceptWaiver({ userId, eventId, departmentId, fullName: fullName.trim() });
      onAccepted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-base font-bold">Crew waiver</h2>
            <p className="text-xs text-ink-soft">{eventName}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ink-soft">
          {(waiverText?.trim() || DEFAULT_WAIVER).split("\n\n").map((p, i) => (
            <p key={i} className="mb-3 whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <div className="space-y-3 border-t border-border px-5 py-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground"
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>I have read and accept this waiver.</span>
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <button
            type="button"
            onClick={submit}
            disabled={!fullName.trim() || !agreed || busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Accept and continue
          </button>
        </div>
      </div>
    </div>
  );
}
