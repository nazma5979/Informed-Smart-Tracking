
const CACHE_NAME = 'mood-patterns-v1-release';

// CRITICAL: These must match the importmap in index.html exactly.
const CDN_ASSETS = [
  'https://aistudiocdn.com/react@^19.2.0/',
  'https://aistudiocdn.com/react@^19.2.0',
  'https://aistudiocdn.com/react-dom@^19.2.0/',
  'https://aistudiocdn.com/lucide-react@^0.554.0',
  'https://aistudiocdn.com/recharts@^3.4.1',
  'https://aistudiocdn.com/uuid@^13.0.0'
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
  // STRATEGY: Network First, Fallback to Cache for HTML (Navigation)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
           const responseClone = response.clone();
           caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, responseClone);
           });
           return response;
        })
        .catch(() => {
           return caches.match('/index.html');
        })
    );
    return;
  }

  // STRATEGY: Stale-While-Revalidate for Assets
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
            if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                // Cache internal assets or CDN assets
                if (event.request.url.startsWith('http')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
            }
            return networkResponse;
        }).catch(err => {
            // Network failed, nothing to do (cachedResponse will be returned if it existed)
            // If no cachedResponse, this promise resolves to undefined/throws, handled by downstream
        });

        return cachedResponse || fetchPromise;
      })
  );
});
