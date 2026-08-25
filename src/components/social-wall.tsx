import { useEffect, useMemo, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, Facebook, Instagram } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type SocialPost = {
  id: string;
  event_id: string | null;
  post_url: string;
  caption: string | null;
  eventName?: string | null;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  moved: boolean;
  locked: "x" | "y" | null;
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
  const dragStart = useRef<{ x: number; y: number } | null>(null);

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
        {/* Transparent layer: lets the page and the carousel scroll over the embed iframe,
            while still opening the post on a real tap (not a swipe). */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open this post on Instagram"
          className="absolute inset-0"
          style={{ touchAction: "pan-x pan-y pinch-zoom" }}
          onPointerDown={(e) => {
            dragStart.current = { x: e.clientX, y: e.clientY };
          }}
          onClick={(e) => {
            const s = dragStart.current;
            if (!s) return;
            const moved = Math.hypot(e.clientX - s.x, e.clientY - s.y);
            if (moved > 8) e.preventDefault();
          }}
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


  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      moved: false,
      locked: null,
    };
  };

  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.locked && Math.hypot(dx, dy) > 6) {
      drag.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (drag.locked === "x") el.setPointerCapture(e.pointerId);
    }

    if (drag.locked !== "x") return;
    e.preventDefault();
    drag.moved = true;
    el.scrollLeft = drag.scrollLeft - dx;
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) suppressClickUntilRef.current = Date.now() + 350;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  const suppressDraggedClick = (e: MouseEvent<HTMLDivElement>) => {
    if (Date.now() > suppressClickUntilRef.current) return;
    e.preventDefault();
    e.stopPropagation();
  };

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
        <div className="relative">
          <div
            ref={scrollerRef}
            style={{ touchAction: "pan-x pan-y pinch-zoom", WebkitOverflowScrolling: "touch" }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={suppressDraggedClick}
            className="-mx-4 mt-3 flex cursor-grab snap-x gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-3 active:cursor-grabbing"
          >
            {posts.map((p) => (
              <InstagramCard key={p.id} url={p.post_url} label={eventId ? null : p.eventName} />
            ))}
          </div>
          {posts.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous post"
                onClick={() => nudge(-1)}
                className="absolute left-0 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-card/90 p-2 shadow-md ring-1 ring-border sm:grid"
              >
                <ChevronLeft className="h-4 w-4 text-ink" />
              </button>
              <button
                type="button"
                aria-label="Next post"
                onClick={() => nudge(1)}
                className="absolute right-0 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-card/90 p-2 shadow-md ring-1 ring-border sm:grid"
              >
                <ChevronRight className="h-4 w-4 text-ink" />
              </button>
            </>
          ) : null}
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
