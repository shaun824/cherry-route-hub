// Admin: chat with the assistant to change a rental's plan. Each message updates
// the working plan shown below; "Save to event page" publishes it.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, X, Bot, Check } from "lucide-react";
import { applyRentalPlanFn, draftRentalPlanFn, getLivePlanTextFn, type RentalPlanDraft } from "@/lib/rental-plan.functions";

type Msg = { role: "user" | "bot"; text: string; changes?: string[]; needs?: string[]; error?: boolean };

function draftToText(d: RentalPlanDraft): string {
  const L = [
    "# EVENT DETAILS",
    `Event name: ${d.name}`, `Client: ${d.client_name ?? ""}`, `Client contact: ${d.client_contact ?? ""}`,
    `Venue: ${d.location ?? ""}`, `Build date: ${d.build_date ?? ""}`,
    `Event date (guests arrive): ${d.event_date ?? ""}`, `Breakdown date: ${d.breakdown_date ?? ""}`,
    "", "# CLIENT DESCRIPTION", d.description, "", "# RUN SHEET",
  ];
  let day = "";
  for (const t of d.runSheet) {
    if (t.day_label !== day) { day = t.day_label; L.push("", `## ${day}`); }
    const time = [t.start_time, t.end_time].filter(Boolean).join(" – ");
    L.push(`- ${[time, t.task, t.detail ?? "", t.location ?? ""].join(" | ").replace(/( \| )+$/, "")}`);
  }
  L.push("", "# EQUIPMENT");
  for (const g of d.equipment) L.push(`- ${[g.qty ?? "", g.qty_label ?? ""].join(" ").trim()} × ${g.name}${g.size_spec ? ` (${g.size_spec})` : ""}`);
  return L.join("\n");
}

export function RentalPlanChat({ eventId, onClose, onSaved }: { eventId: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const draftFn = useServerFn(draftRentalPlanFn);
  const applyFn = useServerFn(applyRentalPlanFn);
  const liveFn = useServerFn(getLivePlanTextFn);
  const [planText, setPlanText] = useState<string | null>(null);
  const [draft, setDraft] = useState<RentalPlanDraft | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "bot", text: "Tell me what to change — e.g. \"move the dates to 20–26 Dec\", \"make it 220 people\", \"add 4 more showers\". I'll update the plan below and tell you what changed." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"load" | "think" | "save" | null>("load");
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    liveFn({ data: { eventId } })
      .then((r) => setPlanText(r.text))
      .catch((e) => setMsgs((m) => [...m, { role: "bot", text: (e as Error).message, error: true }]))
      .finally(() => { setBusy(null); taRef.current?.focus(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);

  async function send() {
    const req = input.trim();
    if (!req || !planText || busy) return;
    setInput(""); setMsgs((m) => [...m, { role: "user", text: req }]); setBusy("think");
    try {
      const d = await draftFn({ data: { text: `${planText}\n\n# CHANGE REQUEST\n${req}`, attachment: null, mode: "edit" } });
      setDraft(d); setPlanText(draftToText(d));
      setMsgs((m) => [...m, { role: "bot", text: d.changes?.length ? "Done — the plan below is updated. Save when you're happy." : "I couldn't see anything to change for that. Try saying it another way.", changes: d.changes, needs: d.needs }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: (e as Error).message, error: true }]);
    } finally { setBusy(null); taRef.current?.focus(); }
  }

  async function save() {
    if (!draft?.event_date) return;
    setBusy("save");
    try {
      await applyFn({ data: { eventId, draft: { ...draft, event_date: draft.event_date } } });
      setDraft(null);
      setMsgs((m) => [...m, { role: "bot", text: "Saved — the event page, run sheet and equipment are live." }]);
      onSaved(`${draft.name} updated.`);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", text: (e as Error).message, error: true }]);
    } finally { setBusy(null); }
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-ink"><Bot className="h-4 w-4 text-cherry" /> Edit plan with the assistant</p>
        <button onClick={onClose} aria-label="Close" className="text-ink-soft"><X className="h-4 w-4" /></button>
      </div>

      <div className="max-h-80 space-y-2 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-ink px-3 py-2 text-sm text-background" : `max-w-[95%] text-sm ${m.error ? "text-cherry" : "text-ink"}`}>
              <p>{m.text}</p>
              {m.changes?.length ? (<><p className="mt-2 text-xs font-semibold">What changed</p><ul className="list-disc pl-5 text-xs text-ink-soft">{m.changes.map((c, j) => <li key={j}>{c}</li>)}</ul></>) : null}
              {m.needs?.length ? (<><p className="mt-2 text-xs font-semibold text-cherry">Still to sort out</p><ul className="list-disc pl-5 text-xs text-ink-soft">{m.needs.map((c, j) => <li key={j}>{c}</li>)}</ul></>) : null}
            </div>
          </div>
        ))}
        {busy === "think" ? <p className="flex items-center gap-2 text-xs text-ink-soft"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating the plan…</p> : null}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea ref={taRef} rows={2} value={input} disabled={busy === "load"} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={busy === "load" ? "Loading the live plan…" : "What should change?"}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button onClick={send} disabled={!input.trim() || !!busy || !planText} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl cherry-gradient text-white disabled:opacity-50">
          {busy === "think" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      {draft ? (
        <div className="flex gap-2">
          <button onClick={save} disabled={!!busy || !draft.event_date} className="flex items-center gap-1 rounded-xl cherry-gradient px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save to event page
          </button>
          <button onClick={() => { setDraft(null); setBusy("load"); liveFn({ data: { eventId } }).then((r) => setPlanText(r.text)).finally(() => setBusy(null)); setMsgs((m) => [...m, { role: "bot", text: "Changes discarded — back to the live plan." }]); }} disabled={!!busy} className="rounded-xl border border-border px-4 py-2 text-sm">Discard changes</button>
        </div>
      ) : null}

      <div>
        <p className="mb-1 text-xs font-semibold text-ink-soft">{draft ? "Updated plan (not saved yet)" : "Live plan"}</p>
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-[11px] text-ink">{planText ?? "Loading…"}</pre>
      </div>
    </div>
  );
}
