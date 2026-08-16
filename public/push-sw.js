/* Red Cherry Rider Hub — service worker.
   Handles Web Push AND offline support for the race village / route maps.

   Caching rules (deliberately narrow so pages never go stale):
   - Map tiles (OSM + Esri satellite): cache-first, forever. These are the bytes
     riders pre-download for the venue where there is no signal.
   - Route files (KML/GPX) and event images: stale-while-revalidate.
   - App build assets (JS/CSS/fonts): stale-while-revalidate so the app boots offline.
   - Navigations: network-first with a cached-document fallback.
   - Everything else (API, Supabase, auth): untouched, always network.
*/

const TILE_CACHE = "rce-tiles-v1";
const ASSET_CACHE = "rce-assets-v1";
const DOC_CACHE = "rce-docs-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("rce-") && ![TILE_CACHE, ASSET_CACHE, DOC_CACHE].includes(k))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);

function isTile(url) {
  return (
    /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) ||
    /(^|\.)basemaps\.cartocdn\.com$/.test(url.hostname) ||
    (url.hostname === "server.arcgisonline.com" && url.pathname.includes("/MapServer/tile/"))
  );
}

function isRouteFile(url) {
  return /\.(kml|gpx|geojson)(\?|$)/i.test(url.pathname + url.search);
}

function isEventMedia(url) {
  return (
    /supabase\.co$/.test(url.hostname) &&
    /\/storage\/v1\/object\//.test(url.pathname) &&
    /(event-images|event-kmls|sponsor-logos)/.test(url.pathname)
  );
}

function isBuildAsset(url) {
  return (
    url.origin === self.location.origin &&
    (/\/(_build|assets)\//.test(url.pathname) ||
      /\.(js|css|woff2?|png|svg|webp|jpg|jpeg|ico|webmanifest)$/i.test(url.pathname))
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const fallback = await cache.match(request, { ignoreVary: true, ignoreSearch: true });
    if (fallback) return fallback;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await network;
  if (res) return res;
  throw new Error("offline and not cached");
}

async function networkFirstDoc(request) {
  const cache = await caches.open(DOC_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit =
      (await cache.match(request, { ignoreVary: true, ignoreSearch: true })) ||
      (await cache.match("/", { ignoreVary: true, ignoreSearch: true }));
    if (hit) return hit;
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<body style=\"font-family:system-ui;padding:2rem;text-align:center\"><h1>You're offline</h1>" +
        "<p>Open the app once with signal to save this page for the venue.</p></body>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (isTile(url)) return event.respondWith(cacheFirst(req, TILE_CACHE));
  if (isRouteFile(url) || isEventMedia(url)) return event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
  if (isBuildAsset(url)) return event.respondWith(staleWhileRevalidate(req, ASSET_CACHE));
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    return event.respondWith(networkFirstDoc(req));
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "RCE_CLEAR_TILES") {
    event.waitUntil(caches.delete(TILE_CACHE));
  }
  if (data.type === "RCE_SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: "Red Cherry Events", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Red Cherry Events";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    image: payload.image || undefined,
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    requireInteraction: Boolean(payload.urgent),
    vibrate: payload.urgent ? [200, 80, 200, 80, 200] : [100, 50, 100],
    data: {
      url: payload.url || "/",
      notificationId: payload.notificationId || null,
      deliveryId: payload.deliveryId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = new URL(data.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      if (data.deliveryId) {
        try {
          await fetch("/api/public/hooks/notification-click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deliveryId: data.deliveryId }),
          });
        } catch (_) {
          /* stats only — never block the open */
        }
      }
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      for (const client of clientList) {
        if ("navigate" in client && "focus" in client) {
          await client.focus();
          return client.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
