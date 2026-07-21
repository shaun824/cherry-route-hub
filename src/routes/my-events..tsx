
function YourEntryCard({ eventId }: { eventId: string }) {
  const q = useQuery({
    queryKey: ["my-entry", eventId],
    queryFn: () => fetchMyEventById(eventId),
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
  }
  const row: MyEventRow | null = q.data ?? null;
  if (!row) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-ink-soft">
        We don't have your entry on file for this event yet. Contact the Red Cherry admins if this
        looks wrong.
      </section>
    );
  }

  const chips: { label: string; value: string; tone?: "cherry" | "dark" }[] = [];
  if (row.category) chips.push({ label: "Category", value: row.category });
  if (row.batch) chips.push({ label: "Batch", value: row.batch });
  if (row.bib_number) chips.push({ label: "Bib", value: `#${row.bib_number}`, tone: "dark" });

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
            Your entry
          </p>
          <p className="mt-0.5 font-display text-base font-bold text-ink">
            Everything Red Cherry has on file for you
          </p>
        </div>
        <Link
          to="/my-events/$eventId/report"
          params={{ eventId }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-white"
        >
          <Printer className="h-3.5 w-3.5" /> Report
        </Link>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {chips.map((c) => (
            <span
              key={c.label}
              className={
                c.tone === "dark"
                  ? "rounded bg-ink px-2 py-0.5 text-white"
                  : "rounded bg-accent px-2 py-0.5 text-cherry-deep"
              }
            >
              {c.label}: {c.value}
            </span>
          ))}
        </div>
      ) : null}

      {(row.jacket_size || row.tshirt_size) ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {row.jacket_size ? (
            <div className="rounded-xl bg-secondary p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                <Shirt className="h-3 w-3" /> Jacket
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-ink">{row.jacket_size}</p>
            </div>
          ) : null}
          {row.tshirt_size ? (
            <div className="rounded-xl bg-secondary p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                <Shirt className="h-3 w-3" /> T-Shirt
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-ink">{row.tshirt_size}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {row.extras.length > 0 ? (
        <div className="mt-3">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
            <Package className="h-3 w-3" /> Extras purchased
          </p>
          <ul className="mt-1.5 divide-y divide-border rounded-xl bg-secondary/60">
            {row.extras.map((x, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="text-ink">
                  {x.name}
                  {x.size ? <span className="text-ink-soft"> · {x.size}</span> : null}
                </span>
                <span className="font-semibold text-ink-soft">×{x.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.notes ? (
        <p className="mt-3 rounded-lg bg-secondary/60 p-2 text-xs text-ink-soft">
          <span className="font-bold text-ink">Notes: </span>{row.notes}
        </p>
      ) : null}

      {chips.length === 0 && !row.jacket_size && !row.tshirt_size && row.extras.length === 0 ? (
        <p className="mt-3 text-xs text-ink-soft">
          Your entry is confirmed. Extras and sizes will appear here once they sync from Entry Ninja.
        </p>
      ) : null}
    </section>
  );
}
