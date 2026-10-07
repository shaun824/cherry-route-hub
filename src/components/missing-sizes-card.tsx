import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, Shirt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { eventApparel, hasSize } from "@/lib/apparel";

type MissingRow = {
  name: string;
  bib: string | null;
  ref: string | null;
  email: string | null;
  phone: string | null;
  noTshirt: boolean;
  noJacket: boolean;
};

async function fetchMissing(eventId: string) {
  const { data: ev } = await supabase
    .from("events")
    .select("collects_tshirt_size, collects_jacket_size")
    .eq("id", eventId)
    .maybeSingle();
  const flags = eventApparel(ev);
  if (!flags.tshirt && !flags.jacket) return { flags, rows: [] as MissingRow[] };
  const { data, error } = await supabase
    .from("event_entrants")
    .select("bib_number, registration_ref, tshirt_size, jacket_size, entrant:entrants(full_name, email, phone)")
    .eq("event_id", eventId);
  if (error) throw error;
  const rows: MissingRow[] = [];
  for (const r of (data ?? []) as any[]) {
    const noTshirt = flags.tshirt && !hasSize(r.tshirt_size);
    const noJacket = flags.jacket && !hasSize(r.jacket_size);
    if (!noTshirt && !noJacket) continue;
    rows.push({
      name: r.entrant?.full_name ?? "Unknown rider",
      bib: r.bib_number ?? null,
      ref: r.registration_ref ?? null,
      email: r.entrant?.email ?? null,
      phone: r.entrant?.phone ?? null,
      noTshirt,
      noJacket,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { flags, rows };
}

export function MissingSizesCard({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["missing-sizes", eventId], queryFn: () => fetchMissing(eventId) });
  if (!q.data) return null;
  const { flags, rows } = q.data;
  if (!flags.tshirt && !flags.jacket) return null;
  const t = rows.filter((r) => r.noTshirt).length;
  const j = rows.filter((r) => r.noJacket).length;
  const parts: string[] = [];
  if (flags.tshirt) parts.push(`${t} rider${t === 1 ? "" : "s"} with no T-shirt size`);
  if (flags.jacket) parts.push(`${j} with no jacket size`);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Name", "Bib", "Registration ref", "Email", "Phone", "Missing"];
    const lines = rows.map((r) =>
      [r.name, r.bib, r.ref, r.email, r.phone, [r.noTshirt && "T-shirt", r.noJacket && "Jacket"].filter(Boolean).join(" + ")]
        .map(esc)
        .join(","),
    );
    const blob = new Blob([`\uFEFF${[head.map(esc).join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `missing-sizes-${eventName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <Shirt className="h-4 w-4 text-cherry" />
        <span className="flex-1 text-sm font-bold text-ink">Missing sizes: {parts.join(", ")}</span>
        <ChevronDown className={`h-4 w-4 text-ink-soft transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-3">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-soft">Everyone has supplied their sizes.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={exportCsv}
                className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-ink"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-widest text-ink-soft">
                    <tr><th className="py-1">Name</th><th>Bib</th><th>Ref</th><th>Contact</th><th>Missing</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1.5 font-semibold text-ink">{r.name}</td>
                        <td>{r.bib ?? "—"}</td>
                        <td>{r.ref ?? "—"}</td>
                        <td>{[r.email, r.phone].filter(Boolean).join(" · ") || "—"}</td>
                        <td>{[r.noTshirt && "T-shirt", r.noJacket && "Jacket"].filter(Boolean).join(" + ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
