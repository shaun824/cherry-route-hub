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

function RaisedProgress({ raised, goal, updated }: { raised: number; goal: number; updated: string }) {
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
    <div className="mt-5 rounded-2xl bg-black/15 p-4 ring-1 ring-white/20">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">Raised so far, with KCA's match</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className="font-display text-3xl font-black tracking-tight text-white" aria-live="polite">
          {formatRand(displayed)}
        </p>
        <p className="pb-1 text-xs font-semibold text-white/85">Goal {formatRand(goal)}</p>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-black/25 ring-1 ring-white/15"
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
      {updated ? <p className="mt-2 text-[11px] font-medium text-white/80">Updated {formatUpdated(updated)}</p> : null}
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
      className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-lg sm:p-6"
      style={{ background: SLSC_GRADIENT }}
    >
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90 sm:text-[11px]">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full motion-reduce:animate-none" style={{ backgroundColor: SUN_YELLOW }} />
          Sabrina Love Summer Challenge · 27–30 Dec 2026
        </p>
        <h2 className="mt-3 font-display text-2xl font-black leading-[1.12] tracking-tight text-white sm:text-3xl">
          Give once. Make <span style={{ color: SUN_YELLOW }}>twice</span> the difference.
        </h2>
        <p
          className="mt-2 text-xl leading-tight text-white sm:text-2xl"
          style={{ fontFamily: '"Segoe Print", "Bradley Hand", cursive', transform: "rotate(-1deg)" }}
        >
          Let's raise a million!
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/95">
          This summer, Keep A Child Alive (KCA) will match every Summer Challenge entry and every donation, rand for rand. Whether you paddle, walk, run or ride, your support goes twice as far for children with disabilities and their families in Plettenberg Bay and the Bitou region.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black text-[#3b1630]" style={{ backgroundColor: SUN_YELLOW }}>
          <Heart className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
          R1 = R2 — Every rand you give is doubled for the children.
        </div>

        {hasRaisedFigure ? (
          <RaisedProgress raised={campaign.raised!} goal={goal} updated={campaign.updated} />
        ) : (
          <div className="mt-5 rounded-2xl bg-black/15 px-4 py-3 ring-1 ring-white/20">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Our shared goal</p>
            <p className="mt-0.5 font-display text-2xl font-black text-white">{formatRand(goal)}</p>
          </div>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {entryUrl ? (
            <a
              href={entryUrl}
              target="_blank"
              rel="noreferrer"
              data-track-action="slsc_entry_donation_opened"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-center text-sm font-black shadow-sm transition-transform active:scale-[0.98]"
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
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 py-3 text-center text-sm font-black text-white ring-2 ring-white/70 transition-transform active:scale-[0.98]"
          >
            Donate on GivenGain ♥
          </a>
        </div>
        <a
          href={KCA_URL}
          target="_blank"
          rel="noreferrer"
          data-track-action="kca_link_opened"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white underline decoration-white/60 underline-offset-4"
        >
          About KCA <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/25 pt-4">
          <div className="min-w-0 text-center">
            <p className="min-h-8 text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-white/85">Brought to you by</p>
            <div className="mt-1 grid h-16 place-items-center rounded-xl bg-white p-2">
              <img src={titleSponsorLogoUrl || discoveryLogo.url} alt="Discovery" className="max-h-full max-w-full object-contain" loading="lazy" />
            </div>
          </div>
          <div className="min-w-0 text-center">
            <p className="min-h-8 text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-white/85">Every entry &amp; donation matched by</p>
            <div className="mt-1 grid h-16 place-items-center rounded-xl bg-white p-2">
              <img src={kcaLogo.url} alt="Keep a Child Alive" className="max-h-full max-w-full object-contain" loading="lazy" />
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
      className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
      style={{ backgroundColor: SLSC_PINK }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SUN_YELLOW }} />
      KCA matches every entry &amp; donation
    </span>
  );
}
