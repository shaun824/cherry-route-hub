/* Red Cherry Rider Hub — push messaging service worker.
   This worker ONLY handles Web Push. It never caches the app shell and never
   intercepts fetch requests, so it cannot serve stale pages. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
