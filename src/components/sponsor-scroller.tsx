import { useAdminStore } from "@/lib/store";

type SponsorScrollerSponsor = {
  id?: string;
  name: string;
  logoUrl?: string | null;
  url?: string | null;
  logoText?: string | null;
  accent?: string | null;
};

// Continuous horizontal marquee of sponsor logos. Duplicates the list so the
// loop reads seamlessly.
export function SponsorScroller({
  title = "Proudly supported by",
  compact = false,
  sponsors: sponsorsProp,
}: {
  title?: string;
  compact?: boolean;
  sponsors?: SponsorScrollerSponsor[];
}) {
  const storeSponsors = useAdminStore((s) => s.sponsors).filter((sp) => sp.active);
  const sponsors = sponsorsProp ?? storeSponsors;
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
          className="flex w-max items-center gap-3 animate-marquee will-change-transform hover:[animation-play-state:paused]"
          style={{ animationDuration: `${Math.max(18, sponsors.length * 4)}s` }}
        >

          {row.map((sp, i) => {
            const inner = sp.logoUrl ? (
              <div
                className="grid h-14 min-w-[140px] place-items-center rounded-xl bg-white px-5 shadow-sm ring-1 ring-black/10"
                title={sp.name}
              >
                <img
                  src={sp.logoUrl}
                  alt={sp.name}
                  className="max-h-10 max-w-[120px] object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div
                className="grid h-14 min-w-[140px] place-items-center rounded-xl px-5 text-white shadow-sm ring-1 ring-black/10"
                style={{ background: sp.accent || "var(--cherry)" }}
                title={sp.name}
              >
                <span className="font-display text-sm font-black tracking-[0.18em]">
                  {sp.logoText || sp.name}
                </span>
              </div>
            );
            const href =
              sp.url && sp.url.trim().length > 0
                ? sp.url
                : `https://www.google.com/search?q=${encodeURIComponent(sp.name)}`;
            return (
              <li
                key={`${sp.id}-${i}`}
                aria-hidden={i >= sponsors.length ? "true" : undefined}
                className="shrink-0"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={`Visit ${sp.name}`}
                  className="block transition-transform hover:scale-[1.03]"
                >
                  {inner}
                </a>
              </li>
            );
          })}

        </ul>
      </div>
    </section>
  );
}
