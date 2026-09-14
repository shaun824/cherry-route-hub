import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Monitor,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  getWorkflowStep,
  renderWorkflowStepPreview,
  saveWorkflowStep,
  sendWorkflowStepTest,
} from "@/lib/email-workflows.functions";
import {
  BLOCK_LIBRARY,
  blockLabel,
  blockSummary,
  blocksFromLegacyStep,
  blocksToPlainText,
  makeBlock,
  newBlockId,
  type EmailBlock,
  type EmailBlockType,
} from "@/lib/email-blocks";

export const Route = createFileRoute("/admin/email-builder/$stepId")({
  head: () => ({
    meta: [
      { title: "Email builder · Red Cherry Events admin" },
      { name: "description", content: "Build an event email visually — headings, pictures, buttons — and publish it to the workflow." },
      { property: "og:title", content: "Email builder · Red Cherry Events admin" },
      { property: "og:description", content: "Build an event email visually — headings, pictures, buttons — and publish it to the workflow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EmailBuilderPage,
});

const input = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
const smallBtn = "rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted";

const DELAYS = [
  { label: "Send straight away", hours: 0 },
  { label: "1 day later", hours: 24 },
  { label: "2 days later", hours: 48 },
  { label: "3 days later", hours: 72 },
  { label: "5 days later", hours: 120 },
  { label: "1 week later", hours: 168 },
  { label: "2 weeks later", hours: 336 },
  { label: "3 weeks later", hours: 504 },
  { label: "4 weeks later", hours: 672 },
];

function EmailBuilderPage() {
  const { stepId } = Route.useParams();
  const load = useServerFn(getWorkflowStep);
  const save = useServerFn(saveWorkflowStep);
  const test = useServerFn(sendWorkflowStepTest);
  const renderPreview = useServerFn(renderWorkflowStepPreview);

  const q = useQuery({ queryKey: ["email-step", stepId], queryFn: () => load({ data: { stepId } }) });

  const [subject, setSubject] = useState("");
  const [heading, setHeading] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [delayHours, setDelayHours] = useState(24);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const data = q.data as any;
  const eventId = data?.event?.id as string | undefined;
  const published = !!data?.step?.enabled;

  useEffect(() => {
    if (!data?.step || loadedFor.current === stepId) return;
    loadedFor.current = stepId;
    const s = data.step;
    setSubject(s.subject ?? "");
    setHeading(s.heading ?? "");
    setBannerUrl(s.bannerUrl ?? "");
    setCtaLabel(s.ctaLabel ?? "");
    setCtaUrl(s.ctaUrl ?? "");
    setDelayHours(s.delayHours ?? 24);
    const existing = (s.blocks ?? []) as EmailBlock[];
    setBlocks(
      existing.length
        ? existing
        : blocksFromLegacyStep({ body: s.body, image_urls: s.imageUrls, cta_label: s.ctaLabel, cta_url: s.ctaUrl }),
    );
  }, [data, stepId]);

  // Live preview: rendered by the same code that sends the real email.
  const previewKey = useMemo(
    () => JSON.stringify({ subject, heading, bannerUrl, ctaLabel, ctaUrl, blocks }),
    [subject, heading, bannerUrl, ctaLabel, ctaUrl, blocks],
  );

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r: any = await renderPreview({
          data: { eventId, subject, heading, bannerUrl, blocks, body: blocksToPlainText(blocks), ctaLabel, ctaUrl },
        });
        if (!cancelled) setHtml(r.html ?? "");
      } catch {
        /* preview only — the editor keeps working */
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, eventId]);

  const mutate = (fn: (b: EmailBlock[]) => EmailBlock[]) => {
    setBlocks((prev) => fn(prev));
    setDirty(true);
  };

  const add = (type: EmailBlockType) => {
    const block = makeBlock(type);
    mutate((prev) => {
      const at = selected ? prev.findIndex((b) => b.id === selected) + 1 : prev.length;
      const next = prev.slice();
      next.splice(at, 0, block);
      return next;
    });
    setSelected(block.id);
  };

  const patch = (id: string, changes: Record<string, unknown>) =>
    mutate((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...changes } as EmailBlock) : b)));

  const move = (id: string, dir: -1 | 1) =>
    mutate((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const a = next[i]!;
      next[i] = next[j]!;
      next[j] = a;
      return next;
    });

  const duplicate = (id: string) =>
    mutate((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const next = prev.slice();
      next.splice(i + 1, 0, { ...(prev[i] as EmailBlock), id: newBlockId() });
      return next;
    });

  const remove = (id: string) => {
    mutate((prev) => prev.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  };

  const persist = async (enabled?: boolean) => {
    if (!subject.trim()) {
      toast.error("The email needs a subject line");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          id: stepId,
          campaignId: data.step.campaignId,
          subject,
          heading,
          body: blocksToPlainText(blocks),
          blocks,
          ctaLabel,
          ctaUrl,
          bannerUrl,
          imageUrls: [],
          delayHours,
          ...(enabled === undefined ? {} : { enabled }),
        },
      });
      setDirty(false);
      toast.success(enabled ? "Published — this email is live in the workflow" : "Saved");
      await q.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      if (dirty) await persist();
      const r: any = await test({ data: { stepId } });
      toast.success(`Test sent to ${r.to}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="p-6 text-sm text-ink-soft">Opening the email…</p>;
  if (q.isError) return <p className="p-6 text-sm text-destructive">{(q.error as Error).message}</p>;

  const active = blocks.find((b) => b.id === selected) ?? null;

  return (
    <div className="space-y-4 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/admin/email-workflows" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to workflows
          </Link>
          <h1 className="mt-1 truncate font-display text-2xl font-bold">{subject || "Untitled email"}</h1>
          <p className="text-sm text-ink-soft">
            {data?.campaign?.name ?? "Workflow"} · {data?.event?.name ?? "Event"} ·{" "}
            {published ? "live in the workflow" : "not published yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void sendTest()} disabled={busy} className={smallBtn}>
            <span className="flex items-center gap-1">
              <Send className="h-3.5 w-3.5" /> Send me a test
            </span>
          </button>
          <button onClick={() => void persist()} disabled={busy} className={smallBtn}>
            Save draft
          </button>
          <button
            onClick={() => void persist(true)}
            disabled={busy}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Publish
            </span>
          </button>
        </div>
      </header>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-ink-soft">
          Subject line
          <input className={`${input} mt-1`} value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} />
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          When it goes out
          <select className={`${input} mt-1`} value={delayHours} onChange={(e) => { setDelayHours(Number(e.target.value)); setDirty(true); }}>
            {DELAYS.map((d) => (
              <option key={d.hours} value={d.hours}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          Headline at the top (optional)
          <input className={`${input} mt-1`} value={heading} onChange={(e) => { setHeading(e.target.value); setDirty(true); }} />
        </label>
        <label className="text-xs font-semibold text-ink-soft">
          Top picture link (optional — the event cover is used otherwise)
          <input className={`${input} mt-1`} value={bannerUrl} onChange={(e) => { setBannerUrl(e.target.value); setDirty(true); }} placeholder="https://…" />
        </label>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Add to the email</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BLOCK_LIBRARY.map((b) => (
                <button key={b.type} onClick={() => add(b.type)} className={smallBtn} title={b.hint}>
                  + {b.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">The email, part by part</p>
            {blocks.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Nothing here yet — add a heading or a paragraph above.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {blocks.map((b, i) => (
                  <li
                    key={b.id}
                    className={`rounded-xl border p-2 ${selected === b.id ? "border-primary bg-muted/50" : "border-border"}`}
                  >
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(selected === b.id ? null : b.id)} className="min-w-0 flex-1 text-left">
                        <span className="block text-sm font-semibold">
                          {i + 1}. {blockLabel(b)}
                        </span>
                        <span className="block truncate text-xs text-ink-soft">{blockSummary(b)}</span>
                      </button>
                      <button onClick={() => move(b.id, -1)} className={smallBtn} aria-label="Move up">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => move(b.id, 1)} className={smallBtn} aria-label="Move down">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => duplicate(b.id)} className={smallBtn} aria-label="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(b.id)} className={`${smallBtn} text-destructive`} aria-label="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {selected === b.id ? <div className="mt-3 border-t border-border pt-3"><BlockFields block={b} patch={patch} /></div> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-2">
            <p className="md:col-span-2 text-xs font-bold uppercase tracking-widest text-ink-soft">Button at the bottom</p>
            <input className={input} placeholder="Button label" value={ctaLabel} onChange={(e) => { setCtaLabel(e.target.value); setDirty(true); }} />
            <input className={input} placeholder="Button link (defaults to the event page)" value={ctaUrl} onChange={(e) => { setCtaUrl(e.target.value); setDirty(true); }} />
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Exactly what riders will see</p>
            <div className="flex gap-1">
              <button onClick={() => setDevice("desktop")} className={`${smallBtn} ${device === "desktop" ? "bg-muted" : ""}`} aria-label="Computer view">
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDevice("phone")} className={`${smallBtn} ${device === "phone" ? "bg-muted" : ""}`} aria-label="Phone view">
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white">
            <iframe
              title="Email preview"
              srcDoc={html}
              className="block h-[720px] border-0 bg-white"
              style={{ width: device === "phone" ? 390 : "100%", margin: "0 auto" }}
            />
          </div>
          {active ? <p className="mt-2 text-xs text-ink-soft">Editing: {blockLabel(active)}</p> : null}
        </section>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  patch,
}: {
  block: EmailBlock;
  patch: (id: string, changes: Record<string, unknown>) => void;
}) {
  const set = (changes: Record<string, unknown>) => patch(block.id, changes);

  const alignRow = (value: string | undefined) => (
    <div className="flex gap-1">
      {(["left", "center", "right"] as const).map((a) => (
        <button key={a} onClick={() => set({ align: a })} className={`${smallBtn} ${value === a ? "bg-muted" : ""}`}>
          {a === "left" ? "Left" : a === "center" ? "Centre" : "Right"}
        </button>
      ))}
    </div>
  );

  switch (block.type) {
    case "heading":
      return (
        <div className="space-y-2">
          <input className={input} value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="Heading" />
          <div className="flex flex-wrap items-center gap-2">
            {alignRow(block.align)}
            <div className="flex gap-1">
              {(["xl", "lg", "md"] as const).map((s) => (
                <button key={s} onClick={() => set({ size: s })} className={`${smallBtn} ${block.size === s ? "bg-muted" : ""}`}>
                  {s === "xl" ? "Big" : s === "lg" ? "Medium" : "Small"}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case "text":
      return (
        <div className="space-y-2">
          <textarea className={`${input} min-h-28`} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          {alignRow(block.align)}
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <input className={input} value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="Picture link (https://…)" />
          <input className={input} value={block.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (optional)" />
          <input className={input} value={block.href ?? ""} onChange={(e) => set({ href: e.target.value })} placeholder="Link when tapped (optional)" />
        </div>
      );

    case "columns":
      return (
        <div className="space-y-3">
          {[0, 1].map((i) => {
            const item = block.items[i] ?? { url: "", caption: null };
            const update = (changes: Record<string, unknown>) => {
              const items = [0, 1].map((n) => ({ ...(block.items[n] ?? { url: "" }) }));
              items[i] = { ...items[i], ...changes } as any;
              set({ items });
            };
            return (
              <div key={i} className="space-y-2 rounded-lg border border-border p-2">
                <p className="text-xs font-semibold text-ink-soft">{i === 0 ? "Left picture" : "Right picture"}</p>
                <input className={input} value={item.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" />
                <input className={input} value={item.caption ?? ""} onChange={(e) => update({ caption: e.target.value })} placeholder="Caption (optional)" />
              </div>
            );
          })}
        </div>
      );

    case "route-pair":
      return (
        <div className="space-y-3">
          <input className={input} value={block.category} onChange={(e) => set({ category: e.target.value })} placeholder="Category, e.g. Gold" />
          {[0, 1].map((i) => {
            const day = block.days[i] ?? { label: `Day ${i + 1}`, detail: "", url: "", href: null };
            const update = (changes: Record<string, unknown>) => {
              const days = [0, 1].map((n) => ({ ...(block.days[n] ?? { label: `Day ${n + 1}`, detail: "", url: "", href: null }) }));
              days[i] = { ...days[i], ...changes } as any;
              set({ days });
            };
            return (
              <div key={i} className="space-y-2 rounded-lg border border-border p-2">
                <p className="text-xs font-semibold text-ink-soft">{i === 0 ? "First slide" : "Second slide"}</p>
                <input className={input} value={day.label} onChange={(e) => update({ label: e.target.value })} placeholder={`Day ${i + 1}`} />
                <input className={input} value={day.detail ?? ""} onChange={(e) => update({ detail: e.target.value })} placeholder="Distance and elevation" />
                <input className={input} value={day.url} onChange={(e) => update({ url: e.target.value })} placeholder="Picture link (https://…)" />
              </div>
            );
          })}
        </div>
      );

    case "button":
      return (
        <div className="space-y-2">
          <input className={input} value={block.label} onChange={(e) => set({ label: e.target.value })} placeholder="Button label" />
          <input className={input} value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="Link (https://…)" />
          {alignRow(block.align)}
        </div>
      );

    case "list":
      return (
        <div className="space-y-2">
          <textarea
            className={`${input} min-h-24`}
            value={block.items.join("\n")}
            onChange={(e) => set({ items: e.target.value.split("\n") })}
            placeholder="One point per line"
          />
          <button onClick={() => set({ ordered: !block.ordered })} className={smallBtn}>
            {block.ordered ? "Numbered — switch to bullets" : "Bullets — switch to numbers"}
          </button>
        </div>
      );

    case "quote":
      return (
        <div className="space-y-2">
          <textarea className={`${input} min-h-20`} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          <input className={input} value={block.cite ?? ""} onChange={(e) => set({ cite: e.target.value })} placeholder="Who said it (optional)" />
        </div>
      );

    case "callout":
      return (
        <div className="space-y-2">
          <input className={input} value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Box title (optional)" />
          <textarea className={`${input} min-h-20`} value={block.text} onChange={(e) => set({ text: e.target.value })} />
        </div>
      );

    case "spacer":
      return (
        <div className="flex gap-1">
          {(["sm", "md", "lg"] as const).map((s) => (
            <button key={s} onClick={() => set({ size: s })} className={`${smallBtn} ${block.size === s ? "bg-muted" : ""}`}>
              {s === "sm" ? "Small" : s === "md" ? "Medium" : "Large"}
            </button>
          ))}
        </div>
      );

    default:
      return <p className="text-xs text-ink-soft">Nothing to set up for this one.</p>;
  }
}
