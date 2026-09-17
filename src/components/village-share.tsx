import { useState } from "react";
import { toast } from "sonner";
import { Check, Share2, Users } from "lucide-react";

/**
 * Share links for the race village map.
 *
 * Rider link  -> /embed/village/{eventId}        (public, rider layers only)
 * Crew link   -> /embed/village/{eventId}?view=crew
 *                Opens the build/crew layers without anyone signing in, so
 *                suppliers and contractors can see the field layout.
 */
export function buildVillageShareUrl(opts: {
  eventId: string;
  venueId?: string | null;
  crew?: boolean;
  origin?: string;
}) {
  const origin =
    opts.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams();
  if (opts.venueId) params.set("venue", opts.venueId);
  if (opts.crew) params.set("view", "crew");
  const qs = params.toString();
  return `${origin}/embed/village/${opts.eventId}${qs ? `?${qs}` : ""}`;
}

async function shareUrl(url: string, title: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, url });
      return "shared" as const;
    }
  } catch (err) {
    // User dismissed the share sheet — nothing to report.
    if ((err as Error)?.name === "AbortError") return "cancelled" as const;
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied" as const;
  } catch {
    return "failed" as const;
  }
}

export function VillageShare({
  eventId,
  venueId,
  isCrew,
  title = "Race village map",
}: {
  eventId: string;
  venueId?: string | null;
  /** Crew/admin also get the no-sign-in crew build link. */
  isCrew: boolean;
  title?: string;
}) {
  const [done, setDone] = useState<"rider" | "crew" | null>(null);

  const go = async (kind: "rider" | "crew") => {
    const url = buildVillageShareUrl({ eventId, venueId, crew: kind === "crew" });
    const result = await shareUrl(url, title);
    if (result === "cancelled") return;
    if (result === "failed") {
      toast.error("Couldn't copy the link", { description: url });
      return;
    }
    if (result === "copied") {
      toast.success(
        kind === "crew" ? "Crew map link copied" : "Village map link copied",
        {
          description:
            kind === "crew"
              ? "Opens the build layout — no sign in needed."
              : "Opens straight on the village map.",
        },
      );
    }
    setDone(kind);
    window.setTimeout(() => setDone(null), 2000);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => go("rider")}
        className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-ink-soft"
      >
        {done === "rider" ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        Share map
      </button>
      {isCrew ? (
        <button
          type="button"
          onClick={() => go("crew")}
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-bold text-ink-soft"
        >
          {done === "crew" ? <Check className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
          Share crew view
        </button>
      ) : null}
    </div>
  );
}
