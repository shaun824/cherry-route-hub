import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, MessageCircle, MessagesSquare, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { sendWhatsAppReply } from "@/lib/whatsapp.functions";
import { upsertLearnedFaq } from "@/lib/faq-learned.functions";

export const Route = createFileRoute("/admin/messages")({
  component: AdminMessagesPage,
});

function AdminMessagesPage() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [activeThread, setActiveThread] = useState<string | null>(null);

  const threadsQ = useQuery({
    queryKey: ["admin-qa-threads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_qa_threads")
        .select(
          "id, event_id, rider_user_id, channel, wa_phone, wa_name, last_message_at, created_at, event:events(name), rider:profiles!admin_qa_threads_rider_user_id_fkey(full_name, email)",
        )
        .order("last_message_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-qa-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_qa_threads" },
        () => qc.invalidateQueries({ queryKey: ["admin-qa-threads"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Rider messages</h1>
        <p className="text-sm text-ink-soft">Private Q&A threads between riders and admin.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl bg-card p-3 ring-1 ring-border">
          <div className="flex items-center gap-2 pb-2">
            <MessagesSquare className="h-4 w-4 text-cherry" />
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Threads</p>
          </div>
          {threadsQ.isLoading ? (
            <p className="text-xs text-ink-soft">Loading…</p>
          ) : (threadsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-ink-soft">No messages yet.</p>
          ) : (
            <ul className="space-y-1">
              {(threadsQ.data ?? []).map((t: any) => {
                const active = activeThread === t.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setActiveThread(t.id)}
                      className={`w-full rounded-lg px-2 py-2 text-left text-xs ${
                        active ? "bg-cherry text-white" : "hover:bg-secondary"
                      }`}
                    >
                      <p className="flex items-center gap-1 font-semibold">
                        {t.channel === "whatsapp" ? (
                          <MessageCircle className="h-3 w-3 shrink-0 text-[#25D366]" />
                        ) : null}
                        <span className="truncate">
                          {t.rider?.full_name ?? t.rider?.email ?? t.wa_name ?? t.wa_phone ?? "Rider"}
                        </span>
                      </p>
                      <p className={`truncate ${active ? "opacity-80" : "text-ink-soft"}`}>
                        {t.event?.name ?? "Event"}
                      </p>
                      {t.last_message_at ? (
                        <p className={`text-[10px] ${active ? "opacity-70" : "text-ink-soft"}`}>
                          {new Date(t.last_message_at).toLocaleString("en-ZA")}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="rounded-2xl bg-card p-3 ring-1 ring-border">
          {activeThread ? (
            <ThreadView
              threadId={activeThread}
              adminUserId={user?.id ?? null}
              thread={(threadsQ.data ?? []).find((t: any) => t.id === activeThread) ?? null}
            />
          ) : (
            <p className="p-8 text-center text-sm text-ink-soft">Select a thread on the left.</p>
          )}
        </main>
      </div>
    </div>
  );
}

function ThreadView({
  threadId,
  adminUserId,
  thread,
}: {
  threadId: string;
  adminUserId: string | null;
  thread: any | null;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const sendWa = useServerFn(sendWhatsAppReply);
  const saveFaq = useServerFn(upsertLearnedFaq);
  const isWhatsapp = thread?.channel === "whatsapp";

  const q = useQuery({
    queryKey: ["qa-messages", threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_qa_messages")
        .select("id, author_id, body, is_admin_msg, is_bot, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`qa-admin-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_qa_messages", filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["qa-messages", threadId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId, qc]);

  async function send() {
    if (!text.trim() || !adminUserId) return;
    const body = text.trim();
    setText("");
    await supabase.from("admin_qa_messages").insert({
      thread_id: threadId,
      author_id: adminUserId,
      body,
      is_admin_msg: true,
    });
    await supabase
      .from("admin_qa_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    if (isWhatsapp) {
      try {
        const res = await sendWa({ data: { threadId, body } });
        setNote(
          res.sent
            ? "Delivered to WhatsApp."
            : res.reason === "not-configured"
              ? "Saved, but WhatsApp sending isn't configured yet."
              : "Saved in-app only.",
        );
      } catch (e) {
        console.error("whatsapp send failed", e);
        setNote("Saved in-app, but WhatsApp delivery failed.");
      }
    }
  }

  /** Turns an admin answer + the rider question above it into a draft FAQ. */
  async function saveAsFaq(index: number) {
    const msgs = (q.data ?? []) as any[];
    const answer = msgs[index]?.body;
    let question = "";
    for (let i = index - 1; i >= 0; i--) {
      if (!msgs[i].is_admin_msg && !msgs[i].is_bot) {
        question = msgs[i].body;
        break;
      }
    }
    if (!answer || !question) {
      setNote("Couldn't find a rider question above that answer.");
      return;
    }
    try {
      await saveFaq({
        data: {
          eventId: thread?.event_id ?? null,
          question: question.slice(0, 500),
          answer: answer.slice(0, 4000),
          status: "suggested",
          expiresOn: null,
          sourceThreadId: threadId,
        },
      });
      setNote("Saved to the bot knowledge review queue.");
    } catch (e) {
      console.error("save faq failed", e);
      setNote("Couldn't save that as an FAQ.");
    }
  }

  return (
    <div className="flex h-[70vh] flex-col">
      {isWhatsapp ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 py-2 text-[11px] font-semibold text-ink-soft">
          <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
          WhatsApp thread{thread?.wa_phone ? ` · ${thread.wa_phone}` : ""} — replies are delivered
          over WhatsApp. Outside Meta&apos;s 24-hour window a template is required.
        </div>
      ) : null}
      {note ? <p className="px-3 py-1 text-[11px] text-ink-soft">{note}</p> : null}
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {(q.data ?? []).map((m: any, i: number) => {
          const mine = m.is_admin_msg;
          return (
            <div key={m.id} className={mine ? "ml-auto max-w-[80%]" : "max-w-[80%]"}>
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-cherry text-white" : "bg-secondary text-ink"
                }`}
              >
                <p className="whitespace-pre-line">{m.body}</p>
                <p className="mt-0.5 text-[10px] opacity-70">
                  {m.is_bot ? "Assistant · " : ""}
                  {new Date(m.created_at).toLocaleString("en-ZA")}
                </p>
              </div>
              {mine && !m.is_bot ? (
                <button
                  onClick={() => void saveAsFaq(i)}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-ink-soft hover:text-cherry"
                >
                  <BookmarkPlus className="h-3 w-3" /> Save as FAQ
                </button>
              ) : null}
            </div>
          );
        })}
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
          placeholder="Reply as admin…"
          className="flex-1 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry"
        />
        <button
          onClick={() => void send()}
          disabled={!text.trim()}
          className="grid h-9 w-9 place-items-center rounded-full cherry-gradient text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
