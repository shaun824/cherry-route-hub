import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Play, Pause, Plus, Send, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

import {
  listEmailWorkflows,
  saveEmailWorkflow,
  setWorkflowStatus,
  deleteEmailWorkflow,
  saveWorkflowStep,
  deleteWorkflowStep,
  sendWorkflowStepTest,
  runEmailWorkflowsNow,
} from "@/lib/email-workflows.functions";

export const Route = createFileRoute("/admin/email-workflows")({
  head: () => ({
    meta: [
      { title: "Email workflows · Red Cherry Events admin" },
      {
        name: "description",
        content: "Build a sequence of event emails — route info, sponsors, updates — with a delay between each one.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EmailWorkflowsPage,
});

const DELAYS = [
  { label: "Send straight away", hours: 0 },
  { label: "1 day later", hours: 24 },
  { label: "2 days later", hours: 48 },
  { label: "3 days later", hours: 72 },
  { label: "5 days later", hours: 120 },
  { label: "1 week later", hours: 168 },
  { label: "2 weeks later", hours: 336 },
  { label: "3 weeks later", hours: 504 },
  { label: "4 weeks later", hours: 672 },
];

function delayLabel(hours: number) {
  if (!hours) return "straight away";
  if (hours % 168 === 0) return `${hours / 168} week${hours / 168 > 1 ? "s" : ""} later`;
  if (hours % 24 === 0) return `${hours / 24} day${hours / 24 > 1 ? "s" : ""} later`;
  return `${hours} hours later`;
}

const input =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

function EmailWorkflowsPage() {
  const list = useServerFn(listEmailWorkflows);
  const saveCampaign = useServerFn(saveEmailWorkflow);
  const setStatus = useServerFn(setWorkflowStatus);
  const removeCampaign = useServerFn(deleteEmailWorkflow);
  const saveStep = useServerFn(saveWorkflowStep);
  const removeStep = useServerFn(deleteWorkflowStep);
  const testStep = useServerFn(sendWorkflowStepTest);
  const runNow = useServerFn(runEmailWorkflowsNow);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["email-workflows"], queryFn: () => list() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["email-workflows"] });

  const [newEventId, setNewEventId] = useState("");
  const [newName, setNewName] = useState("");
  const [newAnchor, setNewAnchor] = useState<"activation" | "entry">("entry");

  const events = (q.data?.events ?? []) as any[];
  const campaigns = (q.data?.campaigns ?? []) as any[];
  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? "Unknown event";

  const create = useMutation({
    mutationFn: () =>
      saveCampaign({ data: { eventId: newEventId, name: newName, anchor: newAnchor } }),
    onSuccess: () => {
      setNewName("");
      toast.success("Workflow created — now add your emails");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: (v: { campaignId: string; status: "draft" | "active" | "paused" }) =>
      setStatus({ data: v }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (campaignId: string) => removeCampaign({ data: { campaignId } }),
    onSuccess: () => {
      toast.success("Workflow deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const run = useMutation({
    mutationFn: (campaignId?: string) =>
      runNow({ data: campaignId ? { campaignId } : {} }),
    onSuccess: (r: any) =>
      toast.success(`${r.sent} sent, ${r.suppressed} skipped, ${r.failed} failed`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 pb-16">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">Email workflows</h1>
        <p className="text-sm text-ink-soft">
          Build a run of emails for each event — route details, sponsors, logistics — and set how
          long after the previous email each one goes out. Riders only ever get each email once, and
          nothing sends outside 07:00–20:00.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Plus className="h-4 w-4" /> New workflow
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          <select className={input} value={newEventId} onChange={(e) => setNewEventId(e.target.value)}>
            <option value="">Choose event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input
            className={input}
            placeholder="Workflow name (e.g. Race build-up)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            className={input}
            value={newAnchor}
            onChange={(e) => setNewAnchor(e.target.value as "activation" | "entry")}
          >
            <option value="entry">Count delays from each rider's entry date</option>
            <option value="activation">Count delays from when I switch it on</option>
          </select>
          <button
            disabled={!newEventId || !newName.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Create workflow
          </button>
        </div>
      </section>

      {q.isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : null}

      {campaigns.map((c) => (
        <CampaignCard
          key={c.id}
          campaign={c}
          eventName={eventName(c.event_id)}
          onStatus={(s) => status.mutate({ campaignId: c.id, status: s })}
          onDelete={() => {
            if (confirm("Delete this workflow and all its emails?")) del.mutate(c.id);
          }}
          onRun={() => run.mutate(c.id)}
          onSaveStep={async (payload) => {
            await saveStep({ data: { ...payload, campaignId: c.id } });
            refresh();
          }}
          onDeleteStep={async (stepId) => {
            await removeStep({ data: { stepId } });
            refresh();
          }}
          onTestStep={async (stepId) => {
            const r: any = await testStep({ data: { stepId } });
            toast.success(`Test sent to ${r.to}`);
          }}
        />
      ))}

      {!q.isLoading && !campaigns.length ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
          No workflows yet — create one above.
        </p>
      ) : null}
    </div>
  );
}

interface StepPayload {
  id?: string;
  subject: string;
  heading?: string | null;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  delayHours: number;
}

function CampaignCard({
  campaign,
  eventName,
  onStatus,
  onDelete,
  onRun,
  onSaveStep,
  onDeleteStep,
  onTestStep,
}: {
  campaign: any;
  eventName: string;
  onStatus: (s: "draft" | "active" | "paused") => void;
  onDelete: () => void;
  onRun: () => void;
  onSaveStep: (p: StepPayload) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onTestStep: (stepId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const steps = (campaign.steps ?? []) as any[];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{campaign.name}</h2>
          <p className="text-xs text-ink-soft">
            {eventName} · delays counted from{" "}
            {campaign.anchor === "entry" ? "each rider's entry date" : "when the workflow was switched on"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              campaign.status === "active"
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-ink-soft"
            }`}
          >
            {campaign.status}
          </span>
          {campaign.status === "active" ? (
            <button
              onClick={() => onStatus("paused")}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          ) : (
            <button
              onClick={() => onStatus("active")}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Play className="h-3.5 w-3.5" /> Switch on
            </button>
          )}
          <button
            onClick={onRun}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Send className="h-3.5 w-3.5" /> Send due now
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.id} className="rounded-xl border border-border/70 bg-secondary/30 p-3">
            <StepEditor
              index={i + 1}
              step={s}
              onSave={onSaveStep}
              onDelete={() => onDeleteStep(s.id)}
              onTest={() => onTestStep(s.id)}
            />
          </li>
        ))}
      </ol>

      {adding ? (
        <div className="rounded-xl border border-dashed border-border p-3">
          <StepEditor
            index={steps.length + 1}
            step={null}
            onSave={async (p) => {
              await onSaveStep(p);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add an email
        </button>
      )}
    </section>
  );
}

function StepEditor({
  index,
  step,
  onSave,
  onDelete,
  onTest,
  onCancel,
}: {
  index: number;
  step: any | null;
  onSave: (p: StepPayload) => Promise<void>;
  onDelete?: () => void;
  onTest?: () => void;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(!step);
  const [subject, setSubject] = useState(step?.subject ?? "");
  const [heading, setHeading] = useState(step?.heading ?? "");
  const [body, setBody] = useState(step?.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(step?.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(step?.cta_url ?? "");
  const [delayHours, setDelayHours] = useState<number>(step?.delay_hours ?? 24);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        ...(step?.id ? { id: step.id } : {}),
        subject,
        heading,
        body,
        ctaLabel,
        ctaUrl,
        delayHours,
      });
      toast.success("Saved");
      if (step) setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (step && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {index}. {step.subject}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-soft">
            <Clock className="h-3 w-3" /> {delayLabel(step.delay_hours)} · {step.sent ?? 0} sent
            {step.failed ? ` · ${step.failed} failed` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
            Edit
          </button>
          {onTest ? (
            <button
              onClick={() => void onTest()}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
            >
              <Mail className="h-3.5 w-3.5" /> Test
            </button>
          ) : null}
          {onDelete ? (
            <button
              onClick={() => {
                if (confirm("Delete this email from the workflow?")) void onDelete();
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive"
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Email {index}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <input className={input} placeholder="Subject line" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <select className={input} value={delayHours} onChange={(e) => setDelayHours(Number(e.target.value))}>
          {DELAYS.map((d) => (
            <option key={d.hours} value={d.hours}>
              {index === 1 ? d.label.replace("later", "after the start") : d.label}
            </option>
          ))}
        </select>
      </div>
      <input className={input} placeholder="Headline in the email (optional)" value={heading} onChange={(e) => setHeading(e.target.value)} />
      <textarea
        className={`${input} min-h-40`}
        placeholder="Write the email. Leave a blank line between paragraphs."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <input className={input} placeholder="Button label (optional)" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        <input className={input} placeholder="Button link (defaults to the event page)" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button
          disabled={busy || !subject.trim()}
          onClick={() => void save()}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Save email
        </button>
        {step ? (
          <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
            Cancel
          </button>
        ) : (
          <button onClick={onCancel} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
