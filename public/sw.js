importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts("/uv/uv.sw.js");

const uv = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith(__uv$config.prefix)) {
    event.respondWith(uv.fetch(event));
  }
});
