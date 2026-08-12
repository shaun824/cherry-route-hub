import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EventPhoto = { id: string; baseUrl: string; width: number; height: number };
export type EventPhotosResult = {
  photos: EventPhoto[];
  albumUrl: string | null;
  refreshedAt: string | null;
  error: string | null;
};

const Input = z.object({ eventId: z.string().uuid() });
const STALE_MS = 6 * 60 * 60 * 1000;

export const getEventPhotos = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<EventPhotosResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("photos_album_url")
      .eq("id", data.eventId)
      .maybeSingle();

    const albumUrl = (ev?.photos_album_url as string | null) ?? null;
    if (!albumUrl) return { photos: [], albumUrl: null, refreshedAt: null, error: null };

    const { data: cached } = await supabaseAdmin
      .from("event_photos_cache")
      .select("photos, album_url, refreshed_at, last_error")
      .eq("event_id", data.eventId)
      .maybeSingle();

    const fresh =
      cached?.refreshed_at &&
      cached.album_url === albumUrl &&
      Date.now() - new Date(cached.refreshed_at).getTime() < STALE_MS;

    if (fresh) {
      return {
        photos: (cached!.photos as EventPhoto[]) ?? [],
        albumUrl,
        refreshedAt: cached!.refreshed_at as string,
        error: (cached!.last_error as string | null) ?? null,
      };
    }

    const { crawlGooglePhotosAlbum } = await import("@/lib/event-photos.server");
    const { photos, error } = await crawlGooglePhotosAlbum(albumUrl);
    const refreshedAt = new Date().toISOString();

    // Keep the last good list if this crawl came back empty.
    const keep = photos.length === 0 ? ((cached?.photos as EventPhoto[]) ?? []) : photos;

    await supabaseAdmin.from("event_photos_cache").upsert({
      event_id: data.eventId,
      photos: keep,
      album_url: albumUrl,
      refreshed_at: refreshedAt,
      last_error: error,
    });

    return { photos: keep, albumUrl, refreshedAt, error: keep.length ? null : error };
  });

export const refreshEventPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<EventPhotosResult> => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (!roles || roles.length === 0) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("photos_album_url")
      .eq("id", data.eventId)
      .maybeSingle();
    const albumUrl = (ev?.photos_album_url as string | null) ?? null;
    if (!albumUrl) return { photos: [], albumUrl: null, refreshedAt: null, error: "No album link set." };

    const { crawlGooglePhotosAlbum } = await import("@/lib/event-photos.server");
    const { photos, error } = await crawlGooglePhotosAlbum(albumUrl);
    const refreshedAt = new Date().toISOString();

    await supabaseAdmin.from("event_photos_cache").upsert({
      event_id: data.eventId,
      photos,
      album_url: albumUrl,
      refreshed_at: refreshedAt,
      last_error: error,
    });

    return { photos, albumUrl, refreshedAt, error };
  });
