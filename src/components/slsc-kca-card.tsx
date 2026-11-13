import { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Heart } from "lucide-react";
import kcaLogo from "@/assets/kca-logo.png.asset.json";
import discoveryLogo from "@/assets/discovery-logo.jpg.asset.json";
import { KCA_URL } from "@/lib/sabrina-love";
import { useAdminStore } from "@/lib/store";

const SLSC_GRADIENT = "linear-gradient(135deg, #A3005A 0%, #E6007E 52%, #FF3D9A 100%)";
const SLSC_PINK = "#E6007E";
const SUN_YELLOW = "#FFC83D";
const GIVENGAIN_URL = "https://www.givengain.com/cc/sabrinalove";

/** Sabrina Love Summer Challenge events get the approved KCA matching campaign. */
export function isSabrinaLoveEvent(name?: string | null) {
  return Boolean(name && /^sabrina love/i.test(name));
}

export function formatRand(value: number) {
  return `R${Math.round(value).toLocaleString("en-US")}`;
}

function formatUpdated(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function RaisedProgress({ raised, goal, updated }: { raised: number; goal: number; updated: string }) {
  const [displayed, setDisplayed] = useState(0);
  const percent = Math.min(100, Math.max(0, (raised / goal) * 100));

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplayed(raised);
      return;
    }

    let frame = 0;
    let startedAt: number | null = null;
    const duration = 1200;
    const tick = (time: number) => {
      if (startedAt === null) startedAt = time;
      const progress = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(raised * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [raised]);

  return (
    <div className="mt-5 border-y border-primary-foreground/25 py-4">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/85">Raised so far, with KCA's match</p>
        <p className="text-xs font-semibold text-primary-foreground/85">Goal {formatRand(goal)}</p>
      </div>
      <p className="mt-1 font-display text-3xl font-black tracking-tight text-primary-foreground" aria-live="polite">
        {formatRand(displayed)}
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-ink/25"
        role="progressbar"
        aria-label="Raised towards the KCA campaign goal"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={raised}
      >
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%`, backgroundColor: SUN_YELLOW }}
        />
      </div>
      {updated ? <p className="mt-2 text-[11px] font-medium text-primary-foreground/80">Updated {formatUpdated(updated)}</p> : null}
    </div>
  );
}

export function SlscKcaCard({
  entryUrl,
  titleSponsorLogoUrl,
}: {
  entryUrl?: string | null;
  titleSponsorLogoUrl?: string | null;
}) {
  const campaign = useAdminStore((s) => s.settings.kcaCampaign);
  const goal = campaign.goal;
  const hasRaisedFigure = campaign.raised !== null && Number.isFinite(campaign.raised);

  return (
    <section
      data-section="kca_matching"
      className="overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-md sm:p-6"
      style={{ background: SLSC_GRADIENT }}
    >
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/90 sm:text-[11px]">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full motion-reduce:animate-none" style={{ backgroundColor: SUN_YELLOW }} />
        Sabrina Love Summer Challenge · 27–30 Dec 2026
      </p>
      <h2 className="mt-3 font-display text-2xl font-black leading-[1.12] tracking-tight text-primary-foreground sm:text-3xl">
        Give once. Make <span style={{ color: SUN_YELLOW }}>twice</span> the difference.
      </h2>
      <p
        className="mt-2 text-xl leading-tight text-primary-foreground sm:text-2xl"
        style={{ fontFamily: '"Segoe Print", "Bradley Hand", cursive', transform: "rotate(-1deg)" }}
      >
        Let's raise a million!
      </p>
      <p className="mt-4 text-sm leading-relaxed text-primary-foreground/95">
        This summer, Keep A Child Alive (KCA) will match every Summer Challenge entry and every donation, rand for rand. Whether you paddle, walk, run or ride, your support goes twice as far for children with disabilities and their families in Plettenberg Bay and the Bitou region.
      </p>

      <p className="mt-4 flex items-start gap-2 text-sm font-bold leading-snug" style={{ color: SUN_YELLOW }}>
        <Heart className="mt-0.5 h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
        <span>R1 = R2 · Every rand you give is doubled for the children.</span>
      </p>

      {hasRaisedFigure ? (
        <RaisedProgress raised={campaign.raised!} goal={goal} updated={campaign.updated} />
      ) : (
        <div className="mt-5 flex items-end justify-between gap-4 border-y border-primary-foreground/25 py-3">
          <p className="pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground/80">Our shared goal</p>
          <p className="font-display text-2xl font-black text-primary-foreground">{formatRand(goal)}</p>
        </div>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {entryUrl ? (
          <a
            href={entryUrl}
            target="_blank"
            rel="noreferrer"
            data-track-action="slsc_entry_donation_opened"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-4 py-2.5 text-center text-sm font-black transition-transform active:scale-[0.98]"
            style={{ color: SLSC_PINK }}
          >
            Enter &amp; add a donation <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : null}
        <a
          href={GIVENGAIN_URL}
          target="_blank"
          rel="noreferrer"
          data-track-action="slsc_donate_opened"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-bold text-primary-foreground ring-1 ring-primary-foreground/60 transition-transform active:scale-[0.98]"
        >
          Donate on GivenGain <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
        </a>
      </div>
      <div className="mt-2 text-center">
        <a
          href={KCA_URL}
          target="_blank"
          rel="noreferrer"
          data-track-action="kca_link_opened"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-primary-foreground underline decoration-primary-foreground/60 underline-offset-4"
        >
          About KCA <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      <div className="mt-4 rounded-2xl bg-primary-foreground px-3 py-3 text-ink">
        <div className="grid grid-cols-2">
          <div className="min-w-0 px-1 text-center">
            <p className="flex min-h-7 items-center justify-center text-[8px] font-bold uppercase leading-tight tracking-[0.1em] text-ink-soft">Brought to you by</p>
            <div className="mt-1 flex h-12 items-center justify-center overflow-hidden">
              <img src={titleSponsorLogoUrl || discoveryLogo.url} alt="Discovery" className="h-12 w-full object-contain" loading="lazy" />
            </div>
          </div>
          <div className="min-w-0 border-l border-ink/10 px-1 text-center">
            <p className="flex min-h-7 items-center justify-center text-[8px] font-bold uppercase leading-tight tracking-[0.1em] text-ink-soft">Every entry &amp; donation matched by</p>
            <div className="mt-1 flex h-12 items-center justify-center overflow-hidden">
              <img src={kcaLogo.url} alt="Keep a Child Alive" className="h-12 w-full object-contain" loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SlscKcaPill() {
  return (
    <span
      className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-primary-foreground"
      style={{ backgroundColor: SLSC_PINK }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SUN_YELLOW }} />
      KCA matches every entry &amp; donation
    </span>
  );
}
