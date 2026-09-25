// "Teach the assistant" conversation. Admins can type, send a screenshot or
// photo, record a voice note or attach a PDF; the assistant replies with the
// note it drafted and the admin saves, edits or discards it.
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Check,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { saveTaughtNote, teachAssistant } from "@/lib/knowledge-teach.functions";

type Cat = "ops" | "product" | "suppliers" | "policies" | "general";
type Tier = "public" | "internal";

type Draft = {
  useful: boolean;
  title: string;
  summary: string;
  body: string;
  category: Cat;
  tier: Tier;
  reason: string;
};

type Msg =
  | { role: "admin"; text: string; attachment?: string }
  | { role: "bot"; text: string }
  | { role: "draft"; draft: Draft; redactions: string[]; savedId?: string };

type Pending = { kind: "image" | "audio" | "pdf"; mimeType: string; dataBase64: string; filename: string | null; label: string };

const MAX_BYTES = 8 * 1024 * 1024;

const CATS: { id: Cat; label: string }[] = [
  { id: "ops", label: "Operations" },
  { id: "product", label: "Product & entries" },
  { id: "suppliers", label: "Suppliers & sponsors" },
  { id: "policies", label: "Policies" },
  { id: "general", label: "General" },
];

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("read failed"));
    fr.onload = () => {
      const s = String(fr.result ?? "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    fr.readAsDataURL(blob);
  });
}

/** Shrink photos so a phone snap doesn't blow the upload size. */
async function shrinkImage(file: File): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error("no blob");
    return { blob, mimeType: "image/jpeg" };
  } catch {
    return { blob: file, mimeType: file.type || "image/jpeg" };
  }
}

