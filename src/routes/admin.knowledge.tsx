import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Check, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteLearnedFaq,
  listBotGaps,
  listLearnedFaqs,
  runFaqSuggestions,
  setLearnedFaqStatus,
  upsertLearnedFaq,
} from "@/lib/faq-learned.functions";

export const Route = createFileRoute("/admin/knowledge")({
  head: () => ({
    meta: [
      { title: "Bot knowledge · Admin · Red Cherry Events" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminKnowledge,
});

type Status = "suggested" | "approved" | "rejected";

function AdminKnowledge() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Status | "gaps">("suggested");

  const list = useServerFn(listLearnedFaqs);
  const gaps = useServerFn(listBotGaps);
  const setStatus = useServerFn(setLearnedFaqStatus);
  const remove = useServerFn(deleteLearnedFaq);
  const runSuggest = useServerFn(runFaqSuggestions);

  const eventsQ = useQuery({
    queryKey: ["events-min"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name").order("event_date");
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const eventName = (id: string | null) =>
    id ? ((eventsQ.data ?? []).find((e: any) => e.id === id)?.name ?? "Event") : "All events";

  const faqsQ = useQuery({
    queryKey: ["learned-faqs", tab],
    queryFn: () => list({ data: { status: tab === "gaps" ? "approved" : tab } }),
    enabled: tab !== "gaps",
  });

  const gapsQ = useQuery({
    queryKey: ["bot-gaps"],
    queryFn: () => gaps(),
    enabled: tab === "gaps",
  });

  const suggestM = useMutation({
    mutationFn: () => runSuggest(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learned-faqs"] }),
  });

  const statusM = useMutation({
    mutationFn: (v: { id: string; status: Status }) => setStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learned-faqs"] }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learned-faqs"] }),
  });

  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4 pb-20">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-cherry">Assistant</p>
          <h1 className="font-display text-2xl font-bold text-ink">Bot knowledge base</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Real rider questions and your answers become reusable FAQ entries. Approved entries are
            the assistant&apos;s highest-priority source — ahead of event data and the website crawl.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => suggestM.mutate()}
            disabled={suggestM.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${suggestM.isPending ? "animate-spin" : ""}`} />
            {suggestM.isPending ? "Drafting…" : "Draft from chats"}
          </button>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-3 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add entry
          </button>
        </div>
      </header>

      {suggestM.data ? (
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-ink-soft">
          Scanned {suggestM.data.scanned} answered questions · {suggestM.data.created} new drafts ·{" "}
          {suggestM.data.skipped} skipped as personal or unclear.
        </p>
      ) : null}

      {adding ? (
        <FaqEditor
          events={eventsQ.data ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            qc.invalidateQueries({ queryKey: ["learned-faqs"] });
          }}
        />
      ) : null}

      <nav className="flex flex-wrap gap-1">
        {(
          [
            { id: "suggested", label: "Review queue" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
            { id: "gaps", label: "Unanswered questions" },
          ] as { id: Status | "gaps"; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === t.id ? "bg-cherry text-white" : "bg-secondary text-ink-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "gaps" ? (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-center gap-2 pb-2">
            <Sparkles className="h-4 w-4 text-cherry" />
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              Questions the bot could not answer
            </p>
          </div>
          {gapsQ.isLoading ? (
            <p className="text-xs text-ink-soft">Loading…</p>
          ) : (gapsQ.data?.items ?? []).length === 0 ? (
            <p className="text-xs text-ink-soft">
              Nothing here — the assistant has answered everything it was asked.
            </p>
          ) : (
            <ul className="space-y-2">
              {(gapsQ.data?.items ?? []).map((g, i) => (
                <li key={`${g.threadId}-${i}`} className="rounded-lg bg-background p-3 text-sm">
                  <p className="text-ink">{g.question}</p>
                  <p className="mt-1 text-[10px] text-ink-soft">
                    {new Date(g.at).toLocaleString("en-ZA")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : faqsQ.isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (faqsQ.data?.items ?? []).length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
          {tab === "suggested"
            ? "No drafts waiting. Hit “Draft from chats” to scan recent rider conversations."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {(faqsQ.data?.items ?? []).map((f: any) => (
            <li key={f.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {eventName(f.event_id)}
                </span>
                {f.expires_on ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                    expires {f.expires_on}
                  </span>
                ) : null}
                {f.source_kind === "arc" ? (
                  <span className="rounded-full bg-cherry/10 px-2 py-0.5 text-[10px] font-bold text-cherry">
                    from a full chat
                  </span>
                ) : null}
              </div>

              <p className="flex items-start gap-1.5 text-sm font-semibold text-ink">
                <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cherry" />
                {f.question}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{f.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {f.status !== "approved" && (
                  <button
                    onClick={() => statusM.mutate({ id: f.id, status: "approved" })}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                )}
                {f.status !== "rejected" && (
                  <button
                    onClick={() => statusM.mutate({ id: f.id, status: "rejected" })}
                    className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-[11px] font-bold text-ink"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                )}
                <EditToggle
                  faq={f}
                  events={eventsQ.data ?? []}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["learned-faqs"] })}
                />
                <button
                  onClick={() => deleteM.mutate(f.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-ink-soft hover:text-cherry"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditToggle({
  faq,
  events,
  onSaved,
}: {
  faq: any;
  events: any[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-ink-soft hover:text-cherry"
      >
        Edit
      </button>
    );
  }
  return (
    <div className="w-full">
      <FaqEditor
        faq={faq}
        events={events}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          onSaved();
        }}
      />
    </div>
  );
}

function FaqEditor({
  faq,
  events,
  onClose,
  onSaved,
}: {
  faq?: any;
  events: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertLearnedFaq);
  const [question, setQuestion] = useState<string>(faq?.question ?? "");
  const [answer, setAnswer] = useState<string>(faq?.answer ?? "");
  const [eventId, setEventId] = useState<string>(faq?.event_id ?? "");
  const [expires, setExpires] = useState<string>(faq?.expires_on ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(status: "approved" | "suggested") {
    if (!question.trim() || !answer.trim()) return;
    setBusy(true);
    try {
      await save({
        data: {
          id: faq?.id,
          eventId: eventId || null,
          question: question.trim(),
          answer: answer.trim(),
          status,
          expiresOn: expires || null,
          sourceThreadId: faq?.source_thread_id ?? null,
        },
      });
      onSaved();
    } catch (e) {
      console.error("save faq failed", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-background p-3 ring-1 ring-border">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question a rider would ask"
        className="w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry"
      />
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="The verified answer"
        className="w-full rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="rounded-lg bg-card px-2 py-1.5 text-xs ring-1 ring-border"
        >
          <option value="">All events (global)</option>
          {events.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
          Expires
          <input
            type="date"
            value={expires ?? ""}
            onChange={(e) => setExpires(e.target.value)}
            className="rounded-lg bg-card px-2 py-1.5 text-xs ring-1 ring-border"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => void submit("approved")}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
        >
          Save &amp; approve
        </button>
        <button
          onClick={() => void submit("suggested")}
          disabled={busy}
          className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-ink disabled:opacity-60"
        >
          Save as draft
        </button>
        <button onClick={onClose} className="px-2 text-[11px] font-bold text-ink-soft">
          Cancel
        </button>
      </div>
    </div>
  );
}
