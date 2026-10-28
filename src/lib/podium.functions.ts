import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PodiumStanding } from "@/lib/podium.server";

export type PublicPodium = {
  enabled: boolean;
  stage: "preview" | "provisional" | "final";
  revealAt: string | null;
  stagesWithResults: number;
  standings: PodiumStanding[];
};

const In = z.object({ eventId: z.string().uuid() });

function defaultReveal(lastDay: string | null) {
  return lastDay ? `${lastDay}T12:00:00+02:00` : null;
}

/** Public: categories before the race, provisional top 3 after stage 1, final once published + revealed. */
export const getPodium = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => In.parse(i))
  .handler(async ({ data }): Promise<PublicPodium> => {
    const { computePodium } = await import("@/lib/podium.server");
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (await import("@/lib/review-event.server")).assertEventVisibleToCaller(supabaseAdmin, data.eventId);
    }
    const c = await computePodium(data.eventId, 1000);
    if (!c) return { enabled: false, stage: "preview", revealAt: null, stagesWithResults: 0, standings: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("event_podiums").select("final, published_at, reveal_at").eq("event_id", data.eventId).maybeSingle();
    const { data: event } = await supabaseAdmin.from('events').select('result_exclusions').eq('id', data.eventId).maybeSingle();
    const { isResultExcluded, parseResultExclusions } = await import('./result-exclusions');
    const exclusions = parseResultExclusions(event?.result_exclusions);
    const revealAt = (row?.reveal_at as string | null) ?? defaultReveal(c.lastDay);
    if (row?.published_at && (!revealAt || new Date(revealAt).getTime() <= Date.now())) {
      const standings = (row.final as PodiumStanding[]).map(s => ({ ...s, riders: s.riders.filter(r => !isResultExcluded(r, exclusions)).map((r, i) => ({ ...r, pos: i + 1 })) }));
      return { enabled: true, stage: "final", revealAt, stagesWithResults: c.stagesWithResults, standings };
    }
    if (c.stagesWithResults === 0) {
      return { enabled: true, stage: "preview", revealAt, stagesWithResults: 0, standings: c.standings.map((s) => ({ ...s, riders: [] })) };
    }
    const standings = c.standings.map((s) => ({ ...s, riders: s.riders.map(({ ms: _ms, ...r }) => ({ ...r, ms: null })) }));
    return { enabled: true, stage: "provisional", revealAt, stagesWithResults: c.stagesWithResults, standings };
  });

export const getPodiumReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => In.parse(i))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/results.server");
    await assertAdmin(context);
    const { computePodium } = await import("@/lib/podium.server");
    const c = await computePodium(data.eventId, 8);
    if (!c) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("event_podiums").select("final, published_at, reveal_at").eq("event_id", data.eventId).maybeSingle();
    return {
      standings: c.standings,
      missingGender: c.missingGender,
      courseMismatches: c.courseMismatches,
      issues: c.issues,
      stagesWithResults: c.stagesWithResults,
      totalStages: c.totalStages,
      publishedAt: (row?.published_at as string | null) ?? null,
      published: (row?.final as PodiumStanding[] | null) ?? null,
      revealAt: (row?.reveal_at as string | null) ?? defaultReveal(c.lastDay),
    };
  });

const Rider = z.object({ pos: z.number(), name: z.string(), bib: z.string().nullable(), time: z.string().nullable(), ms: z.number().nullable() });
export const sendResultsIssueReport = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => In.parse(i))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import('./results.server');
    await assertAdmin(context);
    const { computePodium } = await import('./podium.server');
    const review = await computePodium(data.eventId, 1000);
    if (!review) throw new Error('No podium categories configured for this event');
    const { data: event } = await context.supabase.from('events').select('name').eq('id', data.eventId).single();
    if (!event) throw new Error('Event not found');
    const { emailResultsIssues } = await import('./results-alerts.server');
    return emailResultsIssues(data.eventId, event.name, review.issues);
  });

export const publishPodium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      eventId: z.string().uuid(),
      revealAt: z.string().nullable(),
      standings: z.array(z.object({ key: z.string(), title: z.string(), group: z.string(), riders: z.array(Rider).max(3) })).max(40),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/results.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("event_podiums").upsert({
      event_id: data.eventId,
      final: data.standings.map((s) => ({ ...s, riders: s.riders.map((r, i) => ({ ...r, pos: i + 1, ms: null })) })),
      published_at: new Date().toISOString(),
      reveal_at: data.revealAt,
      published_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unpublishPodium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => In.parse(i))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/results.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("event_podiums").update({ published_at: null, updated_at: new Date().toISOString() }).eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
