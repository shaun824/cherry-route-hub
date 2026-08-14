import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, Download, MessageCircle, Pencil, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { isBotMiss } from "@/lib/bot-handoff";
import { upsertLearnedFaq } from "@/lib/faq-learned.functions";

export const Route = createFileRoute("/admin/bot-log")({
  component: BotLogPage,
});

type Msg = {
  id: string;
  thread_id: string;
  body: string;
  is_bot: boolean;
  is_admin_msg: boolean;
  created_at: string;
};

type Pair = {
  id: string;
  threadId: string;
  eventId: string | null;
  question: string;
  answer: string;
  askedAt: string;
  answeredAt: string | null;
  missed: boolean;
  rider: string;
  event: string;
  channel: string;
};


function BotLogPage() {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "missed" | "answered">("all");

  const logQ = useQuery({
    queryKey: ["admin-bot-log"],
    queryFn: async (): Promise<Pair[]> => {
      const [{ data: msgs }, { data: threads }] = await Promise.all([
        supabase
          .from("admin_qa_messages")
          .select("id, thread_id, body, is_bot, is_admin_msg, created_at")
          .order("created_at", { ascending: true })
          .limit(2000),
        supabase
          .from("admin_qa_threads")
          .select(
            "id, channel, wa_name, wa_phone, event_id, event:events(name), rider:profiles!admin_qa_threads_rider_user_id_fkey(full_name, email)",
          ),

      ]);

      const meta = new Map<string, any>((threads ?? []).map((t: any) => [t.id, t]));
      const byThread = new Map<string, Msg[]>();
      for (const m of (msgs ?? []) as Msg[]) {
        const list = byThread.get(m.thread_id) ?? [];
        list.push(m);
        byThread.set(m.thread_id, list);
      }

      const pairs: Pair[] = [];
      for (const [threadId, list] of byThread) {
        const t = meta.get(threadId);
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          if (m.is_bot || m.is_admin_msg) continue;
          const reply = list.slice(i + 1).find((n) => n.is_bot || n.is_admin_msg);
          if (!reply || !reply.is_bot) continue;
          pairs.push({
            id: m.id,
            threadId,
            eventId: t?.event_id ?? null,
            question: m.body,

            answer: reply.body,
            askedAt: m.created_at,
            answeredAt: reply.created_at,
            missed: isBotMiss(reply.body),
            rider: t?.rider?.full_name ?? t?.rider?.email ?? t?.wa_name ?? t?.wa_phone ?? "Rider",
            event: t?.event?.name ?? "—",
            channel: t?.channel ?? "app",
          });
        }
      }
      return pairs.sort((a, b) => b.askedAt.localeCompare(a.askedAt));
    },
  });

  const rows = useMemo(() => {
    const all = logQ.data ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (only === "missed" && !p.missed) return false;
      if (only === "answered" && p.missed) return false;
      if (!needle) return true;
      return (
        p.question.toLowerCase().includes(needle) ||
        p.answer.toLowerCase().includes(needle) ||
        p.rider.toLowerCase().includes(needle) ||
        p.event.toLowerCase().includes(needle)
      );
    });
  }, [logQ.data, q, only]);

  const missedCount = (logQ.data ?? []).filter((p) => p.missed).length;

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      ["Asked at", "Event", "Rider", "Channel", "Question", "Bot answer", "Needed admin"].join(","),
      ...rows.map((p) =>
        [
          new Date(p.askedAt).toISOString(),
          esc(p.event),
          esc(p.rider),
          p.channel,
          esc(p.question),
          esc(p.answer),
          p.missed ? "yes" : "no",
        ].join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bot-questions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Bot Q&amp;A log</h1>
          <p className="text-sm text-ink-soft">
            Every question riders asked the event bot and exactly what it answered.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-background"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions, answers, riders…"
            className="w-full rounded-full bg-card py-2 pl-9 pr-3 text-sm ring-1 ring-border"
          />
        </div>
        {(
          [
            ["all", `All (${(logQ.data ?? []).length})`],
            ["answered", "Answered by bot"],
            ["missed", `Needed admin (${missedCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setOnly(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              only === key ? "bg-cherry text-white ring-transparent" : "bg-card text-ink-soft ring-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {logQ.isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
          No bot conversations yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
                <span className="font-semibold text-ink">{p.rider}</span>
                <span>· {p.event}</span>
                {p.channel === "whatsapp" ? (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3 text-[#25D366]" /> WhatsApp
                  </span>
                ) : null}
                <span>· {new Date(p.askedAt).toLocaleString("en-ZA")}</span>
                {p.missed ? (
                  <span className="rounded-full bg-cherry/10 px-2 py-0.5 font-semibold text-cherry">
                    Needed admin
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-semibold text-ink">{p.question}</p>
              <div className="mt-2 flex gap-2 rounded-xl bg-secondary/60 p-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
                <p className="whitespace-pre-wrap text-sm text-ink-soft">{p.answer}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link
                  to="/admin/messages"
                  search={{ thread: p.threadId }}
                  className="text-xs font-semibold text-cherry underline"
                >
                  Open thread
                </Link>
                <TeachAnswer pair={p} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lets an admin write the answer the bot should have given and save it as an approved FAQ. */
function TeachAnswer({ pair }: { pair: Pair }) {
  const save = useServerFn(upsertLearnedFaq);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(pair.question);
  const [answer, setAnswer] = useState(pair.missed ? "" : pair.answer);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-cherry"
      >
        <Pencil className="h-3 w-3" /> Teach the bot the right answer
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl bg-secondary/40 p-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-soft">
        Question
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg bg-background p-2 text-sm font-normal normal-case tracking-normal text-ink ring-1 ring-border focus:outline-none focus:ring-cherry"
        />
      </label>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-soft">
        Correct answer
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          placeholder="What the bot should say next time…"
          className="mt-1 w-full rounded-lg bg-background p-2 text-sm font-normal normal-case tracking-normal text-ink ring-1 ring-border focus:outline-none focus:ring-cherry"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={state === "saving" || question.trim().length < 3 || !answer.trim()}
          onClick={async () => {
            setState("saving");
            try {
              await save({
                data: {
                  eventId: pair.eventId,
                  question: question.trim().slice(0, 500),
                  answer: answer.trim().slice(0, 4000),
                  status: "approved",
                  expiresOn: null,
                  sourceThreadId: pair.threadId,
                },
              });
              setState("saved");
            } catch (e) {
              console.error("teach bot failed", e);
              setState("error");
            }
          }}
          className="rounded-full cherry-gradient px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save for the bot"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-ink-soft"
        >
          Cancel
        </button>
        {state === "saved" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
            <Check className="h-3 w-3" /> Saved — the bot will use this
          </span>
        ) : null}
        {state === "error" ? (
          <span className="text-xs font-semibold text-cherry">Couldn&apos;t save that.</span>
        ) : null}
      </div>
    </div>
  );
}

          ))}
        </ul>
      )}
    </div>
  );
}
