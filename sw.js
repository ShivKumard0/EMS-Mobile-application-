/* ADT Employee app: offline store (service worker).
   - Receipt reader (ocr/, about 20 MB) and PDF reader (lib/pdfjs/): saved on the phone the first time they are used,
     then always read from the phone. If the reader files are ever replaced, change READER below so
     phones fetch the new ones and the old copy is removed.
   - App files (page, scripts, styles, icons): fetched fresh whenever the phone is online, so updates
     show at once; the last copy is used when there is no connection.
   Data (claims, approvals) is not here: it stays in the app's own store (js/store.js). */
const READER = 'adt-reader-ppocrv4-20261110';
const SHELL = 'adt-app-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== READER && k !== SHELL; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function isReader(url) { return url.pathname.indexOf('/ocr/') !== -1 || url.pathname.indexOf('/lib/') !== -1; }

async function fromReader(req) {
  const cache = await caches.open(READER);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) await cache.put(req, res.clone());
  return res;
}

async function fromApp(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    if (req.mode === 'navigate') { const page = await cache.match('index.html', { ignoreSearch: true }) || await cache.match('./', { ignoreSearch: true }); if (page) return page; }
    throw err;
  }
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(isReader(url) ? fromReader(req) : fromApp(req));
});
