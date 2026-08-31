import { visibleInBackend } from "@/lib/event-window";
// Admin WhatsApp broadcast panel: readiness, approved templates and sending.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, Send, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  deleteWhatsAppTemplate,
  getWhatsAppReadiness,
  listWhatsAppTemplates,
  previewWhatsAppAudience,
  saveWhatsAppTemplate,
  sendWhatsAppBroadcast,
} from "@/lib/whatsapp.functions";

const inp =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cherry";

type Audience = "all" | "event" | "batch";

export function WhatsappBroadcastPanel() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<Audience>("event");
  const [eventId, setEventId] = useState("");
  const [batch, setBatch] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [alsoPush, setAlsoPush] = useState(true);

  const readiness = useQuery({ queryKey: ["wa", "readiness"], queryFn: () => getWhatsAppReadiness() });
  const templates = useQuery({ queryKey: ["wa", "templates"], queryFn: () => listWhatsAppTemplates() });

  const events = useQuery({
    queryKey: ["wa", "events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, days")
        .neq("status", "archived")
        .order("event_date", { ascending: true });
      return visibleInBackend((data ?? []) as { id: string; name: string; event_date: string; days?: unknown[] }[]);
    },
  });

  const batches = useQuery({
    queryKey: ["wa", "batches", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data } = await supabase.from("event_entrants").select("batch").eq("event_id", eventId);
      return Array.from(new Set((data ?? []).map((r: any) => r.batch).filter(Boolean))).sort();
    },
  });

  const reach = useQuery({
    queryKey: ["wa", "reach", audience, eventId, batch],
    queryFn: () =>
      previewWhatsAppAudience({ data: { audience, eventId: eventId || null, batch: batch || null } }),
  });

  const template = useMemo(
    () => (templates.data ?? []).find((t: any) => t.id === templateId) ?? null,
    [templates.data, templateId],
  );

  useEffect(() => {
    setVars(Array.from({ length: template?.variable_labels?.length ?? 0 }, () => ""));
  }, [template]);

  const send = useMutation({
    mutationFn: () =>
      sendWhatsAppBroadcast({
        data: {
          title: title.trim(),
          body: body.trim(),
          url: url.trim(),
          audience,
          eventId: audience === "all" ? null : eventId || null,
          batch: audience === "batch" ? batch || null : null,
          templateName: template?.name ?? null,
          templateLanguage: template?.language ?? null,
          templateVariables: vars,
          alsoPush,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(
        `WhatsApp: ${r.whatsappSent} sent${r.whatsappSkipped ? ` · ${r.whatsappSkipped} skipped` : ""}`,
      );
      setTitle("");
      setBody("");
      void qc.invalidateQueries({ queryKey: ["admin", "notif", "history"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Broadcast failed"),
  });

  const ready = Boolean((readiness.data as any)?.ready);
  const canSend = title.trim().length > 1 && body.trim().length > 1 && ready && !send.isPending;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-2">
        <MessageCircle className="mt-0.5 h-5 w-5 text-[#25D366]" />
        <div>
          <h2 className="font-display text-lg font-bold">WhatsApp broadcast</h2>
          <p className="text-xs text-ink-soft">
            Message riders on their phones. Outside Meta&apos;s 24-hour reply window you must pick an
            approved template.
          </p>
        </div>
      </div>

      <ReadinessStrip data={readiness.data as any} />

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">Approved template</span>
          <select className={inp} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">No template — free-form (only inside the 24h window)</option>
            {(templates.data ?? []).map((t: any) => (
              <option key={t.id} value={t.id} disabled={!t.active}>
                {t.name} ({t.language}){t.active ? "" : " — inactive"}
              </option>
            ))}
          </select>
        </label>

        {template?.variable_labels?.length ? (
          <div className="grid gap-2 rounded-xl border border-border p-3">
            <p className="text-xs font-semibold text-ink-soft">Template values</p>
            {template.variable_labels.map((label: string, i: number) => (
              <label key={i} className="grid gap-1">
                <span className="text-[11px] text-ink-soft">
                  {`{{${i + 1}}}`} · {label}
                </span>
                <input
                  className={inp}
                  value={vars[i] ?? ""}
                  onChange={(e) => setVars((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </label>
            ))}
            {template.body_preview ? (
              <p className="rounded-lg bg-secondary p-2 text-[11px] text-ink-soft whitespace-pre-line">
                {template.body_preview}
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">Title (push + WhatsApp heading)</span>
          <input className={inp} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">Message</span>
          <textarea
            className={`${inp} min-h-20 resize-y`}
            value={body}
            maxLength={500}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">Link (optional)</span>
          <input className={inp} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/my-events/…" />
        </label>

        <div className="grid gap-1.5">
          <span className="text-xs font-semibold text-ink-soft">Audience</span>
          <div className="flex flex-wrap gap-2">
            {(["all", "event", "batch"] as Audience[]).map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  audience === a ? "bg-cherry text-white" : "border border-border bg-background text-ink-soft"
                }`}
              >
                {a === "all" ? "Everyone" : a === "event" ? "One event" : "One batch"}
              </button>
            ))}
          </div>
        </div>

        {audience !== "all" && (
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Event</span>
            <select className={inp} value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">Select an event…</option>
              {(events.data ?? []).map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {audience === "batch" && eventId && (
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Batch</span>
            <select className={inp} value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">All batches</option>
              {(batches.data ?? []).map((b: any) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-xs">
          <input type="checkbox" checked={alsoPush} onChange={(e) => setAlsoPush(e.target.checked)} />
          <span>Also send as an in-app push notification</span>
        </label>

        <div className="rounded-xl bg-secondary p-3 text-xs text-ink-soft">
          {reach.isPending ? (
            "Working out reach…"
          ) : (
            <>
              <b className="text-ink">{reach.data?.reachable ?? 0}</b> rider
              {reach.data?.reachable === 1 ? "" : "s"} with a WhatsApp number
              {reach.data?.optedOut ? ` · ${reach.data.optedOut} opted out` : ""}.
            </>
          )}
        </div>

        <button
          onClick={() => send.mutate()}
          disabled={!canSend}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {send.isPending ? "Sending…" : "Send on WhatsApp"}
        </button>
        {!ready ? (
          <p className="text-[11px] text-ink-soft">
            Add the Meta Cloud API credentials before sending — the button stays disabled until then.
          </p>
        ) : null}
      </div>

      <TemplateManager />
    </section>
  );
}

function ReadinessStrip({ data }: { data: any }) {
  if (!data) return null;
  const items: Array<[string, boolean]> = [
    ["Access token", data.token],
    ["Phone number ID", data.phoneNumberId],
    ["Webhook verify token", data.verifyToken],
    ["App secret", data.appSecret],
  ];
  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap gap-2">
        {items.map(([label, ok]) => (
          <span
            key={label}
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              ok ? "bg-[#25D366]/15 text-[#128C3E]" : "bg-cherry/10 text-cherry"
            }`}
          >
            {ok ? "✓" : "•"} {label}
          </span>
        ))}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-soft">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Webhook URL for Meta: <code className="break-all">{data.webhookUrl}</code>
      </p>
    </div>
  );
}

function TemplateManager() {
  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ["wa", "templates"], queryFn: () => listWhatsAppTemplates() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [description, setDescription] = useState("");
  const [bodyPreview, setBodyPreview] = useState("");
  const [labels, setLabels] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveWhatsAppTemplate({
        data: {
          name: name.trim().toLowerCase(),
          language: language.trim() || "en",
          description: description.trim(),
          bodyPreview: bodyPreview.trim(),
          variableLabels: labels
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Template saved");
      setOpen(false);
      setName("");
      setDescription("");
      setBodyPreview("");
      setLabels("");
      void qc.invalidateQueries({ queryKey: ["wa", "templates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save template"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWhatsAppTemplate({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["wa", "templates"] }),
  });

  return (
    <div className="mt-6 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold">Approved templates</h3>
          <p className="text-[11px] text-ink-soft">
            Mirror the templates Meta approved in your WhatsApp Manager — names must match exactly.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {open ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-border p-3">
          <input className={inp} placeholder="template_name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inp} placeholder="Language code (en)" value={language} onChange={(e) => setLanguage(e.target.value)} />
          <input className={inp} placeholder="What it's for" value={description} onChange={(e) => setDescription(e.target.value)} />
          <textarea
            className={`${inp} min-h-16`}
            placeholder="Body preview, e.g. Hi {{1}}, your start time for {{2}} is …"
            value={bodyPreview}
            onChange={(e) => setBodyPreview(e.target.value)}
          />
          <input
            className={inp}
            placeholder="Variable labels, comma separated (Rider name, Event name)"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
          />
          <button
            onClick={() => save.mutate()}
            disabled={!name.trim() || save.isPending}
            className="w-fit rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save template"}
          </button>
        </div>
      ) : null}

      <ul className="mt-3 divide-y divide-border">
        {(templates.data ?? []).map((t: any) => (
          <li key={t.id} className="flex items-start justify-between gap-3 py-2">
            <div>
              <p className="text-sm font-semibold">
                {t.name} <span className="text-[11px] text-ink-soft">({t.language})</span>
              </p>
              {t.description ? <p className="text-[11px] text-ink-soft">{t.description}</p> : null}
            </div>
            <button onClick={() => remove.mutate(t.id)} className="text-ink-soft hover:text-cherry">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {!templates.data?.length ? (
          <li className="py-3 text-xs text-ink-soft">No templates yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
