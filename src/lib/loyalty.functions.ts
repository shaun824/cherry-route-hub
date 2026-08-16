// Server functions for the loyalty programme (rider + admin).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";
import { DEFAULT_LOYALTY_SETTINGS, monthsAgo, parseLoyaltySettings } from "./loyalty";

type Row = Record<string, any>;

async function myEntrantIds(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("entrants").select("id").eq("user_id", userId);
  return ((data ?? []) as Row[]).map((r) => String(r.id));
}

async function balanceFor(supabase: any, entrantIds: string[]) {
  if (entrantIds.length === 0) return { balance: 0, earned: 0, spent: 0, ledger: [] as Row[] };
  const { data } = await supabase
    .from("loyalty_ledger")
    .select("id, points, kind, reason, created_at, en_event_id")
    .in("entrant_id", entrantIds)
    .order("created_at", { ascending: false })
    .limit(300);
  const ledger = (data ?? []) as Row[];
  const earned = ledger.filter((l) => l.points > 0).reduce((s, l) => s + Number(l.points), 0);
  const spent = ledger.filter((l) => l.points < 0).reduce((s, l) => s + Math.abs(Number(l.points)), 0);
  return { balance: earned - spent, earned, spent, ledger };
}

/** Rider view: balance, tier inputs, history, coupons and the catalogue. */
export const getMyLoyalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const entrantIds = await myEntrantIds(supabase, userId);
    const [{ balance, earned, spent, ledger }, settingsRow, rewardsRes] = await Promise.all([
      balanceFor(supabase, entrantIds),
      supabase.from("site_settings").select("value").eq("key", "loyalty").maybeSingle(),
      supabase.from("loyalty_rewards").select("*").eq("active", true).order("cost_points"),
    ]);
    const settings = parseLoyaltySettings(settingsRow.data?.value ?? DEFAULT_LOYALTY_SETTINGS);

    let participation: Row[] = [];
    let coupons: Row[] = [];
    if (entrantIds.length) {
      const [p, c] = await Promise.all([
        supabase
          .from("loyalty_participation")
          .select("id, event_name, event_date, category, en_event_id, event_id")
          .in("entrant_id", entrantIds)
          .order("event_date", { ascending: false }),
        supabase
          .from("loyalty_coupons")
          .select("*")
          .in("entrant_id", entrantIds)
          .order("created_at", { ascending: false }),
      ]);
      participation = (p.data ?? []) as Row[];
      coupons = (c.data ?? []) as Row[];
    }

    // What this rider has actually paid us, so we can show the pay-back promise.
    const enIds = [...new Set(participation.map((r) => Number(r.en_event_id)).filter(Boolean))];
    let priceById = new Map<number, number>();
    if (enIds.length) {
      const { data: values } = await supabase
        .from("loyalty_event_values")
        .select("en_event_id, entry_price_cents")
        .in("en_event_id", enIds);
      priceById = new Map(
        ((values ?? []) as Row[]).map((v) => [Number(v.en_event_id), Number(v.entry_price_cents ?? 0)]),
      );
    }
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 3);
    let spendCents = 0;
    let spendCents3y = 0;
    for (const row of participation) {
      const cents = priceById.get(Number(row.en_event_id)) ?? 0;
      spendCents += cents;
      const when = row.event_date ? new Date(String(row.event_date)) : null;
      if (when && when >= cutoff) spendCents3y += cents;
    }

    // Tier runs on a rolling window; the previous window is held for a while.
    const tierCutoff = monthsAgo(settings.tierWindowMonths);
    const holdCutoff = monthsAgo(settings.tierWindowMonths + settings.tierHoldMonths);
    let rollingPoints = 0;
    let heldPoints = 0;
    for (const l of ledger) {
      if (Number(l.points) <= 0) continue;
      const when = new Date(String(l.created_at));
      if (when >= tierCutoff) rollingPoints += Number(l.points);
      if (when >= holdCutoff) heldPoints += Number(l.points);
    }

    // Points expire after a spell of inactivity — warn inside the last 90 days.
    const lastActivity = ledger.length
      ? new Date(String(ledger[0]?.created_at))
      : null;
    let expiresAt: string | null = null;
    if (settings.expiryMonths > 0 && lastActivity && balance > 0) {
      const d = new Date(lastActivity);
      d.setMonth(d.getMonth() + settings.expiryMonths);
      expiresAt = d.toISOString();
    }

    return {
      linked: entrantIds.length > 0,
      balance,
      earned,
      spent,
      ledger,
      participation,
      coupons,
      spendCents,
      spendCents3y,
      rollingPoints,
      heldPoints,
      expiresAt,
      rewards: (rewardsRes.data ?? []) as Row[],
      settings,
    };
  });



