import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { Copy, Check, ExternalLink, X } from "lucide-react";

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
  useHydratedStore();
  const promos = useAdminStore((s) => s.promos);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState<{ code: string; url: string; brand: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pending) return;
    timer.current = setTimeout(() => {
      window.open(pending.url, "_blank", "noopener,noreferrer");
      setPending(null);
    }, 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pending]);

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
              <div className="flex items-start gap-3">
                {p.logoUrl ? (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/95 p-1 ring-1 ring-white/40">
                    <img
                      src={p.logoUrl}
                      alt={`${p.brand} logo`}
                      loading="lazy"
                      className="max-h-10 max-w-10 object-contain"
                    />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
                    {p.brand}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold leading-tight">{p.title}</p>
                  <p className="mt-2 text-[11px] opacity-80">
                    Expires {new Date(p.expires).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
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
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    copy(p.code);
                    setPending({ code: p.code, url: p.url!, brand: p.brand });
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-black uppercase text-cherry-deep hover:underline"
                >
                  {p.discount} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="rounded-md bg-accent px-2 py-1 text-xs font-black uppercase text-cherry-deep">
                  {p.discount}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <SponsorScroller title="Our sponsors" />
      <div className="pb-6" />

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6">
          <div className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-center ring-1 ring-border">
            <button
              onClick={() => setPending(null)}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm text-muted-foreground">
              Use this code on {pending.brand}'s website
            </p>
            <p className="mt-3 font-mono text-2xl font-black text-ink">{pending.code}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Code copied — taking you there in a moment…
            </p>
          </div>
        </div>
      ) : null}
    </div>

  );
}

