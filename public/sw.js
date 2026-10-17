/* LarisKu service worker: offline app shell, cached build assets,
   and notification clicks. Firebase, Google sign-in and API calls are never
   cached or intercepted. Bump VERSION to drop old caches. */
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const STATIC = `static-${VERSION}`;
const PRECACHE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks for this after the owner taps "Muat ulang" on the update notice.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC));
    return;
  }
  if (!sameOrigin || url.pathname.startsWith("/__/")) return; // Firebase auth helpers, APIs: network only

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSETS)); // hashed file names never change
    return;
  }
  if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(request, STATIC));
});

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put("/", response.clone());
    return response;
  } catch {
    return (await cache.match("/")) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === "opaque") cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/orders", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) return open.focus().then((c) => c.navigate?.(target) ?? c);
      return self.clients.openWindow(target);
    }),
  );
});
