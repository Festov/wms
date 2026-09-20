/**
 * Self-destructing service worker.
 * Old clients may still have /sw.js registered — on update they unregister
 * and clear caches so the app never depends on browser HTTP cache.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const regs = await self.registration.unregister();
      void regs;
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});

// Do not intercept any fetch — network only
self.addEventListener("fetch", () => {});
