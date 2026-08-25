import { useMemo, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ExternalLink, Facebook, Instagram } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type SocialPost = {
  id: string;
  event_id: string | null;
  post_url: string;
  caption: string | null;
  eventName?: string | null;
};

type EventSocialRow = {
  id: string;
  name: string;
  event_date: string | null;
  status: string | null;
  social_links: Record<string, string> | null;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  moved: boolean;
  locked: "x" | "y" | null;
};

function InstagramCard({ url, caption, label }: { url: string; caption?: string | null; label?: string | null }) {
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const displayCaption = caption?.trim() || "Open the latest race-week post on Instagram.";

  return (
    <article className="w-[280px] shrink-0 snap-start sm:w-[320px]">
      {label ? (
        <p className="mb-1.5 truncate text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open this post on Instagram"
        className="flex h-[185px] flex-col justify-between rounded-2xl bg-card p-4 ring-1 ring-border transition hover:bg-accent/60"
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
      >
        <span className="flex items-center justify-between gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl cherry-gradient text-white">
            <Instagram className="h-5 w-5" />
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-ink-soft" />
        </span>
        <span className="line-clamp-4 text-sm font-semibold leading-snug text-ink">{displayCaption}</span>
        <span className="text-xs font-bold text-cherry">Open Instagram</span>
      </a>
    </article>
  );
}

function instagramFromLinks(links: Record<string, string> | null | undefined) {
  const value = links?.instagram;
  return typeof value === "string" && value.includes("instagram.com") ? value : null;
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
    queryKey: ["social-wall-v2", eventId ?? "all", instagramUrl ?? "global", limit],
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

      if (out.length < limit) {
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("id, name, event_date, status, social_links")
          .neq("status", "archived")
          .order("event_date", { ascending: true })
          .limit(80);
        if (eventsError) throw new Error(eventsError.message);

        for (const event of (events ?? []) as EventSocialRow[]) {
          if (seen.has(event.id)) continue;
          const instagram = instagramFromLinks(event.social_links) ?? instagramUrl ?? null;
          if (!instagram) continue;
          seen.add(event.id);
          out.push({
            id: `event-social-${event.id}`,
            event_id: event.id,
            post_url: instagram,
            caption: "See the latest photos, reels and rider updates for this event.",
            eventName: event.name,
          });
          if (out.length >= limit) break;
        }
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
              <InstagramCard key={p.id} url={p.post_url} caption={p.caption} label={eventId ? null : p.eventName} />
            ))}
          </div>
          {posts.length > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Previous post"
                onClick={() => nudge(-1)}
                className="absolute left-0 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-card/90 p-2 shadow-md ring-1 ring-border sm:grid"
              >
                <ChevronLeft className="h-4 w-4 text-ink" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Next post"
                onClick={() => nudge(1)}
                className="absolute right-0 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-card/90 p-2 shadow-md ring-1 ring-border sm:grid"
              >
                <ChevronRight className="h-4 w-4 text-ink" />
              </Button>
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
