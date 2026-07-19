import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { promos } from "@/lib/mock-data";
import { Copy, Check } from "lucide-react";

export const Route = createFileRoute("/promos")({
  head: () => ({
    meta: [
      { title: "Supplier Promos — Red Cherry Events" },
      { name: "description", content: "Discount codes and offers from Red Cherry sponsors and suppliers." },
    ],
  }),
  component: Promos,
});

function Promos() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(code: string) {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div>
      <PageHeader title="Supplier Promos" subtitle="Perks from our sponsors" />
      <ul className="space-y-3 px-5 py-5">
        {promos.map((p) => (
          <li
            key={p.id}
            className="overflow-hidden rounded-2xl bg-card ring-1 ring-border"
          >
            <div
              className="px-4 py-4 text-white"
              style={{ background: `linear-gradient(135deg, ${p.accent}, oklch(0.2 0.02 260))` }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
                {p.brand}
              </p>
              <p className="mt-1 font-display text-lg font-bold leading-tight">{p.title}</p>
              <p className="mt-2 text-[11px] opacity-80">
                Expires {new Date(p.expires).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Discount code
                </p>
                <p className="mt-0.5 truncate font-mono text-base font-bold text-ink">{p.code}</p>
              </div>
              <button
                onClick={() => copy(p.code)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white"
              >
                {copied === p.code ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </button>
              <span className="rounded-md bg-accent px-2 py-1 text-xs font-black uppercase text-cherry-deep">
                {p.discount}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
