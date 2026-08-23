// Multi-person registrations (teams / group entries) pay as one Entry Ninja
// registration, so riders need the whole group's total — not just their own
// line — plus how much of it has already been settled.
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, ExternalLink, Users } from "lucide-react";
import { fetchMyEntryGroup } from "@/lib/my-events";
import { formatRands } from "@/lib/payment-status";

export function GroupPaymentCard({
  eventId,
  entryUrl = null,
}: {
  eventId: string;
  entryUrl?: string | null;
}) {
  const q = useQuery({
    queryKey: ["entry-group", eventId],
    queryFn: () => fetchMyEntryGroup(eventId),
    staleTime: 60_000,
  });

  const group = q.data;
  if (!group || group.dueCents <= 0) return null;

  const settled = group.outstandingCents <= 0;
  const tone = settled
    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
    : "bg-amber-50 text-amber-900 ring-amber-200";
  const Icon = settled ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`mt-3 rounded-xl px-3 py-2.5 ring-1 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            {settled
              ? "Group entry fully paid"
              : `Group balance outstanding: ${formatRands(group.outstandingCents)}`}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
            <Users className="h-3 w-3" /> {group.members.length} riders on registration{" "}
            {group.groupRef}
          </p>

          <ul className="mt-2 space-y-0.5 border-t border-current/15 pt-2 text-[11px]">
            {group.members.map((m, i) => (
              <li key={`${m.full_name}-${i}`} className="flex justify-between gap-3">
                <span className="truncate opacity-90">
                  {m.full_name}
                  {m.is_me ? " (you)" : ""}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {m.amount_due_cents != null ? formatRands(m.amount_due_cents) : "—"}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 space-y-0.5 border-t border-current/15 pt-2 text-[11px] font-semibold">
            <p className="flex justify-between gap-3">
              <span>Group total</span>
              <span className="tabular-nums">{formatRands(group.dueCents)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span>Paid</span>
              <span className="tabular-nums">{formatRands(group.paidCents)}</span>
            </p>
          </div>

          {!group.complete ? (
            <p className="mt-1 text-[10px] opacity-70">
              Some riders on this registration aren't priced yet, so the total may be higher.
            </p>
          ) : null}

          {!settled && entryUrl ? (
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
