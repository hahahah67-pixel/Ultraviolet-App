importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts("/uv/uv.sw.js");

// Scramjet runtime
importScripts("/scramjet/scramjet.all.js");
importScripts("/scramjet/scramjet.sync.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Ultraviolet worker
const uv = new UVServiceWorker();

self.addEventListener("fetch", (event) => {

    const url = new URL(event.request.url);

    // SCRAMJET ROUTE
    if (url.pathname.startsWith("/scramjet/")) {
        event.respondWith((async () => {

            await scramjet.loadConfig();

            if (scramjet.route(event)) {
                return scramjet.fetch(event);
            }

            return fetch(event.request);

        })());

        return;
    }

    // ULTRAVIOLET ROUTE
    if (url.pathname.startsWith(__uv$config.prefix)) {
        event.respondWith(uv.fetch(event.request));
        return;
    }

});
