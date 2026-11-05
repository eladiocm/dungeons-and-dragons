/* The shell is public. API responses, voice, prompts and credentials are never cached. */
const CACHE = 'dnd-shell-v4';
const CORE = [
  '/',
  '/offline.html',
  '/scenes/square.svg',
  '/scenes/road.svg',
  '/scenes/mill.svg',
  '/scenes/chamber.svg',
  '/scenes/beacon.svg',
  '/scenes/beacon-lit.svg',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE);
      const html = await (await cache.match('/')).text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => new URL(match[1], self.location.origin))
        .filter(
          (url) =>
            url.origin === self.location.origin &&
            url.pathname.startsWith('/_next/static/'),
        )
        .map((url) => url.href);
      await Promise.allSettled(
        [...new Set(assets)].map((asset) => cache.add(asset)),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith('dnd-shell-') && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('message', (event) => {
  if (
    event.data?.type !== 'CACHE_APP_SHELL' ||
    !Array.isArray(event.data.assets)
  )
    return;
  const assets = event.data.assets
    .filter((value) => {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        return (
          url.origin === self.location.origin &&
          url.pathname.startsWith('/_next/static/')
        );
      } catch {
        return false;
      }
    })
    .slice(0, 80);
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(assets.map((asset) => cache.add(asset))),
      ),
  );
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok && url.pathname === '/')
            await cache.put('/', response.clone());
          return response;
        } catch {
          return (
            (await cache.match('/')) ||
            (await cache.match('/offline.html')) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }
  if (
    url.pathname.startsWith('/_next/static/') ||
    CORE.includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
