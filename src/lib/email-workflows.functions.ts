// Admin API for event email workflows — create a sequence of emails per event,
// set the delay between them, preview one, and run the queue on demand.
import { normaliseBlocks } from "@/lib/email-blocks";
import { visibleInBackend } from "@/lib/event-window";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admins only");
}

export const listEmailWorkflows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rawEvents } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, days")
      .neq("lifecycle", "archived")
      .order("event_date", { ascending: true });
    const events = visibleInBackend(rawEvents ?? []);

    const { data: campaigns, error } = await supabaseAdmin
      .from("event_email_campaigns")
      .select("id, event_id, name, status, anchor, activated_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (campaigns ?? []).map((c: any) => c.id);
    const safeIds = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];

    const { data: steps } = await supabaseAdmin
      .from("event_email_steps")
      .select("id, campaign_id, position, subject, heading, body, blocks, cta_label, cta_url, banner_url, image_urls, delay_hours, enabled, template_name")
      .in("campaign_id", safeIds)
      .order("position", { ascending: true });

    const { data: sends } = await supabaseAdmin
      .from("event_email_sends")
      .select("step_id, campaign_id, status")
      .in("campaign_id", safeIds)
      .limit(20000);

    const countByStep = new Map<string, { sent: number; failed: number }>();
    for (const s of (sends ?? []) as any[]) {
      const c = countByStep.get(s.step_id) ?? { sent: 0, failed: 0 };
      if (s.status === "failed") c.failed++;
      else c.sent++;
      countByStep.set(s.step_id, c);
    }

    // ---- Emails that already go out automatically ------------------------
    // Per-event welcome mails (Entry Ninja "you're entered") plus everything
    // recorded in email_sends, so the page shows the full picture, not just
    // hand-built workflows.
    const eventIds = (events ?? []).map((e: any) => e.id);
    const safeEventIds = eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"];

    const { data: entrantRows } = await (supabaseAdmin as any)
      .from("event_entrants")
      .select("event_id, welcome_email_sent_at")
      .in("event_id", safeEventIds)
      .limit(50000);

    const entrantStats = new Map<string, { entrants: number; welcomeSent: number }>();
    for (const row of (entrantRows ?? []) as any[]) {
      const s = entrantStats.get(row.event_id) ?? { entrants: 0, welcomeSent: 0 };
      s.entrants++;
      if (row.welcome_email_sent_at) s.welcomeSent++;
      entrantStats.set(row.event_id, s);
    }

    const { data: sentRows } = await (supabaseAdmin as any)
      .from("email_sends")
      .select("template, sent_at")
      .order("sent_at", { ascending: false })
      .limit(20000);

    const byTemplate = new Map<string, { sent: number; lastSentAt: string | null }>();
    for (const row of (sentRows ?? []) as any[]) {
      const t = String(row.template ?? "unknown");
      const s = byTemplate.get(t) ?? { sent: 0, lastSentAt: null };
      s.sent++;
      if (!s.lastSentAt || row.sent_at > s.lastSentAt) s.lastSentAt = row.sent_at;
      byTemplate.set(t, s);
    }

    return {
      events: (events ?? []).map((e: any) => ({
        id: e.id,
        name: e.name,
        eventDate: e.event_date,
        entrants: entrantStats.get(e.id)?.entrants ?? 0,
        welcomeSent: entrantStats.get(e.id)?.welcomeSent ?? 0,
      })),
      systemEmails: Array.from(byTemplate.entries())
        .map(([template, s]) => ({ template, ...s }))
        .sort((a, b) => b.sent - a.sent),
      campaigns: ((campaigns ?? []) as any[]).map((c) => ({
        ...c,
        steps: ((steps ?? []) as any[])
          .filter((s) => s.campaign_id === c.id)
          .map((s) => ({ ...s, ...(countByStep.get(s.id) ?? { sent: 0, failed: 0 }) })),
      })),
    };
  });


