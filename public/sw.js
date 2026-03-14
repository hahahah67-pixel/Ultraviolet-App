/*global UVServiceWorker,__uv$config*/
/*
 * Stock service worker script.
 * Users can provide their own sw.js if they need to extend the functionality of the service worker.
 * Ideally, this will be registered under the scope in uv.config.js so it will not need to be modified.
 */

importScripts("uv.bundle.js");
importScripts("uv.config.js");
importScripts(__uv$config.sw || "uv.sw.js");

const uv = new UVServiceWorker();

async function handleRequest(event) {
	if (uv.route(event)) {
		return await uv.fetch(event);
	}

	return await fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
