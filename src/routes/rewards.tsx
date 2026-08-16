import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, Copy, Gift, History, Sparkles, Ticket, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { getMyLoyalty, redeemReward } from "@/lib/loyalty.functions";
import { formatPoints, tierFor, TIERS } from "@/lib/loyalty";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Cherry Miles Rewards · Red Cherry Events" },
      {
        name: "description",
        content: "Earn Cherry Miles for every Red Cherry event you ride and cash them out for entry discounts and kit upgrades.",
      },
      { property: "og:title", content: "Cherry Miles Rewards · Red Cherry Events" },
      { property: "og:description", content: "Your loyalty points, tier and reward coupons for Red Cherry Events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const fetchLoyalty = useServerFn(getMyLoyalty);
  const redeem = useServerFn(redeemReward);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"rewards" | "history" | "coupons">("rewards");

  const { data, isLoading } = useQuery({
    queryKey: ["my-loyalty"],
    queryFn: () => fetchLoyalty({ data: {} } as never),
  });

  const redeemMut = useMutation({
    mutationFn: (rewardId: string) => redeem({ data: { rewardId } }),
    onSuccess: (res: any) => {
      if (!res?.ok) {
        toast.error(res?.error ?? "Could not cash out those points.");
        return;
      }
      toast.success(`Coupon ${res.coupon.code} is ready`);
      setTab("coupons");
      void qc.invalidateQueries({ queryKey: ["my-loyalty"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const balance = data?.balance ?? 0;
  const { tier, next, toNext, progress } = useMemo(() => tierFor(balance), [balance]);

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-ink-soft">Loading your rewards…</div>;
  }

  const settings = data?.settings;

  return (
    <div className="space-y-5 px-4 pb-28 pt-4">
      <header>
        <h1 className="font-display text-2xl font-black">{settings?.programName ?? "Cherry Miles"}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every Red Cherry event you ride earns points. Cash them out for entry discounts and upgrades.
        </p>
        {settings?.demoMode ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
            <Sparkles className="h-3.5 w-3.5" /> Demo mode — values are provisional
          </p>
        ) : null}
      </header>

      {/* Balance card */}
      <section className="rounded-3xl bg-ink p-5 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Points balance</p>
            <p className="font-display text-5xl font-black leading-none">{formatPoints(balance)}</p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide"
            style={{ backgroundColor: tier.accent, color: "#141414" }}
          >
            {tier.name}
          </span>
        </div>
        <p className="mt-3 text-xs text-white/70">{tier.perk}</p>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-cherry" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-white/70">
            {next ? `${formatPoints(toNext)} points to ${next.name}` : "Top tier — you're a Red Cherry legend."}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
          <Stat label="Events" value={String(data?.participation.length ?? 0)} />
          <Stat label="Earned" value={formatPoints(data?.earned ?? 0)} />
          <Stat label="Spent" value={formatPoints(data?.spent ?? 0)} />
        </div>
      </section>

      {!data?.linked ? (
        <div className="rounded-2xl bg-accent p-4 text-sm">
          <p className="font-semibold">We haven't matched your rider record yet.</p>
          <p className="mt-1 text-ink-soft">
            Link your entries with your ID number so we can credit every event you've ridden.
          </p>
          <Link to="/my-events" className="mt-3 inline-block rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white">
            Link my entries
          </Link>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["rewards", "Rewards", Gift],
            ["history", "History", History],
            ["coupons", "My coupons", Ticket],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition ${
              tab === key ? "bg-card text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "rewards" ? (
        <section className="space-y-3">
          {(data?.rewards ?? []).map((r: any) => {
            const affordable = balance >= r.cost_points;
            return (
              <article key={r.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold">{r.name}</h3>
                    <p className="mt-1 text-xs text-ink-soft">{r.description}</p>
                    {r.terms ? <p className="mt-1 text-[11px] text-ink-soft/80">{r.terms}</p> : null}
                  </div>
                  {r.value_label ? (
                    <span className="shrink-0 rounded-lg bg-accent px-2 py-1 text-xs font-black text-cherry-deep">
                      {r.value_label}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-soft">{formatPoints(r.cost_points)} pts</span>
                  <button
                    disabled={!affordable || redeemMut.isPending}
                    onClick={() => redeemMut.mutate(r.id)}
                    className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {affordable ? "Cash out" : `Need ${formatPoints(r.cost_points - balance)} more`}
                  </button>
                </div>
              </article>
            );
          })}
          <TierLadder balance={balance} />
        </section>
      ) : null}

      {tab === "history" ? (
        <section className="space-y-2">
          {(data?.ledger ?? []).length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-ink-soft ring-1 ring-border">
              No points activity yet — your first event will show up here.
            </p>
          ) : null}
          {(data?.ledger ?? []).map((l: any) => (
            <div key={l.id} className="flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-border">
              <div>
                <p className="text-sm font-semibold">{l.reason || (l.points > 0 ? "Points earned" : "Points spent")}</p>
                <p className="text-[11px] text-ink-soft">{new Date(l.created_at).toLocaleDateString("en-ZA")}</p>
              </div>
              <span className={`text-sm font-black ${l.points > 0 ? "text-emerald-600" : "text-cherry"}`}>
                {l.points > 0 ? "+" : ""}
                {formatPoints(l.points)}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "coupons" ? (
        <section className="space-y-3">
          {(data?.coupons ?? []).length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-sm text-ink-soft ring-1 ring-border">
              No coupons yet. Cash out points from the Rewards tab.
            </p>
          ) : null}
          {(data?.coupons ?? []).map((c: any) => (
            <article key={c.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{c.reward_name}</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                    c.status === "redeemed" ? "bg-secondary text-ink-soft" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(c.code);
                  toast.success("Coupon code copied");
                }}
                className="mt-3 flex w-full items-center justify-between rounded-xl border border-dashed border-cherry bg-accent px-3 py-2"
              >
                <span className="font-mono text-base font-black tracking-widest text-cherry-deep">{c.code}</span>
                <Copy className="h-4 w-4 text-cherry" />
              </button>
              <p className="mt-2 text-[11px] text-ink-soft">
                {formatPoints(c.points_spent)} pts ·{" "}
                {c.expires_at ? `valid until ${new Date(c.expires_at).toLocaleDateString("en-ZA")}` : "no expiry"}
              </p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 py-2">
      <p className="font-display text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}

function TierLadder({ balance }: { balance: number }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h3 className="flex items-center gap-2 font-display text-sm font-bold">
        <Award className="h-4 w-4 text-cherry" /> Tiers
      </h3>
      <ul className="mt-3 space-y-2">
        {TIERS.map((t) => {
          const reached = balance >= t.min;
          return (
            <li key={t.key} className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: reached ? t.accent : "#D7D7D7" }} />
              <div>
                <p className={`text-sm font-bold ${reached ? "text-ink" : "text-ink-soft"}`}>
                  {t.name} <span className="text-[11px] font-medium text-ink-soft">· {formatPoints(t.min)} pts</span>
                </p>
                <p className="text-[11px] text-ink-soft">{t.perk}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-soft">
        <TrendingUp className="h-3.5 w-3.5" /> Ride more events in a row to earn returning-rider bonus points.
      </p>
    </div>
  );
}
