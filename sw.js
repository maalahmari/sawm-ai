const CACHE_NAME = 'sawm-ai-v1';

// الملفات الأساسية اللي نخزنها
const CORE_ASSETS = [
  '/post-ad-screen.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap'
];

// CDN files — نحاول نخزنها بس ما نعتمد عليها
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// Install — خزّن الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // خزّن الأساسيات أول
      return cache.addAll(CORE_ASSETS).then(() => {
        // حاول تخزّن CDN بدون ما توقف التثبيت لو فشلت
        return Promise.allSettled(
          CDN_ASSETS.map(url => cache.add(url).catch(() => console.log('CDN cache skip:', url)))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — امسح الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // طلبات Gemini API — دايم من الشبكة، لا تخزنها
  if (url.hostname === 'generativelanguage.googleapis.com') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // خزّن النسخة الجديدة
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // لو الشبكة فشلت، جيب من الكاش
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // لو الطلب HTML، رجّع الصفحة الرئيسية
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/post-ad-screen.html');
          }
        });
      })
  );
});
