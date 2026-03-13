// ═══════════════════════════════════════════
// sw.js — Optimize Edilmiş Service Worker v2.0
// Cache Stratejileri: App Shell, API, Assets
// ═══════════════════════════════════════════

const VERSION     = 'v2.0';
const CACHE_SHELL = `sonharf-shell-${VERSION}`;
const CACHE_API   = `sonharf-api-${VERSION}`;
const CACHE_ASSET = `sonharf-assets-${VERSION}`;

// ─── App Shell (Cache First) ───
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/core.css',
  '/styles/components.css',
  '/styles/game.css',
  '/styles/systems.css',
];

// ─── Install: Shell önbelleğe al ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install failed:', err))
  );
});

// ─── Activate: Eski cache'leri temizle ───
self.addEventListener('activate', event => {
  const VALID = new Set([CACHE_SHELL, CACHE_API, CACHE_ASSET]);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !VALID.has(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: Strateji Yönlendirici ───
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // POST/PUT/DELETE → direkt network
  if (request.method !== 'GET') return;

  // 1. API istekleri → Network First
  if (_isApiRequest(url)) {
    event.respondWith(_networkFirst(request, CACHE_API));
    return;
  }

  // 2. Google Fonts, CDN → Stale While Revalidate
  if (_isExternalAsset(url)) {
    event.respondWith(_staleWhileRevalidate(request, CACHE_ASSET));
    return;
  }

  // 3. AdMob / Analytics → Network Only
  if (_isAdOrAnalytics(url)) {
    event.respondWith(fetch(request).catch(() => new Response('')));
    return;
  }

  // 4. App Shell & diğerleri → Cache First
  event.respondWith(_cacheFirst(request, CACHE_SHELL));
});

// ─── Stratejiler ───

async function _cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback
    const fallback = await caches.match('/index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

async function _networkFirst(request, cacheName) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // API offline fallback
    return new Response(
      JSON.stringify({ valid: null, source: 'offline' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('', { status: 503 });
}

// ─── URL Sınıflandırıcılar ───
function _isApiRequest(url) {
  return url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('sozluk.gov.tr');
}

function _isExternalAsset(url) {
  return url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com');
}

function _isAdOrAnalytics(url) {
  return url.hostname.includes('googlesyndication.com') ||
    url.hostname.includes('doubleclick.net') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('admob.com');
}

// ─── Push Bildirimleri ───
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SonHarf', {
      body:  data.body  || 'Yeni bildirim!',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data:  data.url   || '/',
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
