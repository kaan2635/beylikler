// Beylikler service worker: oyunu telefona kurulabilir ve çevrimdışı açılabilir yapar.
//
// - Sürüm damgalı dosyalar (?v=…) içerikleri değişmediği sürece aynıdır: önce önbellekten.
//   Bir dosyanın yeni sürümü gelince eski sürümleri önbellekten silinir.
// - Diğer her şey (sayfanın kendisi, simgeler): önce ağdan; ağ yoksa önbellekten.
// Oyunun kaydı zaten tarayıcıda (localStorage) durduğu için çevrimdışı oynanabilir.

const CACHE = 'beylikler-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './assets/favicon.svg', './assets/icon-192.png'];

/**
 * index.html'deki sürüm damgalı adresleri (import map ve stil) önbelleğe alır; eksik olanları
 * indirir. Böylece oyun ilk açılıştan sonra, hiçbir ekran gezilmeden de çevrimdışı açılır.
 */
async function warm(html) {
  const cache = await caches.open(CACHE);
  const urls = new Set();
  for (const match of html.matchAll(/["']\.?\/?((?:js|css)\/[^"'?]+\?v=[0-9a-f]+)["']/g)) urls.add(new URL(match[1], self.registration.scope).href);
  for (const url of urls) {
    if (await cache.match(url)) continue;
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response.clone());
        await prune(cache, new URL(url));
      }
    } catch {
      // Ağ gitti; bir sonraki açılışta yeniden denenir.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(SHELL);
      const page = await cache.match('./index.html');
      if (page) await warm(await page.text());
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Aynı dosyanın eski sürümlerini (farklı ?v=) önbellekten siler. */
async function prune(cache, url) {
  for (const request of await cache.keys()) {
    const cached = new URL(request.url);
    if (cached.pathname === url.pathname && cached.search !== url.search) await cache.delete(request);
  }
}

async function versioned(request, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    prune(cache, url);
  }
  return response;
}

async function networkFirst(request, event) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      // Oyun sayfası güncellendiyse yeni sürümün dosyalarını arka planda önbelleğe al.
      const path = new URL(request.url).pathname;
      const scope = new URL(self.registration.scope).pathname;
      if (request.mode === 'navigate' && (path === scope || path === `${scope}index.html`)) {
        const copy = response.clone();
        cache.put('./index.html', response.clone());
        event.waitUntil(copy.text().then(warm));
      }
    }
    return response;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (hit) return hit;
    if (request.mode === 'navigate') return (await cache.match('./index.html')) ?? Response.error();
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(url.searchParams.has('v') ? versioned(request, url) : networkFirst(request, event));
});
