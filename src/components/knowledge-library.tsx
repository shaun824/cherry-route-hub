// Admin surface for the business knowledge library: paste documents/emails in,
// review what the AI distilled (already redacted), approve, and see what has
// been forwarded to the intake address.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock, RefreshCw, ShieldCheck, Trash2, Unlock } from "lucide-react";
import {
  deleteKnowledge,
  listKnowledge,
  listKnowledgeIntake,
  pasteKnowledge,
  retryKnowledgeIntake,
  setKnowledgeStatus,
  setKnowledgeTier,
} from "@/lib/knowledge.functions";

type Cat = "ops" | "product" | "suppliers" | "policies" | "general";

const CATS: { id: Cat | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "ops", label: "Operations" },
  { id: "product", label: "Product & entries" },
  { id: "suppliers", label: "Suppliers & sponsors" },
  { id: "policies", label: "Policies" },
  { id: "general", label: "General" },
];

export function KnowledgeLibrary({ events }: { events: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"suggested" | "approved" | "retired">("suggested");
  const [category, setCategory] = useState<Cat | "all">("all");

  const list = useServerFn(listKnowledge);
  const paste = useServerFn(pasteKnowledge);
  const approve = useServerFn(setKnowledgeStatus);
  const tierFn = useServerFn(setKnowledgeTier);
  const remove = useServerFn(deleteKnowledge);

  const rowsQ = useQuery({
    queryKey: ["knowledge", status, category],
    queryFn: () => list({ data: { status, category, tier: "all" } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["knowledge"] });

  const pasteM = useMutation({
    mutationFn: (v: { text: string; eventId: string | null; tier: "public" | "internal" | null }) =>
      paste({ data: { ...v, category: null, sourceRef: null } }),
    onSuccess: invalidate,
  });
  const statusM = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "retired" | "suggested" }) =>
      approve({ data: v }),
    onSuccess: invalidate,
  });
  const tierM = useMutation({
    mutationFn: (v: { id: string; tier: "public" | "internal" }) => tierFn({ data: v }),
    onSuccess: invalidate,
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });

  const [text, setText] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [tier, setTier] = useState<"" | "public" | "internal">("");

  const eventName = (id: string | null) =>
    id ? (events.find((e) => e.id === id)?.name ?? "Event") : "All events";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-2 pb-2">
          <ShieldCheck className="h-4 w-4 text-cherry" />
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Teach the assistant
          </p>
        </div>
        <p className="pb-3 text-xs text-ink-soft">
          Paste a rider email, a reply you sent, an operations note, a supplier brief or a policy.
          Personal details and every commercial figure are stripped before the AI ever sees it, and
          nothing goes live until you approve it.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Paste the email or document here…"
          className="w-full rounded-lg border border-border bg-background p-3 text-sm text-ink"
        />
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-ink"
          >
            <option value="">Applies to all events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as any)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-ink"
          >
            <option value="">Let the AI decide who may see it</option>
            <option value="public">Riders may be told this</option>
            <option value="internal">Internal — admins only</option>
          </select>
          <button
            onClick={() =>
              pasteM.mutate({
                text,
                eventId: eventId || null,
                tier: tier || null,
              })
            }
            disabled={pasteM.isPending || text.trim().length < 40}
            className="inline-flex items-center gap-1.5 rounded-lg cherry-gradient px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {pasteM.isPending ? "Learning…" : "Add to knowledge"}
          </button>
        </div>
        {pasteM.data ? (
          <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-xs text-ink-soft">
            {pasteM.data.ok
              ? `Saved as a draft: “${pasteM.data.draft.title}”.`
              : `Not added: ${pasteM.data.reason}`}
            {pasteM.data.redactions.length
              ? ` Removed ${pasteM.data.redactions.join(", ")}.`
              : " Nothing sensitive found."}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-1">
        {(["suggested", "approved", "retired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === s ? "bg-ink text-white" : "bg-secondary text-ink-soft"
            }`}
          >
            {s === "suggested" ? "Review queue" : s === "approved" ? "Live" : "Retired"}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              category === c.id ? "bg-cherry text-white" : "bg-secondary text-ink-soft"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {rowsQ.isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (rowsQ.data?.items ?? []).length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
          Nothing here yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {(rowsQ.data?.items ?? []).map((k: any) => (
            <li key={k.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-center gap-2 pb-1">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {eventName(k.event_id)}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  {k.category}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    k.tier === "internal"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  {k.tier === "internal" ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {k.tier === "internal" ? "internal only" : "riders may see"}
                </span>
                {k.source_kind === "email" ? (
                  <span className="rounded-full bg-cherry/10 px-2 py-0.5 text-[10px] font-bold text-cherry">
                    forwarded email
                  </span>
                ) : null}
              </div>
              <p className="font-semibold text-ink">{k.title}</p>
              {k.summary ? <p className="text-xs text-ink-soft">{k.summary}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{k.body}</p>
              {(k.redaction_notes ?? []).length ? (
                <p className="mt-2 text-[10px] text-ink-soft">
                  Redacted: {(k.redaction_notes as string[]).join(", ")}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {k.status !== "approved" ? (
                  <button
                    onClick={() => statusM.mutate({ id: k.id, status: "approved" })}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white"
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                ) : (
                  <button
                    onClick={() => statusM.mutate({ id: k.id, status: "retired" })}
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-ink-soft"
                  >
                    Retire
                  </button>
                )}
                <button
                  onClick={() =>
                    tierM.mutate({ id: k.id, tier: k.tier === "internal" ? "public" : "internal" })
                  }
                  className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-ink-soft"
                >
                  Make {k.tier === "internal" ? "rider-visible" : "internal"}
                </button>
                <button
                  onClick={() => deleteM.mutate(k.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-ink-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function KnowledgeIntake() {
  const qc = useQueryClient();
  const list = useServerFn(listKnowledgeIntake);
  const retry = useServerFn(retryKnowledgeIntake);

  const q = useQuery({ queryKey: ["knowledge-intake"], queryFn: () => list() });
  const retryM = useMutation({
    mutationFn: (id: string) => retry({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge-intake"] });
      qc.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-card p-4 text-xs text-ink-soft ring-1 ring-border">
        Forward rider emails to the app&apos;s intake hook and they become knowledge drafts
        automatically. Anything forwarded is cleaned of signatures and quoted history, then stripped
        of personal details and commercial figures before drafting. Nothing is used in an answer
        until you approve it in the library.
      </section>

      {q.isLoading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (q.data?.items ?? []).length === 0 ? (
        <p className="rounded-2xl bg-card p-8 text-center text-sm text-ink-soft ring-1 ring-border">
          Nothing forwarded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {(q.data?.items ?? []).map((i: any) => (
            <li key={i.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{i.subject || "(no subject)"}</p>
                  <p className="text-[11px] text-ink-soft">
                    {new Date(i.received_at).toLocaleString("en-ZA")}
                    {i.error ? ` · ${i.error}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      i.status === "processed"
                        ? "bg-emerald-100 text-emerald-900"
                        : i.status === "failed"
                          ? "bg-red-100 text-red-900"
                          : "bg-secondary text-ink-soft"
                    }`}
                  >
                    {i.status}
                  </span>
                  <button
                    onClick={() => retryM.mutate(i.id)}
                    disabled={retryM.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-ink-soft disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${retryM.isPending ? "animate-spin" : ""}`} />
                    Re-learn
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