export function KnowledgeTeachChat({
  events,
  compact = false,
}: {
  events: { id: string; name: string }[];
  compact?: boolean;
}) {
  const teach = useServerFn(teachAssistant);
  const save = useServerFn(saveTaughtNote);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>("");
  const [tier, setTier] = useState<"" | Tier>("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ---- voice notes -------------------------------------------------------
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const tickRef = useRef<number | null>(null);

  function stopTick() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTick();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 2048) {
          setError("That recording was empty — hold the mic a little longer.");
          return;
        }
        if (blob.size > MAX_BYTES) {
          setError("That voice note is too long — keep it under about three minutes.");
          return;
        }
        setPending({
          kind: "audio",
          mimeType: mime,
          dataBase64: await toBase64(blob),
          filename: null,
          label: `Voice note (${Math.max(1, Math.round(blob.size / 1024))} KB)`,
        });
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      tickRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s >= 179) recorderRef.current?.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("I couldn't reach the microphone — check the permission and try again.");
    }
  }

  useEffect(() => () => stopTick(), []);

  // ---- attachments -------------------------------------------------------
  async function attachFile(file: File) {
    setError(null);
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      setError("I can read pictures and PDFs. For anything else, paste the text instead.");
      return;
    }
    if (isPdf && file.size > MAX_BYTES) {
      setError("That PDF is too big — keep it under 8 MB.");
      return;
    }
    const { blob, mimeType } = isImage ? await shrinkImage(file) : { blob: file, mimeType: file.type };
    setPending({
      kind: isImage ? "image" : "pdf",
      mimeType,
      dataBase64: await toBase64(blob),
      filename: file.name,
      label: file.name,
    });
  }

  // ---- send --------------------------------------------------------------
  const teachM = useMutation({
    mutationFn: (v: { message: string; attachment: Pending | null }) =>
      teach({
        data: {
          message: v.message,
          attachment: v.attachment
            ? {
                kind: v.attachment.kind,
                mimeType: v.attachment.mimeType,
                dataBase64: v.attachment.dataBase64,
                filename: v.attachment.filename,
              }
            : null,
          noteId,
        },
      }),
    onSuccess: (res: any) => {
      const draft = res.draft as Draft;
      if (!draft.useful) {
        setMessages((m) => [
          ...m,
          { role: "bot", text: draft.reason || "There's nothing reusable in that one, so I haven't kept it." },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "bot", text: noteId ? "Here's the updated note — happy with it?" : "Got it. Here's what I understood:" },
        { role: "draft", draft: { ...draft, tier: (tier || draft.tier) as Tier }, redactions: res.redactions ?? [] },
      ]);
    },
    onError: (e: any) => setError(e?.message ?? "That didn't work — try again."),
  });

  function send() {
    const msg = text.trim();
    if ((!msg && !pending) || teachM.isPending) return;
    setError(null);
    setMessages((m) => [...m, { role: "admin", text: msg, attachment: pending?.label }]);
    setText("");
    const attachment = pending;
    setPending(null);
    teachM.mutate({ message: msg, attachment });
  }

  // ---- saving ------------------------------------------------------------
  const saveM = useMutation({
    mutationFn: (v: { index: number; draft: Draft }) =>
      save({
        data: {
          noteId,
          title: v.draft.title,
          body: v.draft.body,
          summary: v.draft.summary || null,
          category: v.draft.category,
          tier: v.draft.tier,
          eventId: eventId || null,
        },
      }).then((r: any) => ({ ...r, index: v.index })),
    onSuccess: (res: any) => {
      // Saved — the next message starts a new note instead of overwriting this one.
      setNoteId(null);
      setEditing(null);
      setMessages((m) => {
        const next = [...m];
        const slot = next[res.index];
        if (slot && slot.role === "draft") next[res.index] = { ...slot, savedId: res.id };
        next.push({
          role: "bot",
          text: res.updated
            ? "Updated — I'll answer with the corrected version from now on."
            : "Saved. I know that now — ask me about it in the normal chat. Keep talking if you want to correct or add to it.",
        });
        return next;
      });
    },
    onError: (e: any) => setError(e?.message ?? "Couldn't save that."),
  });

  function updateDraft(index: number, patch: Partial<Draft>) {
    setMessages((m) => {
      const next = [...m];
      const slot = next[index];
      if (slot && slot.role === "draft") next[index] = { ...slot, draft: { ...slot.draft, ...patch } };
      return next;
    });
  }

  function discard(index: number) {
    setMessages((m) => {
      const next = [...m];
      next.splice(index, 1);
      next.push({ role: "bot", text: "Dropped it — nothing was saved." });
      return next;
    });
    setEditing(null);
  }

  function startFresh() {
    setNoteId(null);
    setMessages((m) => [...m, { role: "bot", text: "Starting a fresh note — tell me the next thing." }]);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-2 pb-1">
          <Brain className="h-4 w-4 text-cherry" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Teach the assistant</p>
        </div>
        <p className="pb-3 text-xs text-ink-soft">
          Tell it something, send a screenshot or photo, record a voice note or attach a PDF. It writes
          the note, you check it, and it&apos;s live the moment you save. Personal details and commercial
          figures are stripped automatically.
        </p>

        <div className="flex flex-wrap gap-2 pb-3">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as "" | Tier)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">Let it decide who sees it</option>
            <option value="public">Riders can see it</option>
            <option value="internal">Crew &amp; admin only</option>
          </select>
          {noteId ? (
            <button
              type="button"
              onClick={startFresh}
              className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-ink-soft"
            >
              Start a new note
            </button>
          ) : null}
        </div>

        <div
          ref={listRef}
          className={`space-y-3 overflow-y-auto rounded-xl bg-background p-3 ${compact ? "max-h-[46vh]" : "max-h-[52vh] min-h-[220px]"}`}
        >
          {messages.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-soft">
              Nothing taught yet in this conversation.
            </p>
          ) : null}

          {messages.map((m, i) => {
            if (m.role === "admin") {
              return (
                <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-cherry px-3 py-2 text-sm text-white">
                  {m.text ? <p className="whitespace-pre-line">{m.text}</p> : null}
                  {m.attachment ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] opacity-90">
                      <Paperclip className="h-3 w-3" /> {m.attachment}
                    </p>
                  ) : null}
                </div>
              );
            }
            if (m.role === "bot") {
              return (
                <div key={i} className="w-fit max-w-[85%] rounded-2xl bg-secondary px-3 py-2 text-sm text-ink">
                  {m.text}
                </div>
              );
            }
            return (
              <DraftCard
                key={i}
                index={i}
                msg={m}
                editing={editing === i}
                saving={saveM.isPending}
                onEdit={() => setEditing(editing === i ? null : i)}
                onChange={(patch) => updateDraft(i, patch)}
                onSave={() => saveM.mutate({ index: i, draft: m.draft })}
                onDiscard={() => discard(i)}
              />
            );
          })}

          {teachM.isPending ? (
            <div className="flex w-fit items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-sm text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading that…
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-2 rounded-lg bg-cherry/10 px-3 py-2 text-xs font-semibold text-cherry">{error}</p>
        ) : null}

        {pending ? (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-cherry" />
            <span className="min-w-0 flex-1 truncate font-semibold">{pending.label}</span>
            <button type="button" onClick={() => setPending(null)} aria-label="Remove attachment">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mt-2 flex items-end gap-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="Tell the assistant something it should know…"
            className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cherry/40"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void attachFile(f);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void attachFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach a picture or PDF"
              className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-ink-soft hover:text-cherry"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => (recording ? recorderRef.current?.stop() : void startRecording())}
              aria-label={recording ? "Stop recording" : "Record a voice note"}
              className={`grid h-9 shrink-0 place-items-center rounded-full px-2.5 ${
                recording ? "bg-cherry text-white" : "w-9 bg-secondary text-ink-soft hover:text-cherry"
              }`}
            >
              {recording ? (
                <span className="flex items-center gap-1 text-[11px] font-bold">
                  <Square className="h-3 w-3" /> {seconds}s
                </span>
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <button
              type="submit"
              disabled={teachM.isPending || (!text.trim() && !pending)}
              aria-label="Send"
              className="grid h-9 w-9 place-items-center rounded-full bg-cherry text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
        <p className="pt-1.5 text-[11px] text-ink-soft">
          Tip: snap a photo of a printed sheet or whiteboard, or hold the mic and just say it.
        </p>
      </section>
    </div>
  );
}

function DraftCard({
  index,
  msg,
  editing,
  saving,
  onEdit,
  onChange,
  onSave,
  onDiscard,
}: {
  index: number;
  msg: Extract<Msg, { role: "draft" }>;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const d = msg.draft;
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
      {editing ? (
        <div className="space-y-2">
          <input
            value={d.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-bold"
          />
          <textarea
            value={d.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={7}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
          />
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-ink">{d.title}</p>
          {d.summary ? <p className="pt-0.5 text-xs text-ink-soft">{d.summary}</p> : null}
          <p className="whitespace-pre-line pt-2 text-sm text-ink">{d.body}</p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-3">
        <select
          value={d.category}
          onChange={(e) => onChange({ category: e.target.value as Cat })}
          className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
        >
          {CATS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={d.tier}
          onChange={(e) => onChange({ tier: e.target.value as Tier })}
          className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
        >
          <option value="public">Riders can see it</option>
          <option value="internal">Crew &amp; admin only</option>
        </select>
      </div>

      {msg.redactions.length ? (
        <p className="pt-2 text-[11px] text-ink-soft">
          Removed before saving: {msg.redactions.join(", ")}
        </p>
      ) : null}

      {msg.savedId ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-cherry">
          <Check className="h-3.5 w-3.5" /> Saved and live
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-ink"
          >
            <FileText className="h-3.5 w-3.5" /> {editing ? "Done editing" : "Edit first"}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-ink-soft"
          >
            <Trash2 className="h-3.5 w-3.5" /> Discard
          </button>
        </div>
      )}
      <span className="hidden">{index}</span>
    </div>
  );
}