export const saveEmailWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string; eventId: string; name: string; anchor: "activation" | "entry" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.name.trim()) throw new Error("Give the workflow a name");

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("event_email_campaigns")
        .update({ name: data.name.trim(), anchor: data.anchor })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("event_email_campaigns")
      .insert({
        event_id: data.eventId,
        name: data.name.trim(),
        anchor: data.anchor,
        created_by: (context as any).userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const setWorkflowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string; status: "draft" | "active" | "paused" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { status: string; activated_at?: string } = { status: data.status };
    if (data.status === "active") {
      const { data: existing } = await supabaseAdmin
        .from("event_email_campaigns")
        .select("activated_at")
        .eq("id", data.campaignId)
        .maybeSingle();
      if (!existing?.activated_at) patch['activated_at'] = new Date().toISOString();
    }
    const { error } = await supabaseAdmin
      .from("event_email_campaigns")
      .update(patch)
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmailWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("event_email_campaigns")
      .delete()
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveWorkflowStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      campaignId: string;
      subject: string;
      heading?: string | null;
      body: string;
      ctaLabel?: string | null;
      ctaUrl?: string | null;
      bannerUrl?: string | null;
      imageUrls?: string[] | null;
      blocks?: unknown;
      delayHours: number;
      position?: number;
      enabled?: boolean;
      templateName?: "event-update" | "pe-plett-extras";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.subject.trim()) throw new Error("The email needs a subject line");

    const patch = {
      subject: data.subject.trim(),
      heading: data.heading?.trim() || null,
      body: data.body ?? "",
      cta_label: data.ctaLabel?.trim() || null,
      cta_url: data.ctaUrl?.trim() || null,
      banner_url: data.bannerUrl?.trim() || null,
      image_urls: (data.imageUrls ?? []).map((u) => String(u).trim()).filter(Boolean),
      ...(data.blocks === undefined ? {} : { blocks: normaliseBlocks(data.blocks) }),
      delay_hours: Math.max(0, Math.round(Number(data.delayHours) || 0)),
      enabled: data.enabled ?? true,
      ...(data.templateName === undefined ? {} : { template_name: data.templateName }),
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("event_email_steps").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    let position = data.position;
    if (position == null) {
      const { data: last } = await supabaseAdmin
        .from("event_email_steps")
        .select("position")
        .eq("campaign_id", data.campaignId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      position = ((last?.position as number | undefined) ?? 0) + 1;
    }

    const { data: row, error } = await supabaseAdmin
      .from("event_email_steps")
      .insert({ ...patch, campaign_id: data.campaignId, position })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteWorkflowStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_email_steps").delete().eq("id", data.stepId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends the step to the signed-in admin only — nothing is recorded as sent. */
export const sendWorkflowStepTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendWorkflowEmail } = await import("./email-workflows.server");

    const { data: step, error } = await supabaseAdmin
      .from("event_email_steps")
      .select(
        "id, campaign_id, subject, heading, body, blocks, cta_label, cta_url, banner_url, image_urls, template_name, event_email_campaigns(id, event_id, events(id, name, event_date, location, logo_url, cover_url))",
      )
      .eq("id", data.stepId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!step) throw new Error("Email not found");

    const event = (step as any).event_email_campaigns?.events;
    if (!event) throw new Error("This workflow has no event attached");

    const to = (context as any).claims?.email as string | undefined;
    if (!to) throw new Error("Your account has no email address");

    await sendWorkflowEmail(supabaseAdmin, {
      campaignId: (step as any).campaign_id,
      stepId: `test-${(step as any).id}-${Date.now()}`,
      event,
      step,
      to,
      name: "Test",
      record: false,
    });
    return { to };
  });

/** Runs the due queue immediately instead of waiting for the hourly job. */
export const runEmailWorkflowsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignId?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processDueWorkflowEmails } = await import("./email-workflows.server");
    return processDueWorkflowEmails(supabaseAdmin, {
      ...(data.campaignId ? { campaignId: data.campaignId } : {}),
      ignoreWindow: true,
      limit: 200,
    });
  });

/** One email plus its event, for the visual builder. */
export const getWorkflowStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stepId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: step, error } = await supabaseAdmin
      .from("event_email_steps")
      .select(
        "id, campaign_id, position, subject, heading, body, blocks, cta_label, cta_url, banner_url, image_urls, delay_hours, enabled, template_name, event_email_campaigns(id, name, status, anchor, event_id, events(id, name, event_date, location, logo_url, cover_url))",
      )
      .eq("id", data.stepId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!step) throw new Error("Email not found");
    const campaign = (step as any).event_email_campaigns;
    return {
      step: {
        id: (step as any).id as string,
        campaignId: (step as any).campaign_id as string,
        position: (step as any).position as number,
        subject: ((step as any).subject ?? "") as string,
        heading: ((step as any).heading ?? "") as string,
        body: ((step as any).body ?? "") as string,
        blocks: normaliseBlocks((step as any).blocks),
        ctaLabel: ((step as any).cta_label ?? "") as string,
        ctaUrl: ((step as any).cta_url ?? "") as string,
        bannerUrl: ((step as any).banner_url ?? "") as string,
        imageUrls: (Array.isArray((step as any).image_urls) ? (step as any).image_urls : []) as string[],
        delayHours: Number((step as any).delay_hours ?? 24),
        enabled: !!(step as any).enabled,
        templateName: ((step as any).template_name ?? "event-update") as "event-update" | "pe-plett-extras",
      },
      campaign: campaign
        ? { id: campaign.id as string, name: campaign.name as string, status: campaign.status as string, anchor: campaign.anchor as string }
        : null,
      event: campaign?.events ?? null,
    };
  });

/** Renders exactly what the rider will receive, as HTML, for the live preview. */
export const renderWorkflowStepPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      eventId: string;
      subject: string;
      heading?: string | null;
      bannerUrl?: string | null;
      blocks?: unknown;
      body?: string | null;
      ctaLabel?: string | null;
      ctaUrl?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { render } = await import("@react-email/render");
    const React = (await import("react")).default;
    const { EventUpdateEmail } = await import("./email-templates/event-update");
    const { absoluteLogo } = await import("./entry-welcome.server");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, location, logo_url, cover_url")
      .eq("id", data.eventId)
      .maybeSingle();

    const ev = (event ?? {}) as any;
    const html = await render(
      React.createElement(EventUpdateEmail, {
        firstName: "Shaun",
        eventName: ev.name ?? "Your event",
        eventDate: ev.event_date
          ? new Date(ev.event_date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
          : null,
        venue: ev.location ?? null,
        eventCoverUrl: absoluteLogo(ev.cover_url),
        eventLogoUrl: absoluteLogo(ev.logo_url),
        bannerUrl: absoluteLogo(data.bannerUrl ?? null),
        blocks: normaliseBlocks(data.blocks),
        heading: data.heading || data.subject,
        subject: data.subject,
        body: data.body ?? "",
        ctaLabel: data.ctaLabel ?? null,
        ctaUrl: data.ctaUrl ?? null,
        eventUrl: `https://riderapp.redcherryevents.co.za/my-events/${ev.id ?? ""}`,
      } as any),
    );
    return { html };
  });
