// Clear an SOS: admins must write a short incident report before it closes.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { resolveSosAlert } from "@/lib/tracking.functions";

export function ResolveSosButton({ id, onDone, label = "Clear SOS" }: { id: string; onDone?: () => void; label?: string }) {
  const resolve = useServerFn(resolveSosAlert);
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-secondary-foreground"
      >
        {label}
      </button>
    );

  return (
    <div className="w-full space-y-1.5 rounded-lg bg-secondary/60 p-2">
      <label className="block text-[11px] font-bold text-ink">
        Incident report
        <textarea
          autoFocus
          value={report}
          onChange={(e) => setReport(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="What happened, what help was given, and the outcome"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-normal"
        />
      </label>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={busy || report.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            try {
              await resolve({ data: { id, incidentReport: report.trim() } });
              toast.success("SOS cleared and incident report saved");
              setOpen(false);
              onDone?.();
            } catch (e) {
              toast.error((e as Error).message || "Couldn't clear the SOS");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md bg-cherry px-2.5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save & clear"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 text-xs font-semibold text-ink-soft">
          Cancel
        </button>
      </div>
    </div>
  );
}
