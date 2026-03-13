// SonHarf Service Worker v1.0
const CACHE_NAME = 'sonharf-v1';
const OFFLINE_CACHE = 'sonharf-offline-v1';

// Cache'lenecek dosyalar
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install — dosyaları cache'e al
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate — eski cache'leri temizle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== OFFLINE_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — Cache First for app shell, Network First for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API istekleri (TDK proxy, Supabase) → her zaman network
  if (url.pathname.startsWith('/api/') || 
      url.hostname.includes('supabase.co') ||
      url.hostname.includes('sozluk.gov.tr')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // API erişilemiyorsa boş yanıt
        return new Response(
          JSON.stringify({ valid: null, source: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // AdMob / Analytics → network, hata olursa sessizce geç
  if (url.hostname.includes('google') || 
      url.hostname.includes('doubleclick') ||
      url.hostname.includes('admob')) {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }

  // App shell → Cache First, yoksa Network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Başarılı yanıtı cache'le
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // Tamamen offline → index.html döndür
        return caches.match('/index.html');
      });
    })
  );
});

// Push bildirimleri (ileride kullanım için)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SonHarf', {
      body: data.body || 'Yeni bir bildirim var!',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
