import { useAdminStore } from "@/lib/store";

// Continuous horizontal marquee of sponsor logos. Duplicates the list so the
// loop reads seamlessly.
export function SponsorScroller({
  title = "Proudly supported by",
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  const sponsors = useAdminStore((s) => s.sponsors).filter((sp) => sp.active);
  if (sponsors.length === 0) return null;

  const row = [...sponsors, ...sponsors]; // duplicate for seamless loop

  return (
    <section aria-label="Sponsors" className={compact ? "py-4" : "py-6"}>
      {!compact ? (
        <p className="px-5 pb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">
          {title}
        </p>
      ) : null}
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)]">
        <ul
          className="flex w-max items-center gap-3 animate-marquee will-change-transform"
          style={{ animationDuration: `${Math.max(18, sponsors.length * 4)}s` }}
        >
          {row.map((sp, i) => (
            <li
              key={`${sp.id}-${i}`}
              aria-hidden={i >= sponsors.length ? "true" : undefined}
              className="shrink-0"
            >
              <div
                className="grid h-14 min-w-[140px] place-items-center rounded-xl px-5 text-white shadow-sm ring-1 ring-black/10"
                style={{ background: sp.accent }}
                title={sp.name}
              >
                <span className="font-display text-sm font-black tracking-[0.18em]">
                  {sp.logoText}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