/** Cash out points for a reward — mints a coupon code and debits the ledger. */
export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rewardId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const entrantIds = await myEntrantIds(supabase, userId);
    if (entrantIds.length === 0) return { ok: false as const, error: "Link your rider profile first." };

    const { data: reward } = await supabase
      .from("loyalty_rewards")
      .select("*")
      .eq("id", data.rewardId)
      .eq("active", true)
      .maybeSingle();
    if (!reward) return { ok: false as const, error: "That reward is no longer available." };

    if (reward.stock !== null && Number(reward.stock) <= 0) {
      return { ok: false as const, error: "That reward is sold out for now." };
    }

    const { balance } = await balanceFor(supabase, entrantIds);
    if (balance < Number(reward.cost_points)) {
      return { ok: false as const, error: "Not enough points for this reward yet." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateCouponCode } = await import("./loyalty.server");
    const entrantId = entrantIds[0] as string;
    const code = generateCouponCode();
    const expires = new Date(Date.now() + Number(reward.valid_days ?? 180) * 86400000).toISOString();

    if (reward.stock !== null) {
      await supabaseAdmin
        .from("loyalty_rewards")
        .update({ stock: Math.max(0, Number(reward.stock) - 1) })
        .eq("id", reward.id);
    }


    const { data: coupon, error } = await supabaseAdmin
      .from("loyalty_coupons")
      .insert({
        code,
        entrant_id: entrantId,
        reward_id: reward.id,
        reward_name: reward.name,
        points_spent: reward.cost_points,
        expires_at: expires,
      })
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };

    await supabaseAdmin.from("loyalty_ledger").insert({
      entrant_id: entrantId,
      points: -Number(reward.cost_points),
      kind: "redeem",
      reward_id: reward.id,
      reason: `Cashed out: ${reward.name}`,
      created_by: userId,
    });

    // Only entry discounts need to exist at Entry Ninja checkout; merch,
    // experience and partner rewards are redeemed in person from the app.
    let enResult = { status: "in-app", message: "Show this code at the Red Cherry stand." };
    if (reward.kind === "entry" || !reward.kind) {
      enResult = { status: "manual", message: "Queued for Entry Ninja." };
      try {
        const { pushCouponToEntryNinja } = await import("./loyalty.server");
        enResult = await pushCouponToEntryNinja(supabaseAdmin as any, coupon.id);
      } catch {
        /* redemption still stands even if Entry Ninja is unreachable */
      }
    }


    return { ok: true as const, coupon, entryNinja: enResult };
  });

/* ---------------------------------- admin --------------------------------- */

async function assertAdmin(supabase: any) {
  const isAdmin = await checkIsAdmin(supabase as never);
  if (!isAdmin) throw new Error("Forbidden");
}

export const getLoyaltyAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);

    const [settingsRow, valuesRes, rewardsRes, couponsRes] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "loyalty").maybeSingle(),
      supabase.from("loyalty_event_values").select("*").order("event_date", { ascending: false }).limit(400),
      supabase.from("loyalty_rewards").select("*").order("sort_order"),
      supabase
        .from("loyalty_coupons")
        .select("*, entrants(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    // Ledger totals per person (bounded pull, plenty for a few thousand riders).
    const totals = new Map<string, number>();
    for (let page = 0; page < 40; page++) {
      const { data } = await supabase
        .from("loyalty_ledger")
        .select("entrant_id, points")
        .range(page * 1000, page * 1000 + 999);
      const rows = (data ?? []) as Row[];
      for (const r of rows) totals.set(r.entrant_id, (totals.get(r.entrant_id) ?? 0) + Number(r.points));
      if (rows.length < 1000) break;
    }

    const eventCounts = new Map<string, number>();
    for (let page = 0; page < 40; page++) {
      const { data } = await supabase
        .from("loyalty_participation")
        .select("entrant_id")
        .range(page * 1000, page * 1000 + 999);
      const rows = (data ?? []) as Row[];
      for (const r of rows) eventCounts.set(r.entrant_id, (eventCounts.get(r.entrant_id) ?? 0) + 1);
      if (rows.length < 1000) break;
    }

    const topIds = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([id]) => id);
    const { data: people } = topIds.length
      ? await supabase.from("entrants").select("id, full_name, email, user_id").in("id", topIds)
      : { data: [] };
    const peopleById = new Map(((people ?? []) as Row[]).map((p) => [p.id, p]));

    const leaderboard = topIds.map((id) => ({
      entrantId: id,
      name: peopleById.get(id)?.full_name ?? "Unknown rider",
      email: peopleById.get(id)?.email ?? null,
      hasAccount: Boolean(peopleById.get(id)?.user_id),
      points: totals.get(id) ?? 0,
      events: eventCounts.get(id) ?? 0,
    }));

    return {
      settings: parseLoyaltySettings(settingsRow.data?.value ?? DEFAULT_LOYALTY_SETTINGS),
      eventValues: (valuesRes.data ?? []) as Row[],
      rewards: (rewardsRes.data ?? []) as Row[],
      coupons: (couponsRes.data ?? []) as Row[],
      leaderboard,
      stats: {
        people: totals.size,
        participation: [...eventCounts.values()].reduce((s, n) => s + n, 0),
        pointsOutstanding: [...totals.values()].reduce((s, n) => s + n, 0),
      },
    };
  });

