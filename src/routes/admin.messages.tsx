import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

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
          "id, event_id, rider_user_id, last_message_at, created_at, event:events(name), rider:profiles!admin_qa_threads_rider_user_id_fkey(full_name, email)",
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
                      <p className="font-semibold">{t.rider?.full_name ?? t.rider?.email ?? "Rider"}</p>
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
            <ThreadView threadId={activeThread} adminUserId={user?.id ?? null} />
          ) : (
            <p className="p-8 text-center text-sm text-ink-soft">Select a thread on the left.</p>
          )}
        </main>
      </div>
    </div>
  );
}

function ThreadView({ threadId, adminUserId }: { threadId: string; adminUserId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const q = useQuery({
    queryKey: ["qa-messages", threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_qa_messages")
        .select("id, author_id, body, is_admin_msg, created_at")
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
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {(q.data ?? []).map((m: any) => {
          const mine = m.is_admin_msg;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                mine ? "ml-auto bg-cherry text-white" : "bg-secondary text-ink"
              }`}
            >
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="mt-0.5 text-[10px] opacity-70">
                {new Date(m.created_at).toLocaleString("en-ZA")}
              </p>
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
