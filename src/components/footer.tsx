import { Mail } from "lucide-react";
import rceLogo from "@/assets/rce-logo.png.asset.json";

const SUPPORT_EMAIL = "support@redcherryevents.co.za";

export function Footer() {
  return (
    <footer className="mt-2 border-t border-border/60 bg-card/60 px-4 pb-2 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src={rceLogo.url}
          alt="Red Cherry Events"
          className="h-10 w-auto opacity-90"
          loading="lazy"
        />
        <p className="text-[11px] leading-snug text-ink-soft">
          Red Cherry Events · Rider Hub
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Red Cherry Events support`}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
        >
          <Mail className="h-3.5 w-3.5" />
          Contact support
        </a>
        <p className="text-[10px] text-ink-soft/70">{SUPPORT_EMAIL}</p>
      </div>
    </footer>
  );
}
