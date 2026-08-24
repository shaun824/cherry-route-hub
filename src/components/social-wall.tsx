import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Facebook, Instagram } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type SocialPost = {
  id: string;
  event_id: string | null;
  post_url: string;
  caption: string | null;
  eventName?: string | null;
};

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let embedScriptPromise: Promise<void> | null = null;

function loadInstagramEmbeds(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.instgrm) {
    window.instgrm.Embeds.process();
    return Promise.resolve();
  }
  if (!embedScriptPromise) {
    embedScriptPromise = new Promise<void>((resolve) => {
      const s = document.createElement("script");
      s.src = "https://www.instagram.com/embed.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.body.appendChild(s);
    });
  }
  return embedScriptPromise.then(() => {
    window.instgrm?.Embeds.process();
  });
}

function InstagramCard({ url, label }: { url: string; label?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadInstagramEmbeds().then(() => {
      if (!cancelled) window.instgrm?.Embeds.process();
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="w-[300px] shrink-0 snap-start sm:w-[330px]">
      {label ? (
        <p className="mb-1.5 truncate text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      ) : null}
      <div className="relative h-[440px] overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        <div ref={ref} className="pointer-events-none h-full overflow-hidden">
          <blockquote
            className="instagram-media"
            data-instgrm-captioned=""
            data-instgrm-permalink={`${url}?utm_source=ig_embed`}
            data-instgrm-version="14"
            style={{ margin: 0, width: "100%", minWidth: "unset", border: 0, boxShadow: "none" }}
          >
            <a
              href={url}
              className="flex h-[360px] flex-col items-center justify-center gap-2 p-6 text-center text-sm font-semibold text-ink-soft"
            >
              <Instagram className="h-8 w-8 text-cherry" />
              View this post on Instagram
            </a>
          </blockquote>
        </div>
        {/* Transparent tap layer: keeps page scrolling smooth over the embed iframe */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open this post on Instagram"
          className="absolute inset-0"
        />
      </div>
    </div>
  );
}

export function SocialWall({
  eventId,
  instagramUrl,
  facebookUrl,
  title = "Latest on Instagram",
  subtitle,
  limit = 6,
  className = "",
}: {
  /** Show one event's wall, or omit for the newest post from each event. */
  eventId?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  title?: string;
  subtitle?: string;
  limit?: number;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ["social-wall", eventId ?? "all", limit],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (eventId) {
        const { data, error } = await supabase
          .from("event_social_posts")
          .select("id, event_id, post_url, caption")
          .eq("active", true)
          .eq("event_id", eventId)
          .order("sort_index", { ascending: true })
          .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []) as SocialPost[];
      }

      // Mixed feed: newest post from each event that has a feed.
      const { data, error } = await supabase
        .from("event_social_posts")
        .select("id, event_id, post_url, caption, posted_at, created_at, sort_index, events(name, status)")
        .eq("active", true)
        .order("posted_at", { ascending: false, nullsFirst: false })
        .order("sort_index", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);

      const seen = new Set<string>();
      const out: SocialPost[] = [];
      for (const row of (data ?? []) as Array<SocialPost & { events?: { name: string; status: string } | null }>) {
        const key = row.event_id ?? "global";
        if (seen.has(key)) continue;
        if (row.events && row.events.status === "archived") continue;
        seen.add(key);
        out.push({ ...row, eventName: row.events?.name ?? null });
        if (out.length >= limit) break;
      }
      return out;
    },
  });


  const posts = useMemo(() => data ?? [], [data]);
  const handle = useMemo(() => {
    if (!instagramUrl) return null;
    const m = instagramUrl.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
    return m ? `@${m[1]}` : null;
  }, [instagramUrl]);

  if (posts.length === 0 && !instagramUrl && !facebookUrl) return null;

  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <p className="text-xs text-ink-soft">{subtitle ?? (handle ? `Follow ${handle}` : "Straight from the crew")}</p>
        </div>
        <div className="flex gap-1.5">
          {instagramUrl ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Instagram"
              className="grid h-9 w-9 place-items-center rounded-full bg-accent text-cherry-deep ring-1 ring-border"
            >
              <Instagram className="h-4 w-4" />
            </a>
          ) : null}
          {facebookUrl ? (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Facebook"
              className="grid h-9 w-9 place-items-center rounded-full bg-accent text-cherry-deep ring-1 ring-border"
            >
              <Facebook className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>

      {posts.length > 0 ? (
        <div style={{ touchAction: "pan-y pinch-zoom" }}
          className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posts.map((p) => (
            <InstagramCard key={p.id} url={p.post_url} label={eventId ? null : p.eventName} />
          ))}
        </div>
      ) : instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl cherry-gradient text-white">
            <Instagram className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-ink">{handle ?? "Follow us on Instagram"}</span>
            <span className="block text-xs text-ink-soft">Photos, reels and race-week updates</span>
          </span>
          <ExternalLink className="h-4 w-4 text-ink-soft" />
        </a>
      ) : null}
    </section>
  );
}
