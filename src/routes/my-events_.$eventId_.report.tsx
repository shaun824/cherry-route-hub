import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyEventById, type MyEventRow } from "@/lib/my-events";
import { eventHasTshirt } from "@/lib/apparel";
import { fetchMyRooming } from "@/lib/rooming";

export const Route = createFileRoute("/my-events_/$eventId_/report")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, discipline, event_date, location")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  component: ReportPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm">Event not found.</div>
  ),
});

function ReportPage() {
  const { event } = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["my-entry", event.id],
    queryFn: () => fetchMyEventById(event.id),
  });
  const roomingQ = useQuery({
    queryKey: ["my-rooming", event.id],
    queryFn: () => fetchMyRooming(event.id),
  });
  const rooming = roomingQ.data ?? null;

  useEffect(() => {
    document.body.classList.add("print-body");
    return () => document.body.classList.remove("print-body");
  }, []);

  const row: MyEventRow | null = q.data ?? null;
  const showTshirt = eventHasTshirt(event.name);

  function downloadCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines: string[][] = [
      ["Field", "Value"],
      ["Event", event.name],
      ["Discipline", event.discipline],
      ["Date", new Date(event.event_date).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })],
      ["Location", event.location],
      ["Category", row?.category ?? ""],
      ["Batch", row?.batch ?? ""],
      ["Bib number", row?.bib_number ?? ""],
      ["Jacket size", row?.jacket_size ?? ""],
      ...(showTshirt ? [["T-shirt size", row?.tshirt_size ?? ""]] : []),
      ["Accommodation venue", rooming?.venue?.name ?? ""],
      ["Tent / room number", rooming?.tent_number ?? ""],
      ["Room type", rooming?.room_type ?? ""],
      ["Notes", row?.notes ?? ""],
      ...(row?.extras ?? []).map((x) => [
        "Extra",
        `${x.name}${x.size ? ` (${x.size})` : ""} x${x.qty}`,
      ]),
      ["Generated", new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })],
    ];
    const csv = lines.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rce-report-${event.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            to="/my-events/$eventId"
            params={{ eventId: event.id }}
            className="inline-flex items-center gap-1 rounded-lg bg-card px-3 py-1.5 text-xs font-semibold text-ink ring-1 ring-border"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-border"
            >
              <Download className="h-3.5 w-3.5" /> Download CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white"
            >
              <Printer className="h-3.5 w-3.5" /> Download PDF
            </button>
          </div>
        </div>


        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-border print:rounded-none print:shadow-none print:ring-0">
          <header className="border-b border-border pb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cherry-deep">
              Red Cherry Events · Rider Report
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">{event.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {event.discipline} · {new Date(event.event_date).toLocaleString("en-ZA", {
                timeZone: "Africa/Johannesburg",
                weekday: "long",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="text-sm text-ink-soft">{event.location}</p>
          </header>

          {q.isLoading ? (
            <p className="mt-6 text-sm text-ink-soft">Loading your entry…</p>
          ) : !row ? (
            <p className="mt-6 text-sm text-ink-soft">
              No entry found on file for this event.
            </p>
          ) : (
            <>
              <Row label="Category" value={row.category} />
              <Row label="Batch" value={row.batch} />
              <Row label="Bib number" value={row.bib_number ? `#${row.bib_number}` : null} />
              <Row label="Jacket size" value={row.jacket_size} />
              {showTshirt ? <Row label="T-shirt size" value={row.tshirt_size} /> : null}
              <Row label="Notes" value={row.notes} />

              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  Accommodation
                </p>
                {!rooming ? (
                  <p className="mt-1 text-sm text-ink-soft">
                    No accommodation allocated for you on this event.
                  </p>
                ) : (
                  <>
                    <Row label="Venue" value={rooming.venue?.name ?? null} />
                    <Row label="Tent / room number" value={rooming.tent_number} />
                    <Row label="Room type" value={rooming.room_type} />
                    <Row label="Accommodation notes" value={rooming.notes} />
                  </>
                )}
              </div>

              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  Extras purchased
                </p>
                {row.extras.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-soft">None recorded.</p>
                ) : (
                  <table className="mt-2 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-ink-soft">
                        <th className="py-1.5">Item</th>
                        <th>Size</th>
                        <th className="text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.extras.map((x, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 text-ink">{x.name}</td>
                          <td className="text-ink-soft">{x.size ?? "—"}</td>
                          <td className="text-right font-semibold text-ink">×{x.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          <footer className="mt-8 border-t border-border pt-3 text-[10px] text-ink-soft">
            Generated {new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} · redcherryevents.co.za
          </footer>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mt-4 flex items-baseline justify-between gap-3 border-b border-border/50 pb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-ink">
        {value && value.trim() ? value : "—"}
      </span>
    </div>
  );
}
