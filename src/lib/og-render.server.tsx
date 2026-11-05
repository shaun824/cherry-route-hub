import { ImageResponse, GoogleFont } from "@cf-wasm/og";
import { createClient } from "@supabase/supabase-js";
import rceLogo from "@/assets/rce-logo.png.asset.json";
import defaultPhoto from "@/assets/weekend-warrior-lourensford-2026-cover.jpg.asset.json";
import { OG_SITE } from "./og";

const W = 1200;
const H = 630;
const CHERRY = "#E3262F";

function abs(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${OG_SITE}${url}`;
  return null;
}

/** Fetches an image as a data URL so a slow or broken image never breaks the card. */
async function loadImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "RiderHubOG/1.0" } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!/^image\/(png|jpe?g|svg\+xml)$/.test(type)) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 8_000_000) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

function clean(s: string | null, max: number): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Bigger text for short headings, smaller for long ones, so it always fits. */
function headingSize(text: string, big: number, small: number): number {
  const n = text.length;
  if (n <= 14) return big;
  if (n >= 40) return small;
  return Math.round(big - ((n - 14) / 26) * (big - small));
}

async function loadEvent(id: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.from("events").select("id, name, cover_url, logo_url").eq("id", id).maybeSingle();
  if (!data) return null;
  let cover = abs(data.cover_url);
  if (!cover) {
    const { data: photo } = await sb.from("event_photos_cache").select("*").eq("event_id", id).limit(1).maybeSingle();
    const photos = (photo as { photos?: { url?: string }[] } | null)?.photos;
    cover = abs(Array.isArray(photos) ? photos[0]?.url : null);
  }
  return { name: data.name as string, cover, logo: abs(data.logo_url) };
}

export async function renderOgImage(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  const eventId = q.get("e");
  const page = clean(q.get("p"), 60) || "Rider Hub";
  const sub = clean(q.get("s"), 90);

  const event = eventId ? await loadEvent(eventId) : null;
  const [photo, logo, rce] = await Promise.all([
    loadImage(event?.cover ?? null).then((p) => p ?? loadImage(abs(defaultPhoto.url))),
    loadImage(event?.logo ?? null),
    loadImage(abs(rceLogo.url)),
  ]);

  const font = "Space Grotesk";
  const body = event ? (
    <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundColor: "#1a1012", fontFamily: font }}>
      {photo ? <img src={photo} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 216, display: "flex", flexDirection: "column", backgroundColor: "rgba(18,10,12,0.92)" }}>
        <div style={{ display: "flex", height: 8, width: "100%", backgroundColor: CHERRY }} />
        <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0 48px", gap: 36 }}>
          <div style={{ display: "flex", width: 168, height: 168, marginTop: -60, borderRadius: 28, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
            {logo ? (
              <img src={logo} width={140} height={140} style={{ width: 140, height: 140, objectFit: "contain" }} />
            ) : rce ? (
              <img src={rce} width={140} height={140} style={{ width: 140, height: 140, objectFit: "contain" }} />
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: "#ff8a8f", letterSpacing: 3, textTransform: "uppercase", lineClamp: 1, overflow: "hidden" }}>
              {clean(event.name, 70)}
            </div>
            <div style={{ display: "flex", fontSize: headingSize(page, 76, 50), fontWeight: 700, color: "#ffffff", lineHeight: 1.05, marginTop: 8, lineClamp: 2 }}>
              {page}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundColor: "#1a1012", fontFamily: font }}>
      {photo ? <img src={photo} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} /> : null}
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(14,8,10,0.92) 0%, rgba(14,8,10,0.75) 55%, rgba(14,8,10,0.25) 100%)" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px" }}>
        <div style={{ display: "flex", alignSelf: "flex-start", backgroundColor: "#ffffff", borderRadius: 22, padding: "14px 24px", alignItems: "center" }}>
          {rce ? <img src={rce} height={84} width={240} style={{ height: 84, width: 240, objectFit: "contain" }} /> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div style={{ display: "flex", width: 96, height: 10, backgroundColor: CHERRY, borderRadius: 5, marginBottom: 24 }} />
          <div style={{ display: "flex", fontSize: headingSize(page, 104, 68), fontWeight: 700, color: "#ffffff", lineHeight: 1.02, lineClamp: 2 }}>
            {page}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.88)", marginTop: 18, lineClamp: 2 }}>
            {sub || "Red Cherry Events · Rider Hub"}
          </div>
        </div>
      </div>
    </div>
  );

  const headers = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
  try {
    const img = await ImageResponse.async(body, { width: W, height: H, fonts: [new GoogleFont(font, { weight: 700 })], headers });
    return img;
  } catch (err) {
    console.error("og render with font failed", err);
    return ImageResponse.async(body, { width: W, height: H, headers });
  }
}
