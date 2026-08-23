import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Facebook, Instagram } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type SocialPost = {
  id: string;
  event_id: string | null;
  post_url: string;
  caption: string | null;
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

function InstagramCard({ url }: { url: string }) {
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
    <div
      ref={ref}
      className="w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl bg-card ring-1 ring-border sm:w-[330px]"
    >
      <blockquote
        className="instagram-media"
        data-instgrm-captioned=""
        data-instgrm-permalink={`${url}?utm_source=ig_embed`}
        data-instgrm-version="14"
        style={{ margin: 0, width: "100%", minWidth: "unset", border: 0, boxShadow: "none" }}
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[360px] flex-col items-center justify-center gap-2 p-6 text-center text-sm font-semibold text-ink-soft"
        >
          <Instagram className="h-8 w-8 text-cherry" />
          View this post on Instagram
        </a>
      </blockquote>
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
  /** Show one event's wall, or omit for the newest posts across all events. */
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
      let q = supabase
        .from("event_social_posts")
        .select("id, event_id, post_url, caption")
        .eq("active", true)
        .order("sort_index", { ascending: true })
        .limit(limit);
      if (eventId) q = q.eq("event_id", eventId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as SocialPost[];
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
        <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {posts.map((p) => (
            <InstagramCard key={p.id} url={p.post_url} />
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
