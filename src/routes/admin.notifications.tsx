import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Send, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  notificationStats,
  previewAudience,
  sendNotification,
} from "@/lib/notifications.functions";
import { sendTestPush } from "@/lib/push.functions";
import { WhatsappBroadcastPanel } from "@/components/whatsapp-broadcast";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotifications,
  head: () => ({
    meta: [
      { title: "Push notifications — Red Cherry admin" },
      { name: "description", content: "Compose and send push notifications to Red Cherry riders." },
    ],
  }),
});

const inp =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cherry";

type Audience = "all" | "event" | "batch";

function AdminNotifications() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [eventId, setEventId] = useState("");
  const [batch, setBatch] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);

  const events = useQuery({
    queryKey: ["admin", "notif", "events"],
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
    queryKey: ["admin", "notif", "batches", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data } = await supabase.from("event_entrants").select("batch").eq("event_id", eventId);
      return Array.from(new Set((data ?? []).map((r: any) => r.batch).filter(Boolean))).sort();
    },
  });

  const stats = useQuery({ queryKey: ["admin", "notif", "stats"], queryFn: () => notificationStats() });
  const history = useQuery({ queryKey: ["admin", "notif", "history"], queryFn: () => listNotifications() });

  const [reach, setReach] = useState<{ devices: number; riders: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    setReach(null);
    void previewAudience({ data: { audience, eventId: eventId || null, batch: batch || null } })
      .then((r) => alive && setReach(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [audience, eventId, batch]);

  const send = useMutation({
    mutationFn: () =>
      sendNotification({
        data: {
          title: title.trim(),
          body: body.trim(),
          url: url.trim(),
          audience,
          eventId: audience === "all" ? null : eventId || null,
          batch: audience === "batch" ? batch || null : null,
          urgent,
          whatsapp,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Sent to ${res.delivered} device${res.delivered === 1 ? "" : "s"}${res.whatsappSent ? ` · ${res.whatsappSent} WhatsApp` : ""}`,
      );
      setTitle("");
      setBody("");
      setUrl("");
      void qc.invalidateQueries({ queryKey: ["admin", "notif", "history"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Send failed"),
  });

  const test = useMutation({
    mutationFn: () =>
      sendTestPush({
        data: { title: title.trim() || "Test alert", body: body.trim() || "This is a test.", url: url.trim() || "/" },
      }),
    onSuccess: (r) =>
      r.delivered
        ? toast.success("Test sent to your devices")
        : toast("No devices registered for your account yet"),
    onError: (e: any) => toast.error(e?.message ?? "Test failed"),
  });

  const canSend = title.trim().length > 1 && body.trim().length > 1 && !send.isPending;
  const eventName = useMemo(
    () => events.data?.find((e: any) => e.id === eventId)?.name ?? "",
    [events.data, eventId],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Push notifications</h1>
        <p className="text-sm text-ink-soft">
          Send alerts straight to riders' phones — start times, weather, route changes, results.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard icon={Smartphone} label="Registered devices" value={stats.data?.devices ?? 0} />
        <StatCard icon={Users} label="Riders opted in" value={stats.data?.riders ?? 0} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Compose</h2>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Title</span>
            <input className={inp} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Start delayed by 30 minutes" />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Message</span>
            <textarea
              className={`${inp} min-h-24 resize-y`}
              value={body}
              maxLength={500}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Heavy mist at the start. Gold batch now leaves at 07:30, Silver at 07:45."
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">Opens (optional path)</span>
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

          <label className="flex items-start gap-2 rounded-xl border border-border p-3">
            <input type="checkbox" className="mt-0.5" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
            <span className="text-xs">
              <b className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-cherry" /> Urgent safety alert
              </b>
              <span className="text-ink-soft">
                Ignores rider notification preferences and shows with a vibration + sound. Use only for safety.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-xl border border-border p-3">
            <input type="checkbox" className="mt-0.5" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} />
            <span className="text-xs">
              <b>Also send on WhatsApp</b>{" "}
              <span className="text-ink-soft">
                (needs the Meta Cloud API secrets; only works for entrants with a phone number on file).
              </span>
            </span>
          </label>

          <div className="rounded-xl bg-secondary p-3 text-xs text-ink-soft">
            {reach === null ? (
              "Working out reach…"
            ) : (
              <>
                Will reach <b className="text-ink">{reach.devices}</b> device{reach.devices === 1 ? "" : "s"}
                {reach.riders !== null ? ` across ${reach.riders} rider${reach.riders === 1 ? "" : "s"}` : ""}
                {audience !== "all" && eventName ? ` on ${eventName}` : ""}.
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => send.mutate()}
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-lg bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {send.isPending ? "Sending…" : "Send now"}
            </button>
            <button
              onClick={() => test.mutate()}
              disabled={test.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <Bell className="h-4 w-4" />
              Send test to me
            </button>
          </div>
        </div>
      </section>

      <WhatsappBroadcastPanel />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Recent sends</h2>
        <ul className="mt-3 divide-y divide-border">
          {(history.data ?? []).map((n: any) => (
            <li key={n.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{n.title}</p>
                {n.urgent ? (
                  <span className="rounded bg-cherry/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cherry">
                    Urgent
                  </span>
                ) : null}
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-ink-soft">
                  {n.source}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.body}</p>
              <p className="mt-1 text-[11px] text-ink-soft">
                {new Date(n.sent_at).toLocaleString("en-ZA")} · {n.delivered_count} delivered ·{" "}
                {n.failed_count} failed · {n.clicked_count} opened
              </p>
            </li>
          ))}
          {!history.data?.length ? <li className="py-6 text-sm text-ink-soft">Nothing sent yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cherry/10 text-cherry">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-xl font-bold">{value}</p>
        <p className="text-xs text-ink-soft">{label}</p>
      </div>
    </div>
  );
}
