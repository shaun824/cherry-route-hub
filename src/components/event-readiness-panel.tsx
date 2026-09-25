// Admin-only event ops readiness checklist: answer standard crew questions and
// real unanswered crew questions by text or voice. Crew just get the answers.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Mic, Square, CircleAlert } from "lucide-react";
import { READINESS_SECTIONS } from "@/lib/event-readiness";
import { answerReadinessQuestion, getEventReadiness } from "@/lib/event-readiness.functions";

type Target = { questionId: string | null; gapMessageId: string | null; question: string };

export function EventReadinessPanel({ events }: { events: { id: string; name: string }[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const get = useServerFn(getEventReadiness);
  const q = useQuery({
    queryKey: ["event-readiness", eventId],
    queryFn: () => get({ data: { eventId } }),
    enabled: !!eventId,
  });
  const answers = q.data?.answers ?? {};

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Event readiness</p>
        <p className="pb-3 pt-1 text-xs text-ink-soft">
          Answer each question once — typed or as a quick voice note. Answers are internal: crew get
          them from the assistant, riders never see them. Only admins can add or change answers.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-ink"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          {q.data ? (
            <span className="text-sm font-semibold text-ink">
              {q.data.answered} of {q.data.total} answered
            </span>
          ) : null}
        </div>
      </section>

      {q.isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : null}

      {q.data && q.data.gaps.length ? (
        <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="pb-2 text-xs font-bold uppercase tracking-wider text-cherry">
            Unanswered crew questions ({q.data.gaps.length})
          </p>
          <ul className="space-y-2">
            {q.data.gaps.map((g) => (
              <QuestionRow
                key={g.id}
                eventId={eventId}
                open={open === g.id}
                onToggle={() => setOpen(open === g.id ? null : g.id)}
                target={{ questionId: null, gapMessageId: g.id, question: g.question }}
                answered={null}
                meta={new Date(g.at).toLocaleDateString("en-ZA")}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {q.data
        ? READINESS_SECTIONS.map((s) => (
            <section key={s.section} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="pb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">{s.section}</p>
              <ul className="space-y-2">
                {s.questions.map(([id, question]) => (
                  <QuestionRow
                    key={id}
                    eventId={eventId}
                    open={open === id}
                    onToggle={() => setOpen(open === id ? null : id)}
                    target={{ questionId: id, gapMessageId: null, question }}
                    answered={answers[id]?.body ?? null}
                  />
                ))}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}

function QuestionRow({
  eventId,
  target,
  answered,
  open,
  onToggle,
  meta,
}: {
  eventId: string;
  target: Target;
  answered: string | null;
  open: boolean;
  onToggle: () => void;
  meta?: string;
}) {
  const qc = useQueryClient();
  const answer = useServerFn(answerReadinessQuestion);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);

  const m = useMutation({
    mutationFn: (audio: { mimeType: string; dataBase64: string } | null) =>
      answer({ data: { eventId, ...target, message: text, audio } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["event-readiness", eventId] });
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunks, { type: mime });
      const fr = new FileReader();
      fr.onload = () => {
        const b64 = String(fr.result).split(",")[1] ?? "";
        m.mutate({ mimeType: mime, dataBase64: b64 });
      };
      fr.readAsDataURL(blob);
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }

  return (
    <li className="rounded-lg bg-background p-3">
      <button onClick={onToggle} className="flex w-full items-start gap-2 text-left">
        {answered ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        <span className="flex-1 text-sm font-medium text-ink">{target.question}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            answered ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
          }`}
        >
          {answered ? "Answered" : "Needed"}
        </span>
      </button>
      {meta ? <p className="pl-6 text-[11px] text-ink-soft">Asked {meta}</p> : null}
      {open ? (
        <div className="mt-2 space-y-2 pl-6">
          {answered ? <p className="whitespace-pre-wrap text-xs text-ink-soft">{answered}</p> : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={answered ? "Add to or correct this answer…" : "Type the answer…"}
            className="w-full rounded-lg border border-border bg-card p-2 text-sm text-ink"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => m.mutate(null)}
              disabled={m.isPending || recording || text.trim().length < 3}
              className="rounded-lg cherry-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {m.isPending ? "Saving…" : "Save answer"}
            </button>
            <button
              onClick={toggleRecord}
              disabled={m.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-ink disabled:opacity-60"
            >
              {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {recording ? "Stop & save" : "Voice note"}
            </button>
          </div>
          {m.error ? <p className="text-xs text-destructive">{(m.error as Error).message}</p> : null}
          {m.data ? <p className="text-xs text-emerald-700">Saved — crew can ask the assistant now.</p> : null}
        </div>
      ) : null}
    </li>
  );
}
