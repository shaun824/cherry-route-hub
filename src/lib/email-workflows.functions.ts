// Admin API for event email workflows — create a sequence of emails per event,
// set the delay between them, preview one, and run the queue on demand.
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
      .select("id, campaign_id, position, subject, heading, body, cta_label, cta_url, delay_hours, enabled")
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

    return {
      events: (events ?? []).map((e: any) => ({ id: e.id, name: e.name, eventDate: e.event_date })),
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
      delayHours: number;
      position?: number;
      enabled?: boolean;
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
      delay_hours: Math.max(0, Math.round(Number(data.delayHours) || 0)),
      enabled: data.enabled ?? true,
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
        "id, campaign_id, subject, heading, body, cta_label, cta_url, event_email_campaigns(id, event_id, events(id, name, event_date, location, logo_url, cover_url))",
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
