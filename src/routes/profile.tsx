import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-bits";
import { currentRider, events, promos } from "@/lib/mock-data";
import { Award, Trophy, Zap, ChevronRight, Settings, Tag } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Loyalty — Red Cherry Events" },
      { name: "description", content: "Your Red Cherry rider profile, loyalty points and rewards." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const tierPct =
    (currentRider.points / (currentRider.points + currentRider.pointsToNext)) * 100;

  const entered = events.filter((e) => e.entered);

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle={`${currentRider.tier} member since ${currentRider.memberSince}`}
        right={
          <button className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-ink-soft">
            <Settings className="h-4.5 w-4.5" />
          </button>
        }
      />

      {/* Loyalty card */}
      <div className="mx-5 mt-4 overflow-hidden rounded-2xl cherry-gradient p-5 text-white shadow-lg shadow-cherry/25">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
              Red Cherry Loyalty
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{currentRider.tier}</p>
          </div>
          <Trophy className="h-8 w-8 opacity-90" />
        </div>
        <div className="mt-6">
          <p className="font-mono text-3xl font-bold tracking-tight">
            {currentRider.points.toLocaleString()}
          </p>
          <p className="text-xs opacity-85">Loyalty points</p>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: `${tierPct}%` }} />
          </div>
          <p className="mt-2 text-[11px] opacity-85">
            {currentRider.pointsToNext} pts to <b>{currentRider.nextTier}</b>
          </p>
        </div>
      </div>

      {/* Identity + Entry Ninja stub */}
      <div className="mx-5 mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent font-display text-lg font-bold text-cherry-deep">
            {currentRider.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display font-bold text-ink">{currentRider.name}</p>
            <p className="truncate text-xs text-muted-foreground">{currentRider.handle}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-secondary p-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Events
            </dt>
            <dd className="mt-0.5 font-display text-lg font-bold text-ink">
              {currentRider.eventsCompleted}
            </dd>
          </div>
          <div className="rounded-xl bg-secondary p-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Entered
            </dt>
            <dd className="mt-0.5 font-display text-lg font-bold text-ink">{entered.length}</dd>
          </div>
          <div className="rounded-xl bg-secondary p-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Streak
            </dt>
            <dd className="mt-0.5 font-display text-lg font-bold text-ink">4</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-border p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Entry Ninja
            </p>
            <p className="truncate font-mono text-xs text-ink-soft">
              {currentRider.entryNinjaUserId ?? "not linked"}
            </p>
          </div>
          <button className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-bold text-white">
            Sync
          </button>
        </div>
      </div>

      {/* Rewards */}
      <div className="px-5 pt-6">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
          Rewards unlocked
        </h2>
        <ul className="mt-3 space-y-2">
          {[
            { icon: Award, title: "Priority start pen", meta: "Gold tier perk" },
            { icon: Zap, title: "10% off next entry", meta: "Redeem before 31 Aug" },
            { icon: Trophy, title: "Free finisher kit upgrade", meta: "3 events completed" },
          ].map((r, i) => {
            const Icon = r.icon;
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-cherry-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.meta}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Promos shortcut */}
      <div className="px-5 pt-6 pb-8">
        <Link
          to="/promos"
          className="flex items-center justify-between rounded-2xl bg-ink p-4 text-white"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display font-bold">Supplier promos</p>
              <p className="text-[11px] opacity-75">{promos.length} active offers</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-70" />
        </Link>
      </div>
    </div>
  );
}
