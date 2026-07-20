import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckSquare,
  Info,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Phone,
  Route as RouteIcon,
  Send,
  Square,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { fetchEventInfo, type EventInfoBlock } from "@/lib/event-info";
import { RouteMap } from "@/components/route-map";
import type { EventDay, EventRoute } from "@/lib/mock-data";

export const Route = createFileRoute("/my-events/$eventId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, discipline, event_date, location, distance_km, description, hero_color, days")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  component: MyEventDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-ink-soft">
      Event not found.{" "}
      <Link to="/my-events" className="font-semibold text-cherry">
        Back
      </Link>
    </div>
  ),
});

type Tab = "info" | "chat" | "ask" | "packing";

function MyEventDetail() {
  const { event } = Route.useLoaderData();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("info");

  return (
    <div>
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${event.hero_color ?? "from-cherry to-cherry-deep"} px-5 pb-5 pt-14 text-white`}
      >
        <Link
          to="/my-events"
          className="absolute left-4 top-10 grid h-9 w-9 place-items-center rounded-full bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
          {event.discipline}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{event.name}</h1>
        <p className="mt-2 text-xs opacity-90">
          {new Date(event.event_date).toLocaleString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          {event.location}
        </p>
      </div>

      <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card/95 px-2 py-2 backdrop-blur">
        {(
          [
            { id: "info", label: "Info", icon: Info },
            { id: "packing", label: "Packing", icon: CheckSquare },
            { id: "chat", label: "Event chat", icon: MessageCircle },
            { id: "ask", label: "Ask admin", icon: MessagesSquare },
          ] as { id: Tab; label: string; icon: typeof Info }[]
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                active ? "bg-cherry text-white" : "text-ink-soft"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4">
        {tab === "info" && <InfoPanel eventId={event.id} description={event.description} distanceKm={event.distance_km} event={event} />}
        {tab === "packing" && <PackingPanel eventId={event.id} userId={user?.id ?? null} />}
        {tab === "chat" && <ChatPanel eventId={event.id} userId={user?.id ?? null} />}
        {tab === "ask" && <AskAdminPanel eventId={event.id} userId={user?.id ?? null} />}
      </div>
    </div>
  );
}

function InfoPanel({
  eventId,
  description,
  distanceKm,
  event,
}: {
  eventId: string;
  description: string | null;
  distanceKm: number;
  event: { days?: EventDay[] | null };
}) {
  const q = useQuery({ queryKey: ["event-info", eventId], queryFn: () => fetchEventInfo(eventId) });
  const info = q.data;
  const hasKml = (event.days ?? []).some((d) => (d.routes ?? []).some((r: EventRoute) => (r.kmlUrls ?? []).length > 0));

  return (
    <div className="space-y-4">
      {description ? (
        <section>
          <SectionTitle>About</SectionTitle>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{description}</p>
        </section>
      ) : null}

      {hasKml ? (
        <section>
          <SectionTitle>Route map</SectionTitle>
          <div className="mt-2">
            <RouteMap event={event as never} height="300px" />
            <Link
              to="/events/$eventId/map"
              params={{ eventId }}
              className="mt-2 inline-block text-[11px] font-semibold text-cherry"
            >
              Open fullscreen map →
            </Link>
          </div>
        </section>
      ) : null}


      <section>
        <SectionTitle>Venue</SectionTitle>
        {info?.venue_address ? (
          <div className="mt-2 rounded-xl bg-card p-3 ring-1 ring-border">
            <p className="flex items-start gap-2 text-sm font-semibold text-ink">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
              {info.venue_address}
            </p>
            {info.parking_notes ? (
              <p className="mt-2 text-xs text-ink-soft">{info.parking_notes}</p>
            ) : null}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.venue_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
            >
              Open in Google Maps
            </a>
          </div>
        ) : (
          <EmptyBlock>Venue details will appear here.</EmptyBlock>
        )}
      </section>

      <section>
        <SectionTitle>Route</SectionTitle>
        <div className="mt-2 rounded-xl bg-card p-3 ring-1 ring-border">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <RouteIcon className="h-4 w-4 text-cherry" />
            {(info?.distance_km ?? distanceKm) || 0} km
            {info?.elevation_m ? ` · ${info.elevation_m}m elevation` : ""}
          </p>
          {info?.route_description ? (
            <p className="mt-2 whitespace-pre-line text-xs text-ink-soft">{info.route_description}</p>
          ) : null}
          {info?.gpx_url ? (
            <a
              href={info.gpx_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-cherry underline"
            >
              Download GPX
            </a>
          ) : null}
        </div>
      </section>

      {info?.rules_md ? (
        <section>
          <SectionTitle>Rules</SectionTitle>
          <p className="mt-1.5 whitespace-pre-line rounded-xl bg-card p-3 text-sm text-ink-soft ring-1 ring-border">
            {info.rules_md}
          </p>
        </section>
      ) : null}

      {info?.faqs && info.faqs.length > 0 ? (
        <section>
          <SectionTitle>FAQs</SectionTitle>
          <ul className="mt-2 space-y-2">
            {info.faqs.map((f, i) => (
              <li key={i} className="rounded-xl bg-card p-3 ring-1 ring-border">
                <p className="text-sm font-semibold text-ink">{f.q}</p>
                <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {info?.emergency_contacts && info.emergency_contacts.length > 0 ? (
        <section>
          <SectionTitle>Emergency contacts</SectionTitle>
          <ul className="mt-2 space-y-2">
            {info.emergency_contacts.map((c, i) => (
              <li key={i}>
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center justify-between rounded-xl bg-card p-3 ring-1 ring-border"
                >
                  <span className="text-sm font-semibold text-ink">{c.label}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-cherry">
                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PackingPanel({ eventId, userId }: { eventId: string; userId: string | null }) {
  const q = useQuery({ queryKey: ["event-info", eventId], queryFn: () => fetchEventInfo(eventId) });
  const items = q.data?.packing_list ?? [];
  const stateQ = useQuery({
    queryKey: ["packing-state", eventId, userId],
    queryFn: async () => {
      if (!userId) return {} as Record<string, boolean>;
      const { data } = await supabase
        .from("packing_checklist_state")
        .select("item_key, checked")
        .eq("event_id", eventId)
        .eq("user_id", userId);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r) => (map[r.item_key] = r.checked));
      return map;
    },
    enabled: Boolean(userId),
  });
  const qc = useQueryClient();

  async function toggle(key: string) {
    if (!userId) return;
    const current = Boolean(stateQ.data?.[key]);
    qc.setQueryData(["packing-state", eventId, userId], {
      ...(stateQ.data ?? {}),
      [key]: !current,
    });
    await supabase.from("packing_checklist_state").upsert({
      user_id: userId,
      event_id: eventId,
      item_key: key,
      checked: !current,
    });
  }

  if (items.length === 0) {
    return <EmptyBlock>No packing list has been published yet.</EmptyBlock>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const checked = Boolean(stateQ.data?.[item.key]);
        return (
          <li key={item.key}>
            <button
              onClick={() => toggle(item.key)}
              className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left ring-1 ring-border"
            >
              {checked ? (
                <CheckSquare className="h-5 w-5 text-cherry" />
              ) : (
                <Square className="h-5 w-5 text-ink-soft" />
              )}
              <span
                className={`flex-1 text-sm ${checked ? "text-ink-soft line-through" : "font-semibold text-ink"}`}
              >
                {item.label}
              </span>
              {item.essential ? (
                <span className="rounded bg-cherry/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cherry-deep">
                  Essential
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChatPanel({ eventId, userId }: { eventId: string; userId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["event-chat", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_chat_messages")
        .select("id, event_id, author_id, body, created_at, profiles:profiles(full_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_chat_messages", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["event-chat", eventId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, qc]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [q.data]);

  async function send() {
    if (!text.trim() || !userId) return;
    setBusy(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase
      .from("event_chat_messages")
      .insert({ event_id: eventId, author_id: userId, body });
    if (error) console.warn(error);
    setBusy(false);
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl bg-card ring-1 ring-border">
      <div ref={listRef} className="flex-1 overflow-y-auto p-3">
        {(q.data ?? []).length === 0 ? (
          <p className="mt-6 text-center text-xs text-ink-soft">
            No messages yet. Say hi to your fellow riders 👋
          </p>
        ) : (
          <ul className="space-y-2">
            {(q.data ?? []).map((m: any) => {
              const mine = m.author_id === userId;
              const name = m.profiles?.full_name ?? "Rider";
              return (
                <li
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "ml-auto bg-cherry text-white" : "bg-secondary text-ink"
                  }`}
                >
                  {!mine && (
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {name}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message the group…"
          maxLength={1000}
          className="flex-1 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          className="grid h-9 w-9 place-items-center rounded-full cherry-gradient text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AskAdminPanel({ eventId, userId }: { eventId: string; userId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const threadQ = useQuery({
    queryKey: ["qa-thread", eventId, userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("admin_qa_threads")
        .select("id")
        .eq("event_id", eventId)
        .eq("rider_user_id", userId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: Boolean(userId),
  });

  const messagesQ = useQuery({
    queryKey: ["qa-messages", threadQ.data?.id],
    queryFn: async () => {
      if (!threadQ.data?.id) return [];
      const { data } = await supabase
        .from("admin_qa_messages")
        .select("id, author_id, body, is_admin_msg, created_at")
        .eq("thread_id", threadQ.data.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: Boolean(threadQ.data?.id),
  });

  useEffect(() => {
    if (!threadQ.data?.id) return;
    const ch = supabase
      .channel(`qa-${threadQ.data.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_qa_messages", filter: `thread_id=eq.${threadQ.data.id}` },
        () => qc.invalidateQueries({ queryKey: ["qa-messages", threadQ.data?.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadQ.data?.id, qc]);

  async function send() {
    if (!text.trim() || !userId) return;
    setBusy(true);
    const body = text.trim();
    setText("");
    let threadId = threadQ.data?.id;
    if (!threadId) {
      const { data } = await supabase
        .from("admin_qa_threads")
        .insert({ event_id: eventId, rider_user_id: userId })
        .select("id")
        .single();
      threadId = data?.id;
      qc.invalidateQueries({ queryKey: ["qa-thread", eventId, userId] });
    }
    if (threadId) {
      await supabase.from("admin_qa_messages").insert({
        thread_id: threadId,
        author_id: userId,
        body,
        is_admin_msg: false,
      });
      await supabase
        .from("admin_qa_threads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", threadId);
    }
    setBusy(false);
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl bg-card ring-1 ring-border">
      <div className="border-b border-border p-3 text-xs text-ink-soft">
        Private thread between you and Red Cherry admin. Ask anything about this event.
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {(messagesQ.data ?? []).length === 0 ? (
          <p className="mt-6 text-center text-xs text-ink-soft">
            No messages yet. Send us a question below.
          </p>
        ) : (
          <ul className="space-y-2">
            {(messagesQ.data ?? []).map((m: any) => {
              const mine = m.author_id === userId;
              return (
                <li
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "ml-auto bg-cherry text-white"
                      : "bg-emerald-100 text-emerald-950"
                  }`}
                >
                  {!mine && (
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      Red Cherry admin
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask Red Cherry admin…"
          maxLength={1000}
          className="flex-1 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          className="grid h-9 w-9 place-items-center rounded-full cherry-gradient text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[11px] font-bold uppercase tracking-wider text-ink-soft">
      {children}
    </h2>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-xs text-ink-soft">
      {children}
    </div>
  );
}
