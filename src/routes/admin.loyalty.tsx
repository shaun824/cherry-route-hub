import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Coins, Gift, RefreshCw, Ticket, Trophy, Users, DownloadCloud } from "lucide-react";
import {
  adjustRiderPoints,
  deleteReward,
  getLoyaltyAdmin,
  markCouponRedeemed,
  runLoyaltyBackfill,
  runLoyaltyRecalc,
  saveLoyaltySettingsFn,
  saveReward,
  setEventPoints,
} from "@/lib/loyalty.functions";
import { formatPoints, randValue, tierFor, type LoyaltySettings } from "@/lib/loyalty";

export const Route = createFileRoute("/admin/loyalty")({
  component: AdminLoyalty,
});

type Tab = "overview" | "events" | "rewards" | "coupons" | "settings";

function AdminLoyalty() {
  const load = useServerFn(getLoyaltyAdmin);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-loyalty"],
    queryFn: () => load({ data: {} } as never),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-loyalty"] });

  const backfill = useServerFn(runLoyaltyBackfill);
  const recalc = useServerFn(runLoyaltyRecalc);

  const backfillMut = useMutation({
    mutationFn: (sinceYear: number) => backfill({ data: { sinceYear, maxEvents: 60 } }),
    onSuccess: (r: any) => {
      toast.success(
        `Scanned ${r.eventsScanned} events · ${r.peopleCreated} new profiles · ${r.participationAdded} entries linked`,
      );
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const recalcMut = useMutation({
    mutationFn: () => recalc({ data: {} } as never),
    onSuccess: (r: any) => {
      toast.success(`${formatPoints(r.points)} points across ${r.riders} riders`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-ink-soft">Loading loyalty data…</p>;
  if (!data) return <p className="text-sm text-ink-soft">Could not load loyalty data.</p>;

  const s = data.settings;
  const liability = randValue(Math.max(0, data.stats.pointsOutstanding), s.randPerPoint);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Loyalty · {s.programName}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Pull every past entrant, assign point values per event, and control what riders can cash out.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => backfillMut.mutate(2017)}
            disabled={backfillMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            {backfillMut.isPending ? "Pulling entrants…" : "Pull all entrants"}
          </button>
          <button
            onClick={() => recalcMut.mutate()}
            disabled={recalcMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${recalcMut.isPending ? "animate-spin" : ""}`} />
            Recalculate points
          </button>
        </div>
      </header>

      {s.demoMode ? (
        <p className="rounded-xl bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900">
          Demo mode is on — riders see a "provisional" badge on their points.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={Users} label="People with points" value={formatPoints(data.stats.people)} />
        <Kpi icon={Trophy} label="Event entries tracked" value={formatPoints(data.stats.participation)} />
        <Kpi icon={Coins} label="Points outstanding" value={formatPoints(data.stats.pointsOutstanding)} />
        <Kpi icon={Ticket} label="Exposure at current rate" value={liability} />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["overview", "Leaderboard"],
            ["events", "Event values"],
            ["rewards", "Rewards"],
            ["coupons", "Coupons"],
            ["settings", "Settings"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              tab === key ? "bg-card text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <Leaderboard rows={data.leaderboard} onDone={refresh} /> : null}
      {tab === "events" ? <EventValues rows={data.eventValues} settings={s} onDone={refresh} /> : null}
      {tab === "rewards" ? <Rewards rows={data.rewards} settings={s} onDone={refresh} /> : null}
      {tab === "coupons" ? <Coupons rows={data.coupons} onDone={refresh} /> : null}
      {tab === "settings" ? <SettingsForm settings={s} onDone={refresh} /> : null}
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <Icon className="h-4 w-4 text-cherry" />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="font-display text-2xl font-black">{value}</p>
    </div>
  );
}

function Leaderboard({ rows, onDone }: { rows: any[]; onDone: () => void }) {
  const [q, setQ] = useState("");
  const adjust = useServerFn(adjustRiderPoints);
  const mut = useMutation({
    mutationFn: (v: { entrantId: string; points: number; reason: string }) => adjust({ data: v }),
    onSuccess: () => {
      toast.success("Points adjusted");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => r.name?.toLowerCase().includes(needle) || (r.email ?? "").toLowerCase().includes(needle),
    );
  }, [q, rows]);

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <div className="border-b border-border p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search riders…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-left text-[11px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Rider</th>
              <th className="px-3 py-2">Events</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">App</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const { tier } = tierFor(r.points);
              return (
                <tr key={r.entrantId} className="border-t border-border">
                  <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                  <td className="px-3 py-2">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-[11px] text-ink-soft">{r.email ?? "no email"}</p>
                  </td>
                  <td className="px-3 py-2">{r.events}</td>
                  <td className="px-3 py-2 font-bold">{formatPoints(r.points)}</td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase"
                      style={{ backgroundColor: `${tier.accent}22`, color: tier.accent }}
                    >
                      {tier.name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-ink-soft">{r.hasAccount ? "Yes" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold"
                      onClick={() => {
                        const raw = window.prompt(`Adjust points for ${r.name} (use -100 to deduct)`, "100");
                        if (!raw) return;
                        const points = Number(raw);
                        if (!Number.isFinite(points) || points === 0) return;
                        const reason = window.prompt("Reason", "Manual adjustment") ?? "Manual adjustment";
                        mut.mutate({ entrantId: r.entrantId, points: Math.trunc(points), reason });
                      }}
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-soft">
                  No riders yet — run "Pull all entrants" then "Recalculate points".
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventValues({ rows, settings, onDone }: { rows: any[]; settings: LoyaltySettings; onDone: () => void }) {
  const save = useServerFn(setEventPoints);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const mut = useMutation({
    mutationFn: (v: { id: string; points: number }) => save({ data: v }),
    onSuccess: () => {
      toast.success("Event value saved");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <p className="border-b border-border p-3 text-xs text-ink-soft">
        Points awarded to each rider who completed the event. Default for new events: {settings.defaultPoints} pts (≈{" "}
        {randValue(settings.defaultPoints, settings.randPerPoint)} of value).
      </p>
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-secondary text-left text-[11px] uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Worth</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const value = draft[r.id] ?? String(r.points);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{r.event_name}</td>
                  <td className="px-3 py-2 text-ink-soft">{r.event_date ?? "—"}</td>
                  <td className="px-3 py-2">
                    <input
                      value={value}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      inputMode="numeric"
                      className="w-24 rounded-lg border border-border px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{randValue(Number(value) || 0, settings.randPerPoint)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={String(r.points) === value}
                      onClick={() => mut.mutate({ id: r.id, points: Math.max(0, Math.trunc(Number(value) || 0)) })}
                      className="rounded-lg bg-ink px-2 py-1 text-[11px] font-bold text-white disabled:opacity-30"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-soft">
                  Run "Pull all entrants" to import events from Entry Ninja.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const emptyReward = {
  name: "",
  description: "",
  cost_points: 750,
  value_label: "",
  terms: "",
  valid_days: 180,
  active: true,
  sort_order: 0,
};

function Rewards({ rows, settings, onDone }: { rows: any[]; settings: LoyaltySettings; onDone: () => void }) {
  const save = useServerFn(saveReward);
  const del = useServerFn(deleteReward);
  const [form, setForm] = useState<any>(emptyReward);

  const saveMut = useMutation({
    mutationFn: (v: any) => save({ data: v }),
    onSuccess: () => {
      toast.success("Reward saved");
      setForm(emptyReward);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Reward removed");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        {rows.map((r) => (
          <article key={r.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold">{r.name}</h3>
                <p className="text-xs text-ink-soft">{r.description}</p>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {formatPoints(r.cost_points)} pts · costs you {randValue(r.cost_points, settings.randPerPoint)} · valid{" "}
                  {r.valid_days} days {r.active ? "" : "· inactive"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  onClick={() => setForm({ ...r })}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold"
                >
                  Edit
                </button>
                <button
                  onClick={() => delMut.mutate(r.id)}
                  className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-cherry"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <form
        className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-border"
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate({
            id: form.id,
            name: form.name,
            description: form.description ?? "",
            cost_points: Math.trunc(Number(form.cost_points) || 0),
            value_label: form.value_label ?? "",
            terms: form.terms ?? "",
            valid_days: Math.trunc(Number(form.valid_days) || 180),
            active: Boolean(form.active),
            sort_order: Math.trunc(Number(form.sort_order) || 0),
          });
        }}
      >
        <h3 className="flex items-center gap-2 font-display font-bold">
          <Gift className="h-4 w-4 text-cherry" /> {form.id ? "Edit reward" : "New reward"}
        </h3>
        <Field label="Name">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="h-20 w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost (points)">
            <input
              value={form.cost_points}
              onChange={(e) => setForm({ ...form, cost_points: e.target.value })}
              inputMode="numeric"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Value badge">
            <input
              value={form.value_label ?? ""}
              onChange={(e) => setForm({ ...form, value_label: e.target.value })}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="R150"
            />
          </Field>
          <Field label="Valid for (days)">
            <input
              value={form.valid_days}
              onChange={(e) => setForm({ ...form, valid_days: e.target.value })}
              inputMode="numeric"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Sort order">
            <input
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              inputMode="numeric"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Terms">
          <input value={form.terms ?? ""} onChange={(e) => setForm({ ...form, terms: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
        </Field>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={Boolean(form.active)}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Visible to riders
        </label>
        <div className="flex gap-2">
          <button className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white" disabled={saveMut.isPending}>
            {form.id ? "Save changes" : "Add reward"}
          </button>
          {form.id ? (
            <button
              type="button"
              onClick={() => setForm(emptyReward)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Coupons({ rows, onDone }: { rows: any[]; onDone: () => void }) {
  const mark = useServerFn(markCouponRedeemed);
  const mut = useMutation({
    mutationFn: (v: { id: string; status: "issued" | "redeemed" | "void" }) => mark({ data: v }),
    onSuccess: () => {
      toast.success("Coupon updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="overflow-auto rounded-2xl bg-card ring-1 ring-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-[11px] uppercase tracking-wide text-ink-soft">
          <tr>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Rider</th>
            <th className="px-3 py-2">Reward</th>
            <th className="px-3 py-2">Points</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono font-bold">{c.code}</td>
              <td className="px-3 py-2">
                {c.entrants?.full_name ?? "—"}
                <span className="block text-[11px] text-ink-soft">{c.entrants?.email ?? ""}</span>
              </td>
              <td className="px-3 py-2">{c.reward_name}</td>
              <td className="px-3 py-2">{formatPoints(c.points_spent)}</td>
              <td className="px-3 py-2">{c.status}</td>
              <td className="px-3 py-2 text-right">
                {c.status !== "redeemed" ? (
                  <button
                    onClick={() => mut.mutate({ id: c.id, status: "redeemed" })}
                    className="rounded-lg bg-ink px-2 py-1 text-[11px] font-bold text-white"
                  >
                    Mark used
                  </button>
                ) : (
                  <button
                    onClick={() => mut.mutate({ id: c.id, status: "issued" })}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold"
                  >
                    Reopen
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-ink-soft">
                No coupons issued yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SettingsForm({ settings, onDone }: { settings: LoyaltySettings; onDone: () => void }) {
  const save = useServerFn(saveLoyaltySettingsFn);
  const [form, setForm] = useState<any>(settings);
  useEffect(() => setForm(settings), [settings]);

  const mut = useMutation({
    mutationFn: (v: LoyaltySettings) => save({ data: v }),
    onSuccess: () => {
      toast.success("Loyalty settings saved");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="max-w-lg space-y-3 rounded-2xl bg-card p-4 ring-1 ring-border"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate({
          demoMode: Boolean(form.demoMode),
          defaultPoints: Math.trunc(Number(form.defaultPoints) || 0),
          randPerPoint: Number(form.randPerPoint) || 0,
          loyaltyBonusPerYear: Math.trunc(Number(form.loyaltyBonusPerYear) || 0),
          programName: String(form.programName || "Cherry Miles"),
        });
      }}
    >
      <Field label="Programme name">
        <input value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
      </Field>
      <Field label="Default points per event">
        <input
          value={form.defaultPoints}
          onChange={(e) => setForm({ ...form, defaultPoints: e.target.value })}
          inputMode="numeric"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Rand value per point (internal only)">
        <input
          value={form.randPerPoint}
          onChange={(e) => setForm({ ...form, randPerPoint: e.target.value })}
          inputMode="decimal"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Returning-rider bonus per prior event">
        <input
          value={form.loyaltyBonusPerYear}
          onChange={(e) => setForm({ ...form, loyaltyBonusPerYear: e.target.value })}
          inputMode="numeric"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </Field>
      <label className="flex items-center gap-2 text-xs font-semibold">
        <input type="checkbox" checked={Boolean(form.demoMode)} onChange={(e) => setForm({ ...form, demoMode: e.target.checked })} />
        Demo mode (riders see points as provisional)
      </label>
      <button className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white" disabled={mut.isPending}>
        Save settings
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
