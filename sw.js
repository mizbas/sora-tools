// オフラインでも開けるようにするためのキャッシュ（ビルドごとに更新）
const CACHE = "sora-tools-mwu2v65e";
const SHELL = ["./", "index.html", "tool.html", "crypto.js?v=mwu2v65e", "app.css", "app.css?v=mwu2v65e", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// まずネットから取り、つながらないときはキャッシュを使う
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // 同じサイトのファイルは毎回更新を確認する（古い版が10分ほど残るのを防ぐ）
  const same = new URL(e.request.url).origin === location.origin;
  e.respondWith(fetch(same ? new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" }) : e.request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match(e.request, { ignoreSearch: true }))));
});
