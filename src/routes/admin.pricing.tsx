// Admin price book: set what each entry category and extra costs so riders
// see a real rand amount owing on unpaid entries.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Tag, Wallet } from "lucide-react";
import { getPriceBook, listPriceBookEvents, savePriceBook } from "@/lib/price-book.functions";

export const Route = createFileRoute("/admin/pricing")({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: "Event price book | Red Cherry admin" },
      {
        name: "description",
        content: "Set entry and extras pricing so riders see the exact balance outstanding.",
      },
    ],
  }),
});

function randsToCents(value: string): number | null {
  const clean = value.replace(/[^0-9.]/g, "").trim();
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function PricingPage() {
  const listFn = useServerFn(listPriceBookEvents);
  const getFn = useServerFn(getPriceBook);
  const saveFn = useServerFn(savePriceBook);
  const qc = useQueryClient();

  const [eventId, setEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const eventsQ = useQuery({ queryKey: ["price-book-events"], queryFn: () => listFn() });
  const events = eventsQ.data ?? [];

  useEffect(() => {
    if (!eventId && events.length) setEventId(events[0]!.id);
  }, [events, eventId]);

  const bookQ = useQuery({
    queryKey: ["price-book", eventId],
    queryFn: () => getFn({ data: { eventId: eventId as string } }),
    enabled: Boolean(eventId),
  });

  useEffect(() => {
    if (!bookQ.data) return;
    const next: Record<string, string> = {};
    for (const l of bookQ.data.labels) {
      next[`${l.kind}|${l.label}`] = l.priceCents == null ? "" : String(l.priceCents / 100);
    }
    setDraft(next);
  }, [bookQ.data]);

  const save = useMutation({
    mutationFn: () => {
      const labels = bookQ.data?.labels ?? [];
      return saveFn({
        data: {
          eventId: eventId as string,
          prices: labels.map((l) => ({
            kind: l.kind,
            label: l.label,
            priceCents: randsToCents(draft[`${l.kind}|${l.label}`] ?? ""),
          })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Saved ${res.saved} price${res.saved === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["price-book", eventId] });
      qc.invalidateQueries({ queryKey: ["event-price-book"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const labels = bookQ.data?.labels ?? [];
  const categories = useMemo(() => labels.filter((l) => l.kind === "category"), [labels]);
  const extras = useMemo(() => labels.filter((l) => l.kind === "extra"), [labels]);
  const priced = labels.filter((l) => (draft[`${l.kind}|${l.label}`] ?? "").trim() !== "").length;

  return (
    <div className="px-5 pb-24 pt-5">
      <h1 className="font-display text-xl font-black text-ink">Event price book</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
        Entry Ninja's API only tells us whether an entry is paid — it never sends amounts. Set the
        price of each category and extra here and every unpaid rider sees their exact balance
        outstanding, with a breakdown, on their event page. Leave a field blank to remove its price.
      </p>

      <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
        Event
      </label>
      <select
        value={eventId ?? ""}
        onChange={(e) => setEventId(e.target.value)}
        className="mt-1 w-full rounded-xl bg-card px-3 py-2.5 text-sm font-semibold text-ink ring-1 ring-border"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      {bookQ.isLoading ? (
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-secondary" />
      ) : bookQ.data ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-lg bg-secondary px-2.5 py-1 text-ink-soft">
              {priced}/{labels.length} priced
            </span>
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-900 ring-1 ring-amber-200">
              {bookQ.data.unpaidCount} unpaid entr{bookQ.data.unpaidCount === 1 ? "y" : "ies"}
            </span>
          </div>

          <PriceGroup
            title="Entry categories"
            icon={<Tag className="h-4 w-4 text-cherry" />}
            rows={categories}
            draft={draft}
            setDraft={setDraft}
          />
          <PriceGroup
            title="Extras & merchandise"
            icon={<Wallet className="h-4 w-4 text-cherry" />}
            rows={extras}
            draft={draft}
            setDraft={setDraft}
            hint="Set an extra to 0 if it's included at no cost."
          />

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cherry px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save prices
          </button>
        </>
      ) : null}
    </div>
  );
}

function PriceGroup({
  title,
  icon,
  rows,
  draft,
  setDraft,
  hint,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { kind: "category" | "extra"; label: string; count: number }[];
  draft: Record<string, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hint?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-5 rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        {icon} {title}
      </h2>
      {hint ? <p className="mt-1 text-[11px] text-ink-soft">{hint}</p> : null}
      <ul className="mt-3 space-y-2">
        {rows.map((r) => {
          const key = `${r.kind}|${r.label}`;
          return (
            <li key={key} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{r.label}</p>
                <p className="text-[10px] text-ink-soft">
                  {r.count} entr{r.count === 1 ? "y" : "ies"}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-secondary px-2.5 py-1.5 ring-1 ring-border">
                <span className="text-[12px] font-bold text-ink-soft">R</span>
                <input
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-20 bg-transparent text-right text-[13px] font-bold text-ink outline-none"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
