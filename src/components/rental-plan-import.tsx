// Admin: upload a plan of action and turn it into (or update) a rental event page.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, FileUp, Loader2, Sparkles } from "lucide-react";
import { applyRentalPlanFn, draftRentalPlanFn, getLivePlanTextFn, type RentalPlanDraft } from "@/lib/rental-plan.functions";

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(f);
  });
}

export function RentalPlanImport({
  rentals,
  onDone,
  editRequest,
}: {
  rentals: { id: string; name: string }[];
  onDone: (msg: string) => void;
  /** When set (with a fresh nonce), preselect that rental and open its live plan for editing. */
  editRequest?: { id: string; nonce: number } | null;
}) {
  const draftFn = useServerFn(draftRentalPlanFn);
  const applyFn = useServerFn(applyRentalPlanFn);
  const liveFn = useServerFn(getLivePlanTextFn);
  const [liveText, setLiveText] = useState<string | null>(null);
  const [target, setTarget] = useState<string>("new");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<RentalPlanDraft | null>(null);
  const [busy, setBusy] = useState<"read" | "save" | "live" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

  async function read() {
    setErr(null); setBusy("read");
    try {
      const attachment = file
        ? { mimeType: file.type || "application/octet-stream", filename: file.name, dataBase64: await fileToBase64(file) }
        : null;
      setDraft(await draftFn({ data: { text, attachment } }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  async function openLiveFor(id: string) {
    if (id === "new") return;
    setErr(null); setBusy("live"); setDraft(null);
    try { setLiveText((await liveFn({ data: { eventId: id } })).text); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  async function openLive() {
    await openLiveFor(target);
  }

  // "Edit plan" on a rental card: preselect that event, open its live plan, scroll here.
  const lastNonce = useRef(0);
  useEffect(() => {
    if (!editRequest || editRequest.nonce === lastNonce.current) return;
    lastNonce.current = editRequest.nonce;
    setTarget(editRequest.id);
    setLiveText(null);
    setDraft(null);
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void openLiveFor(editRequest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRequest]);

  async function applyLive() {
    if (!liveText?.trim()) return;
    setErr(null); setBusy("read");
    try { setDraft(await draftFn({ data: { text: liveText, attachment: null, mode: "edit" } })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  async function save() {
    if (!draft) return;
    if (!draft.event_date) { setErr("Add the event date before saving."); return; }
    if (target !== "new" && !confirm("This replaces the event's details, run sheet and equipment list. Continue?")) return;
    setErr(null); setBusy("save");
    try {
      await applyFn({ data: { eventId: target === "new" ? null : target, draft: { ...draft, event_date: draft.event_date } } });
      setDraft(null); setText(""); setFile(null); setLiveText(null);
      onDone(`${draft.name} is ${target === "new" ? "created (private)" : "updated"} — copy the client link to share it.`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  const set = (k: keyof RentalPlanDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => (d ? { ...d, [k]: e.target.value || null } : d));

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink"><Sparkles className="h-4 w-4 text-cherry" /> Load a plan of action</h2>
        <p className="text-xs text-ink-soft">Upload the plan (PDF, Word, photo) or paste it. We fill in the event page, run sheet and equipment — check it, then save.</p>
      </div>
      <select className={input} value={target} onChange={(e) => { setTarget(e.target.value); setLiveText(null); setDraft(null); }}>
        <option value="new">Create a new rental event</option>
        {rentals.map((r) => <option key={r.id} value={r.id}>Update: {r.name}</option>)}
      </select>
      {target !== "new" ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
          <button onClick={openLive} disabled={busy !== null} className="flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60">
            {busy === "live" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {liveText === null ? "Edit the live plan as text" : "Reload live plan"}
          </button>
          {liveText !== null ? (
            <>
              <p className="text-xs text-ink-soft">Change anything under the headings, or add new info under "Extra notes". The assistant reworks it into a full, detailed page for you to check before it goes live.</p>
              <textarea aria-label="Live plan text" className={`${input} font-mono text-xs`} rows={22} value={liveText} onChange={(e) => setLiveText(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={applyLive} disabled={busy !== null} className="flex items-center gap-1 rounded-xl cherry-gradient px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                  {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy === "read" ? "Working it in…" : "Apply changes"}
                </button>
                <button onClick={() => setLiveText(null)} className="rounded-xl border border-border px-4 py-2 text-sm">Close</button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {liveText === null ? (<>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-ink-soft">
        <FileUp className="h-4 w-4" />
        <span className="truncate">{file ? file.name : "Choose plan file (PDF, .docx, image, text)"}</span>
        <input type="file" className="hidden" accept=".pdf,.docx,.txt,image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <textarea className={input} rows={3} placeholder="…or paste the plan / extra notes here" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={read} disabled={busy !== null} className="flex items-center gap-1 rounded-xl cherry-gradient px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
        {busy === "read" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy === "read" ? "Reading plan…" : "Read plan"}
      </button>
      </>) : null}
      {err ? <p className="text-sm text-cherry">{err}</p> : null}

      {draft ? (
        <div className="space-y-3 border-t border-border pt-3">
          <input className={input} value={draft.name} onChange={set("name")} placeholder="Event name" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} value={draft.client_name ?? ""} onChange={set("client_name")} placeholder="Client name" />
            <input className={input} value={draft.client_contact ?? ""} onChange={set("client_contact")} placeholder="Client contact" />
          </div>
          <input className={input} value={draft.location ?? ""} onChange={set("location")} placeholder="Venue" />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-ink-soft">Build date<input type="date" className={input} value={draft.build_date ?? ""} onChange={set("build_date")} /></label>
            <label className="text-xs text-ink-soft">Event date<input type="date" className={input} value={draft.event_date ?? ""} onChange={set("event_date")} /></label>
            <label className="text-xs text-ink-soft">Breakdown date<input type="date" className={input} value={draft.breakdown_date ?? ""} onChange={set("breakdown_date")} /></label>
          </div>
          <textarea className={input} rows={6} value={draft.description} onChange={set("description")} />
          <details className="rounded-xl bg-muted p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-ink">Run sheet ({draft.runSheet.length} tasks)</summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-soft">
              {draft.runSheet.map((t, i) => <li key={i}><b>{t.day_label}</b>{t.start_time ? ` ${t.start_time}` : ""} — {t.task}</li>)}
            </ul>
          </details>
          <details className="rounded-xl bg-muted p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-ink">Equipment ({draft.equipment.length} items)</summary>
            <ul className="mt-2 space-y-1 text-xs text-ink-soft">
              {draft.equipment.map((g, i) => <li key={i}>{g.qty ?? ""} {g.qty_label ?? ""} {g.name}{g.size_spec ? ` (${g.size_spec})` : ""}</li>)}
            </ul>
          </details>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy !== null} className="rounded-xl cherry-gradient px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busy === "save" ? "Saving…" : target === "new" ? "Create event page" : "Update event page"}
            </button>
            <button onClick={() => setDraft(null)} className="rounded-xl border border-border px-4 py-2 text-sm">Discard</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
