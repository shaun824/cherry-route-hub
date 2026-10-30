import kcaLogo from "@/assets/kca-logo.png.asset.json";
import { ExternalLink, Heart } from "lucide-react";
import { KCA_URL } from "@/lib/sabrina-love";


const SLSC_PINK = "#E6007E"; // Sabrina Love brand pink
const GIVENGAIN_URL = "https://www.givengain.com/cc/sabrinalove";

/** Sabrina Love Summer Challenge events get the KCA donation-matching block. */
export function isSabrinaLoveEvent(name?: string | null) {
  return Boolean(name && /^sabrina love/i.test(name));
}

export function SlscKcaCard() {
  return (
    <section data-section="kca_matching" className="rounded-2xl p-4 text-primary-foreground" style={{ backgroundColor: SLSC_PINK }}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest opacity-90">
        <Heart className="h-3.5 w-3.5" /> Donation matching with KCA
      </p>
      <h3 className="mt-1 font-display text-lg font-bold leading-snug">Give once. Make twice the difference.</h3>
      <p className="mt-2 text-xs leading-relaxed opacity-95">
        Keep a Child Alive is matching every donation made through the Summer Challenge. Your
        entry and any extra donation count double for children with disabilities in Plettenberg
        Bay and the Bitou region. Every cent goes to the Sabrina Love Foundation.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="rounded-xl bg-card p-2">
          <img src={kcaLogo.url} alt="Keep a Child Alive" className="h-9 w-auto" loading="lazy" />
        </span>
        <div className="flex flex-wrap gap-2">
          <a
            href={KCA_URL}
            target="_blank"
            rel="noreferrer"
            data-track-action="kca_link_opened"
            className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold"
            style={{ color: SLSC_PINK }}
          >
            About KCA <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={GIVENGAIN_URL}
            target="_blank"
            rel="noreferrer"
            data-track-action="slsc_donate_opened"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-primary-foreground/60"
          >
            Donate <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
