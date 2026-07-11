const SHELL_VERSION = "__SW_VERSION__";
const PRECACHE_URLS = JSON.parse(__PRECACHE_URLS_JSON__);
const CACHE_PREFIX = "localterm-shell-v";
const PRECACHE = `${CACHE_PREFIX}${SHELL_VERSION}`;
const SHELL_URL = "/";

const isShellAsset = (request, url) =>
  request.method === "GET" &&
  url.origin === self.location.origin &&
  !url.pathname.startsWith("/api/") &&
  url.pathname !== "/ws";

const fromCacheOrNetwork = async (request) => {
  const cache = await caches.open(PRECACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) await cache.put(request, fresh.clone());
  return fresh;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // A deploy can replace hashed assets while an older worker is installing.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== PRECACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isShellAsset(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(PRECACHE);
            await cache.put(SHELL_URL, fresh.clone());
          }
          return fresh;
        } catch {
          const cache = await caches.open(PRECACHE);
          return (await cache.match(SHELL_URL)) || (await cache.match(request)) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(fromCacheOrNetwork(request).catch(() => Response.error()));
});
