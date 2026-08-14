const CACHE_PREFIX = "calculo-mental";
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v3`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-v3`;
const APP_SCOPE = new URL("./", self.registration.scope);

const CORE_PATHS = [
  "./offline.html",
  "./asset-manifest.json",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

const urlFromScope = (path) => new URL(path, APP_SCOPE).href;
const canCache = (response) => response.ok || response.type === "opaque";

async function putInCache(cacheName, request, response) {
  // CacheStorage rejeita respostas parciais (comuns em reprodução de áudio).
  // O arquivo completo já entra no app shell pelo manifest de produção.
  if (!canCache(response) || response.status === 206) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function cacheAppShell() {
  const cache = await caches.open(SHELL_CACHE);
  const indexUrl = urlFromScope("./index.html");
  const indexResponse = await fetch(indexUrl, { cache: "reload" });

  if (!indexResponse.ok) {
    throw new Error(`Falha ao preparar o app shell: ${indexResponse.status}`);
  }

  const html = await indexResponse.clone().text();
  const manifestUrl = urlFromScope("./asset-manifest.json");
  const manifestResponse = await fetch(manifestUrl, { cache: "reload" });
  const manifest = manifestResponse.ok ? await manifestResponse.clone().json() : {};
  await Promise.all([
    cache.put(indexUrl, indexResponse.clone()),
    cache.put(APP_SCOPE.href, indexResponse.clone()),
    cache.addAll(CORE_PATHS.map(urlFromScope)),
  ]);

  // Vite hashes JS/CSS on every build. Reading the generated index keeps the
  // precache independent from those filenames and from the deployment subpath.
  const buildAssets = [...html.matchAll(/\b(?:src|href)=["']([^"'#]+)["']/gi)]
    .map((match) => new URL(match[1], indexUrl))
    .filter(
      (url) =>
        url.origin === APP_SCOPE.origin &&
        url.pathname.startsWith(APP_SCOPE.pathname),
    );

  const manifestAssets = Object.values(manifest)
    .flatMap((entry) => [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])])
    .filter(Boolean)
    .map((path) => new URL(path, indexUrl));

  await Promise.allSettled(
    [...new Set([...buildAssets, ...manifestAssets].map((url) => url.href))].map((assetUrl) =>
      cache.add(assetUrl),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith(`${CACHE_PREFIX}-`) &&
                  key !== SHELL_CACHE &&
                  key !== RUNTIME_CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all([
        cache.put(request, response.clone()),
        cache.put(APP_SCOPE.href, response.clone()),
        cache.put(urlFromScope("./index.html"), response.clone()),
      ]);
    }
    return response;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(APP_SCOPE.href, { ignoreSearch: true })) ||
      (await caches.match(urlFromScope("./offline.html")))
    );
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  const network = fetch(request)
    .then(async (response) => {
      await putInCache(RUNTIME_CACHE, request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

async function audioRangeResponse(request) {
  const rangeHeader = request.headers.get("range");
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader ?? "");
  if (!match || (!match[1] && !match[2])) return fetch(request);

  try {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (!cached || cached.status !== 200 || cached.type === "opaque") return fetch(request);

    const bytes = await cached.arrayBuffer();
    const total = bytes.byteLength;
    const suffixLength = match[1] ? null : Number(match[2]);
    const start = suffixLength == null
      ? Number(match[1])
      : Math.max(0, total - suffixLength);
    const end = match[2] && suffixLength == null
      ? Math.min(Number(match[2]), total - 1)
      : total - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const headers = new Headers(cached.headers);
    headers.delete("Content-Encoding");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      statusText: "Partial Content",
      headers,
    });
  } catch {
    return fetch(request);
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await putInCache(RUNTIME_CACHE, request, response.clone());
    return response;
  } catch {
    return caches.match(request, { ignoreSearch: true });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (request.destination === "audio" && request.headers.has("range")) {
    event.respondWith(audioRangeResponse(request));
    return;
  }

  const cacheableDestination = ["audio", "font", "image", "script", "style", "manifest"].includes(
    request.destination,
  );

  if (cacheableDestination) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  const isLocalJson =
    url.origin === APP_SCOPE.origin &&
    url.pathname.startsWith(APP_SCOPE.pathname) &&
    url.pathname.endsWith(".json") &&
    !url.pathname.includes("/api/");

  if (isLocalJson) {
    event.respondWith(networkFirst(request));
  }
});
