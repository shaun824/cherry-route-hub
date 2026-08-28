import { ExternalLink, Facebook, Instagram, Linkedin } from "lucide-react";

/** Verified Red Cherry Events channels (from redcherryevents.co.za + LinkedIn company page). */
export const RCE_SOCIALS = [
  {
    key: "facebook",
    label: "Facebook",
    handle: "Red Cherry Events",
    url: "https://www.facebook.com/redcherryeventsza",
    icon: Facebook,
    color: "bg-[#1877F2] text-white",
  },
  {
    key: "instagram",
    label: "Instagram",
    handle: "@redcherryevents_za",
    url: "https://www.instagram.com/redcherryevents_za/",
    icon: Instagram,
    color: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    handle: "Red Cherry Events",
    url: "https://www.linkedin.com/company/red-cherry-events",
    icon: Linkedin,
    color: "bg-[#0A66C2] text-white",
  },
] as const;

/** Simple links out to the Red Cherry Events social channels. */
export function RedCherrySocials({
  title = "Follow Red Cherry Events",
  subtitle = "Race-week updates, photos and results on our channels",
  className = "",
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <p className="text-xs text-ink-soft">{subtitle}</p>
      <div className="mt-3 space-y-2">
        {RCE_SOCIALS.map(({ key, label, handle, url, icon: Icon, color }) => (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border"
          >
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-ink">{label}</span>
              <span className="block text-xs text-ink-soft">{handle}</span>
            </span>
            <ExternalLink className="h-4 w-4 text-ink-soft" />
          </a>
        ))}
      </div>
    </section>
  );
}
