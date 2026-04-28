const CACHE_NAME = 'asset-tool-v' + Date.now();

const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 安装时缓存最新资源，并跳过等待立即生效
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES))
  );
});

// 激活时删除旧缓存，并立即接管页面
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 请求策略：网页文件优先联网，失败再缓存；静态资源优先缓存
self.addEventListener('fetch', event => {
  const req = event.request;

  // 只处理 GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // HTML 页面：网络优先（确保更新最快）
  if (
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(res => res || caches.match('./index.html')))
    );
    return;
  }

  // 其它资源：缓存优先，同时后台更新
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});