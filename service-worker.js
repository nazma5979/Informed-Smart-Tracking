
const CACHE_NAME = 'mood-patterns-v4-adaptive-instant';

// CRITICAL: These must match the importmap in index.html exactly.
const CDN_ASSETS = [
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/lucide-react@^0.554.0',
  'https://aistudiocdn.com/recharts@^3.4.1',
  'https://aistudiocdn.com/uuid@^13.0.0',
  'https://cdn-icons-png.flaticon.com/512/9722/9722703.png'
];

const APP_SHELL = [
  '/',
  '/index.html',
  '/metadata.json',
];

const URLS_TO_CACHE = [...APP_SHELL, ...CDN_ASSETS];

self.addEventListener('install', (event) => {
  // Force SW to active immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('activate', (event) => {
  // Take control of all clients immediately
  event.waitUntil(clients.claim());

  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRATEGY 1: Stale-While-Revalidate for Navigation (HTML)
  // "Instant Loading" pattern: Serve cached content immediately, update cache in background.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
           // 1. Try to find the app shell in cache
           const cachedResponse = await caches.match('/index.html');
           
           // 2. Network fetch (background update)
           const networkFetch = fetch(event.request).then(response => {
             // Update cache with new version
             if (response.status === 200) {
                 const responseClone = response.clone();
                 caches.open(CACHE_NAME).then(cache => cache.put('/index.html', responseClone));
             }
             return response;
           }).catch(() => {
              // Network failed, just return cached if we haven't already
           });

           // 3. Return cached immediately if available, else wait for network
           return cachedResponse || networkFetch;
        } catch (e) {
           return fetch(event.request);
        }
      })()
    );
    return;
  }

  // STRATEGY 2: Cache First for Immutable Assets (Images & CDN)
  // Assets with hashes or versions in URL can be cached aggressively.
  // We check for CDN URLs specifically to ensure they persist.
  if (event.request.destination === 'image' || URLS_TO_CACHE.some(u => event.request.url.includes(u))) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
            return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
            // Only cache valid responses
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
                return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
            return networkResponse;
        });
      })
    );
    return;
  }

  // STRATEGY 3: Stale-While-Revalidate for other Scripts/Styles
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
            if(networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        }).catch(err => {
            // Network failed, rely on cache if available
        });

        return cachedResponse || fetchPromise;
      })
  );
});
