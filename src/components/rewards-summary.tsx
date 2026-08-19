import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Sparkles, Ticket, Lock } from "lucide-react";
import { getMyLoyalty } from "@/lib/loyalty.functions";
import { formatPoints, tierFor } from "@/lib/loyalty";
import { LOYALTY_PUBLIC } from "@/lib/loyalty-visibility";
import { useIsAdmin } from "@/lib/auth";

/** Teaser shown to riders while Cherry Miles is still under wraps. */
function RewardsComingSoon() {
  return (
    <section className="mx-5 mt-4 overflow-hidden rounded-2xl bg-ink p-5 text-white shadow-lg">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
        <Sparkles className="h-3 w-3 text-cherry" /> Coming soon
      </span>
      <p className="mt-3 font-display text-2xl font-black leading-tight">Cherry Miles</p>
      <p className="mt-2 text-sm text-white/70">
        A loyalty programme that rewards you for every Red Cherry event you ride — points on every entry, and
        coupons you can cash out against future races. We're putting the finishing touches on it.
      </p>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/50">
        <Lock className="h-3 w-3" /> Your past events are already being counted.
      </p>
    </section>
  );
}

/** Live Cherry Miles snapshot for the profile page. */
export function RewardsSummary() {
  const { isAdmin } = useIsAdmin();
  const visible = LOYALTY_PUBLIC || isAdmin;

  const fetchLoyalty = useServerFn(getMyLoyalty);
  const { data, isLoading } = useQuery({
    queryKey: ["my-loyalty"],
    queryFn: () => fetchLoyalty({ data: {} } as never),
    enabled: visible,
  });


  const balance = data?.balance ?? 0;
  const { tier, next, toNext, progress } = useMemo(() => tierFor(balance), [balance]);

  const nextReward = useMemo(() => {
    const rewards = ((data?.rewards ?? []) as any[]).slice().sort((a, b) => a.cost_points - b.cost_points);
    return rewards.find((r) => r.cost_points > balance) ?? rewards[rewards.length - 1] ?? null;
  }, [data?.rewards, balance]);

  const affordable = ((data?.rewards ?? []) as any[]).filter((r) => balance >= r.cost_points).length;
  const liveCoupons = ((data?.coupons ?? []) as any[]).filter((c) => c.status !== "redeemed").length;

  if (isLoading) {
    return (
      <section className="mx-5 mt-4 rounded-2xl bg-ink p-5 text-white/70">
        <p className="text-sm">Loading your Cherry Miles…</p>
      </section>
    );
  }

  return (
    <section className="mx-5 mt-4 overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              {data?.settings?.programName ?? "Cherry Miles"}
            </p>
            <p className="font-display text-4xl font-black leading-none">{formatPoints(balance)}</p>
            <p className="mt-1 text-[11px] text-white/60">points balance</p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide"
            style={{ backgroundColor: tier.accent, color: "#141414" }}
          >
            {tier.name}
          </span>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-cherry" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-white/70">
            {next ? `${formatPoints(toNext)} points to ${next.name}` : "Top tier — you're a Red Cherry legend."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Cell label="Events" value={String(data?.participation?.length ?? 0)} />
          <Cell label="Rewards ready" value={String(affordable)} />
          <Cell label="Coupons" value={String(liveCoupons)} />
        </div>

        {!data?.linked ? (
          <p className="mt-4 rounded-xl bg-white/10 p-3 text-[11px] text-white/80">
            We haven't matched your rider record yet —{" "}
            <Link to="/my-events" className="underline">
              link your entries
            </Link>{" "}
            to claim points for every event you've ridden.
          </p>
        ) : nextReward ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 p-3 text-[11px] text-white/80">
            <Gift className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cherry" />
            {balance >= nextReward.cost_points ? (
              <span>
                You can cash out <strong className="text-white">{nextReward.name}</strong> right now.
              </span>
            ) : (
              <span>
                {formatPoints(nextReward.cost_points - balance)} more points unlocks{" "}
                <strong className="text-white">{nextReward.name}</strong>.
              </span>
            )}
          </p>
        ) : null}

        {data?.settings?.demoMode ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            <Sparkles className="h-3 w-3" /> Demo mode
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-px bg-white/10">
        <Link to="/rewards" className="flex items-center justify-center gap-1.5 bg-ink py-3 text-xs font-bold">
          <Gift className="h-3.5 w-3.5 text-cherry" /> Rewards
        </Link>
        <Link to="/rewards" className="flex items-center justify-center gap-1.5 bg-ink py-3 text-xs font-bold">
          <Ticket className="h-3.5 w-3.5 text-cherry" /> My coupons
        </Link>
      </div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 py-2">
      <p className="font-display text-lg font-black leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}
