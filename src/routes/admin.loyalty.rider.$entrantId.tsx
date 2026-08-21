import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Coins, Mail, Phone, Ticket, Trophy } from "lucide-react";
import { adjustRiderPoints, getLoyaltyRider } from "@/lib/loyalty.functions";
import { formatPoints, tierFor } from "@/lib/loyalty";
import { paymentStatus } from "@/lib/payment-status";

export const Route = createFileRoute("/admin/loyalty/rider/$entrantId")({
  component: LoyaltyRider,
});

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function LoyaltyRider() {
  const { entrantId } = Route.useParams();
  const load = useServerFn(getLoyaltyRider);
  const adjust = useServerFn(adjustRiderPoints);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-loyalty-rider", entrantId],
    queryFn: () => load({ data: { entrantId } }),
  });

  const adjustMut = useMutation({
    mutationFn: (v: { points: number; reason: string }) => adjust({ data: { entrantId, ...v } }),
    onSuccess: () => {
      toast.success("Points adjusted");
      void qc.invalidateQueries({ queryKey: ["admin-loyalty-rider", entrantId] });
      void qc.invalidateQueries({ queryKey: ["admin-loyalty"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-ink-soft">Loading rider…</p>;
  if (error) return <p className="text-sm text-ink-soft">{(error as Error).message}</p>;
  if (!data) return <p className="text-sm text-ink-soft">Rider not found.</p>;

  const { tier } = tierFor(data.balance);
  const name = data.entrant['full_name'] ?? "Unnamed rider";

  return (
    <div className="space-y-5">
      <Link
        to="/admin/loyalty"
        className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-cherry"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to loyalty
      </Link>

      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{name}</h1>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {data.entrant['email'] ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {data.entrant['phone'] ?? data.profile?.['phone'] ?? "—"}
              </span>
              <span>ID ending {data.entrant['id_number_last4'] ?? "—"}</span>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {data.entrant['user_id'] ? "Has an app account" : "No app account yet"} · On roster since{" "}
              {fmtDate(data.entrant['created_at'])}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.entrant['user_id'] ? (
              <Link
                to="/admin/rider/$userId"
                params={{ userId: String(data.entrant['user_id']) }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
              >
                App profile
              </Link>
            ) : null}
            <button
              className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              disabled={adjustMut.isPending}
              onClick={() => {
                const raw = window.prompt(`Adjust points for ${name} (use -100 to deduct)`, "100");
                if (!raw) return;
                const points = Math.trunc(Number(raw));
                if (!Number.isFinite(points) || points === 0) return;
                const reason = window.prompt("Reason for the adjustment", "Manual admin adjustment") ?? "Manual";
                adjustMut.mutate({ points, reason });
              }}
            >
              Adjust points
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Coins} label="Balance" value={formatPoints(data.balance)} />
        <Kpi icon={Trophy} label="Earned" value={formatPoints(data.earned)} />
        <Kpi icon={Ticket} label="Spent" value={formatPoints(data.spent)} />
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Tier</p>
          <span
            className="mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-black uppercase"
            style={{ backgroundColor: `${tier.accent}22`, color: tier.accent }}
          >
            {tier.name}
          </span>
          <p className="mt-1 text-[11px] text-ink-soft">{tier.perk}</p>
        </div>
      </div>

      <Section title={`Events entered (${data.entries.length})`}>
        {data.entries.length === 0 ? (
          <Empty>No event entries on our roster.</Empty>
        ) : (
          <ul className="space-y-2">
            {data.entries.map((e) => {
              const ps = paymentStatus(e as never);
              return (
                <li key={String(e['id'])} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-semibold">{e['event']?.name ?? "Event"}</p>
                  <p className="text-xs text-ink-soft">
                    {fmtDate(e['event']?.event_date)} · {e['category'] ?? "—"} · Batch {e['batch'] ?? "—"} · Bib{" "}
                    {e['bib_number'] ?? "—"}
                    {e['team_name'] ? ` · Team ${e['team_name']}` : ""}
                  </p>
                  {ps ? <p className="mt-1 text-[11px] font-bold text-ink-soft">{ps.label}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={`Loyalty history (${data.participation.length})`}>
        {data.participation.length === 0 ? (
          <Empty>No participation credited yet.</Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.participation.map((p) => (
              <li key={String(p['id'])} className="flex items-center justify-between py-2">
                <span className="font-semibold">{p['event_name']}</span>
                <span className="text-xs text-ink-soft">
                  {fmtDate(p['event_date'])} · {p['category'] ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Points ledger (${data.ledger.length})`}>
        {data.ledger.length === 0 ? (
          <Empty>No ledger entries yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="pb-2">Reason</th>
                <th className="pb-2">Type</th>
                <th className="pb-2 text-right">Points</th>
                <th className="pb-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((l) => (
                <tr key={String(l['id'])} className="border-t border-border">
                  <td className="py-2 pr-3">{l['reason']}</td>
                  <td className="py-2 capitalize text-ink-soft">{l['kind']}</td>
                  <td
                    className={`py-2 text-right font-bold ${Number(l['points']) < 0 ? "text-cherry" : "text-ink"}`}
                  >
                    {Number(l['points']) > 0 ? "+" : ""}
                    {formatPoints(Number(l['points']))}
                  </td>
                  <td className="py-2 text-right text-xs text-ink-soft">{fmtDate(l['created_at'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Coupons (${data.coupons.length})`}>
        {data.coupons.length === 0 ? (
          <Empty>No coupons issued.</Empty>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.coupons.map((c) => (
              <li key={String(c['id'])} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-mono font-bold">{c['code']}</span>{" "}
                  <span className="text-ink-soft">{c['reward_name']}</span>
                </span>
                <span className="text-xs text-ink-soft">
                  {formatPoints(Number(c['points_spent'] ?? 0))} pts · {c['status']} · {fmtDate(c['created_at'])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <Icon className="h-4 w-4 text-cherry" />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="font-display text-2xl font-black">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-soft">{children}</p>;
}
