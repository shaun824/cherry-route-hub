// Shows the rider's Entry Ninja payment confirmation: fully paid, or the
// balance still owed.
import { CheckCircle2, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { formatRands, paymentStatus, type PaymentInfo } from "@/lib/payment-status";
import type { PricedLine } from "@/lib/entry-pricing";

export function PaymentStatusCard({
  info,
  entryUrl = null,
  compact = false,
  lines = [],
}: {
  info: PaymentInfo | null | undefined;
  entryUrl?: string | null;
  compact?: boolean;
  /** Optional breakdown of what makes up the amount (entry + extras). */
  lines?: PricedLine[];
}) {
  const status = paymentStatus(info);
  if (!status) return null;

  const tone =
    status.state === "paid"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : status.state === "outstanding"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-secondary text-ink-soft ring-border";
  const Icon =
    status.state === "paid" ? CheckCircle2 : status.state === "outstanding" ? AlertTriangle : Clock;

  return (
    <div className={`mt-3 rounded-xl px-3 py-2.5 ring-1 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold">{status.label}</p>
          {!compact && status.detail ? (
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">{status.detail}</p>
          ) : null}
          {!compact && status.state === "outstanding" && lines.length > 0 ? (
            <ul className="mt-2 space-y-0.5 border-t border-current/15 pt-2 text-[11px]">
              {lines.map((l, i) => (
                <li key={`${l.label}-${i}`} className="flex justify-between gap-3">
                  <span className="truncate opacity-90">
                    {l.label}
                    {l.qty > 1 ? ` x${l.qty}` : ""}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatRands(l.totalCents)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {status.state === "outstanding" && entryUrl ? (
            <a
              href={entryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold underline"
            >
              Settle on Entry Ninja <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
