// Event email workflows: an admin builds an ordered sequence of emails for an
// event (route info, sponsors, logistics updates) with a delay between each
// one. An hourly job sends whatever is due, one email per address per step.
import { EmailAPIError } from "@lovable.dev/email-js";

import { normaliseBlocks } from "./email-blocks";
import { sendTemplateEmail } from "./email-templates/send-email";
import { absoluteLogo } from "./entry-welcome.server";
import { buildPePlettExtrasEmailData } from "./pe-plett-extras.server";

type AnyClient = any;

const APP_URL = "https://riderapp.redcherryevents.co.za";

/** Never mail riders in the middle of the night (SAST = UTC+2). */
const SEND_FROM_HOUR = 7;
const SEND_TO_HOUR = 20;

export interface WorkflowRunResult {
  campaigns: number;
  steps: number;
  sent: number;
  suppressed: number;
  failed: number;
  errors: string[];
}

function saHour(now: Date) {
  return (now.getUTCHours() + 2) % 24;
}

function firstName(full?: string | null) {
  const n = String(full ?? "").trim();
  return n ? n.split(/\s+/)[0] : null;
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * When each step is due, in cumulative hours after the campaign anchor.
 * Step 1 fires at its own delay, step 2 at step 1 + its delay, and so on —
 * so an admin thinks in "X days after the previous email".
 */
export function cumulativeOffsets(steps: { delay_hours: number }[]): number[] {
  let total = 0;
  return steps.map((s) => {
    total += Math.max(0, Number(s.delay_hours) || 0);
    return total;
  });
}

/** One recipient of a workflow email — one address, whatever their entries. */
interface Recipient {
  email: string;
  name: string | null;
  enteredAt: string;
  entrantId: string;
  extras: any[];
  registrationRef: string | null;
}

async function loadRecipients(admin: AnyClient, eventId: string): Promise<Recipient[]> {
  const { data, error } = await admin
    .from("event_entrants")
    .select("id, created_at, extras, registration_ref, entrants(full_name, email)")
    .eq("event_id", eventId)
    .limit(5000);
  if (error) throw new Error(error.message);

  const byEmail = new Map<string, Recipient>();
  for (const row of (data ?? []) as any[]) {
    const email = String(row.entrants?.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    // Keep the earliest entry date — the rider's sequence starts when they entered.
    if (!existing || row.created_at < existing.enteredAt) {
      byEmail.set(email, {
        email,
        name: row.entrants?.full_name ?? existing?.name ?? null,
        enteredAt: row.created_at,
        entrantId: row.id,
        extras: Array.isArray(row.extras) ? row.extras : [],
        registrationRef: row.registration_ref ?? null,
      });
    }
  }
  return Array.from(byEmail.values());
}

export async function sendWorkflowEmail(
  admin: AnyClient,
  opts: {
    campaignId: string;
    stepId: string;
    event: any;
    step: any;
    to: string;
    name?: string | null;
    entrantId?: string;
    extras?: any[];
    registrationRef?: string | null;
    record?: boolean;
  },
): Promise<"sent" | "suppressed"> {
  const { event, step } = opts;
  const eventUrl = `${APP_URL}/my-events/${event.id}`;
  const isPePlettExtras = step.template_name === "pe-plett-extras";
  const result = await sendTemplateEmail(isPePlettExtras ? "pe-plett-extras" : "event-update", opts.to, {
    idempotencyKey: `workflow-${opts.stepId}-${opts.to}`,
    templateData: isPePlettExtras
      ? buildPePlettExtrasEmailData({
          firstName: firstName(opts.name) ?? undefined,
          eventName: event.name,
          registrationRef: opts.registrationRef,
          extras: opts.extras,
        })
      : {
      firstName: firstName(opts.name),
      eventName: event.name,
      eventDate: formatDate(event.event_date),
      venue: event.location ?? null,
      eventCoverUrl: absoluteLogo(event.cover_url),
      eventLogoUrl: absoluteLogo(event.logo_url),
      bannerUrl: absoluteLogo(step.banner_url),
      images: (Array.isArray(step.image_urls) ? step.image_urls : []).filter((u: string) =>
        /^https:\/\//i.test(String(u ?? "")),
      ),
      blocks: normaliseBlocks((step as any).blocks),
      heading: step.heading || step.subject,
      subject: step.subject,
      body: step.body ?? "",
      ctaLabel: step.cta_label ?? null,
      ctaUrl: step.cta_url ?? null,
          eventUrl,
        },
  });

  if (opts.record !== false) {
    await admin.from("event_email_sends").upsert(
      {
        step_id: opts.stepId,
        campaign_id: opts.campaignId,
        event_id: event.id,
        email: opts.to,
        status: result.sent ? "sent" : "suppressed",
      },
      { onConflict: "step_id,email" },
    );
  }

  return result.sent ? "sent" : "suppressed";
}

/**
 * Processes every active campaign, bounded per run. Each (step, email) pair is
 * written to event_email_sends the moment it is handled, so a re-run never
 * repeats a send.
 */
export async function processDueWorkflowEmails(
  admin: AnyClient,
  opts: { limit?: number; campaignId?: string; ignoreWindow?: boolean } = {},
): Promise<WorkflowRunResult> {
  const limit = Math.min(Math.max(opts.limit ?? 150, 1), 400);
  const out: WorkflowRunResult = {
    campaigns: 0,
    steps: 0,
    sent: 0,
    suppressed: 0,
    failed: 0,
    errors: [],
  };

  const now = new Date();
  if (!opts.ignoreWindow) {
    const hour = saHour(now);
    if (hour < SEND_FROM_HOUR || hour >= SEND_TO_HOUR) return out;
  }

  let campQuery = admin
    .from("event_email_campaigns")
    .select("id, event_id, name, status, anchor, activated_at, events(id, name, event_date, location, logo_url, cover_url, lifecycle)")
    .eq("status", "active");
  if (opts.campaignId) campQuery = campQuery.eq("id", opts.campaignId);

  const { data: campaigns, error } = await campQuery;
  if (error) throw new Error(error.message);

  for (const campaign of (campaigns ?? []) as any[]) {
    if (out.sent + out.suppressed >= limit) break;
    const event = campaign.events;
    if (!event || event.lifecycle === "draft" || event.lifecycle === "archived") continue;
    out.campaigns++;

    const { data: stepRows } = await admin
      .from("event_email_steps")
      .select("id, position, subject, heading, body, cta_label, cta_url, banner_url, image_urls, blocks, delay_hours, enabled, template_name")
      .eq("campaign_id", campaign.id)
      .order("position", { ascending: true });
    const steps = ((stepRows ?? []) as any[]).filter((s) => s.enabled);
    if (!steps.length) continue;

    const offsets = cumulativeOffsets(steps);
    const anchorActivation = campaign.activated_at ? new Date(campaign.activated_at) : null;
    if (campaign.anchor === "activation" && !anchorActivation) continue;

    const recipients = await loadRecipients(admin, campaign.event_id);
    if (!recipients.length) continue;

    // Release stale claims: a run that was cut off mid-flight (rate limit,
    // crash) can leave "sending" rows behind. Those riders must stay eligible.
    await admin
      .from("event_email_sends")
      .delete()
      .eq("campaign_id", campaign.id)
      .eq("status", "sending")
      .lt("sent_at", new Date(Date.now() - 15 * 60_000).toISOString());

    const { data: sentRows } = await admin
      .from("event_email_sends")
      .select("step_id, email")
      .eq("campaign_id", campaign.id)
      .limit(20000);
    const done = new Set(((sentRows ?? []) as any[]).map((r) => `${r.step_id}|${r.email}`));


    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const offsetMs = offsets[i]! * 3600_000;
      let touched = false;

      for (const rider of recipients) {
        if (out.sent + out.suppressed >= limit) break;
        if (done.has(`${step.id}|${rider.email}`)) continue;

        const anchor =
          campaign.anchor === "entry"
            ? new Date(rider.enteredAt)
            : new Date(Math.max(anchorActivation!.getTime(), new Date(rider.enteredAt).getTime()));
        if (now.getTime() < anchor.getTime() + offsetMs) continue;

        touched = true;
        // Claim this (step, email) pair before sending so two overlapping runs
        // (e.g. cron and a manual trigger) can never send the same mail twice.
        const { error: claimError } = await admin.from("event_email_sends").insert({
          step_id: step.id,
          campaign_id: campaign.id,
          event_id: event.id,
          email: rider.email,
          status: "sending",
        });
        if (claimError) {
          done.add(`${step.id}|${rider.email}`);
          continue;
        }
        try {
          const r = await sendWorkflowEmail(admin, {
            campaignId: campaign.id,
            stepId: step.id,
            event,
            step,
            to: rider.email,
            name: rider.name,
            entrantId: rider.entrantId,
            extras: rider.extras,
            registrationRef: rider.registrationRef,
          });
          if (r === "sent") out.sent++;
          else out.suppressed++;
        } catch (err) {
          if (err instanceof EmailAPIError && err.status === 429) {
            // Give the claim back so this rider is picked up on the next run.
            await admin
              .from("event_email_sends")
              .delete()
              .eq("step_id", step.id)
              .eq("email", rider.email)
              .eq("status", "sending");
            out.errors.push("Hourly email allowance reached — the rest go out on the next run.");
            return out;
          }

          out.failed++;
          if (out.errors.length < 10) out.errors.push(`${rider.email}: ${(err as Error).message}`);
          await admin.from("event_email_sends").upsert(
            {
              step_id: step.id,
              campaign_id: campaign.id,
              event_id: event.id,
              email: rider.email,
              status: "failed",
              error_message: (err as Error).message.slice(0, 500),
            },
            { onConflict: "step_id,email" },
          );
        }
      }
      if (touched) out.steps++;
    }
  }

  return out;
}