export const saveLoyaltySettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        demoMode: z.boolean(),
        defaultPoints: z.number().int().min(0).max(100000),
        randPerPoint: z.number().min(0).max(100),
        loyaltyBonusPerYear: z.number().int().min(0).max(10000),
        pointsPerRand: z.number().min(0).max(100).default(0.1),
        heroMultiplier: z.number().min(1).max(10).default(1),
        tierWindowMonths: z.number().int().min(6).max(120).default(36),
        tierHoldMonths: z.number().int().min(0).max(60).default(12),
        expiryMonths: z.number().int().min(0).max(120).default(24),
        programName: z.string().trim().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { saveLoyaltySettings } = await import("./loyalty.server");
    return saveLoyaltySettings(supabase, data);
  });


export const setEventPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        points: z.number().int().min(0).max(100000),
        entryPriceCents: z.number().int().min(0).max(100000000).nullable().optional(),
        hero: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const patch: Row = { points: data.points };
    if (data.entryPriceCents !== undefined) {
      patch['entry_price_cents'] = data.entryPriceCents;
      patch['price_source'] = "manual";
    }
    if (data.hero !== undefined) patch['hero'] = data.hero;
    const { error } = await supabase.from("loyalty_event_values").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Re-value every event from what riders actually paid to enter it. */
export const applyPriceValues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { applyPriceBasedValues } = await import("./loyalty.server");
    return applyPriceBasedValues(supabase);
  });

/** Admin: push (or retry) a coupon code across to Entry Ninja. */
export const pushCouponToEn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ couponId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pushCouponToEntryNinja } = await import("./loyalty.server");
    return pushCouponToEntryNinja(supabaseAdmin as any, data.couponId);
  });

export const saveReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).default(""),
        cost_points: z.number().int().min(1).max(1000000),
        value_label: z.string().trim().max(40).default(""),
        terms: z.string().trim().max(500).default(""),
        valid_days: z.number().int().min(1).max(3650).default(180),
        active: z.boolean().default(true),
        sort_order: z.number().int().min(0).max(999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { id, ...row } = data;
    const q = id
      ? supabase.from("loyalty_rewards").update(row).eq("id", id)
      : supabase.from("loyalty_rewards").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { error } = await supabase.from("loyalty_rewards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markCouponRedeemed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["issued", "redeemed", "void"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { error } = await supabase
      .from("loyalty_coupons")
      .update({ status: data.status, redeemed_at: data.status === "redeemed" ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runLoyaltyBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sinceYear: z.number().int().min(2000).max(2100).optional(),
        maxEvents: z.number().int().min(1).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { backfillLoyalty } = await import("./loyalty.server");
    return backfillLoyalty(supabase, data);
  });

export const runLoyaltyRecalc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    await assertAdmin(supabase);
    const { recalculateLedger } = await import("./loyalty.server");
    return recalculateLedger(supabase);
  });

export const adjustRiderPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        entrantId: z.string().uuid(),
        points: z.number().int().min(-100000).max(100000),
        reason: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase);
    const { error } = await supabase.from("loyalty_ledger").insert({
      entrant_id: data.entrantId,
      points: data.points,
      kind: "adjust",
      reason: data.reason,
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
