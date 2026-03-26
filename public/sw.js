importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Load config once on SW startup instead of on every fetch request.
// This removes per-request overhead and makes SJ faster and more stable.
let configReady = scramjet.loadConfig().catch(e => {
	console.warn("[SJ SW] Config load failed:", e);
});

self.addEventListener("fetch", (event) => {
	event.respondWith(
		configReady.then(() => {
			if (scramjet.route(event)) {
				return scramjet.fetch(event);
			}
			return fetch(event.request);
		}).catch(() => fetch(event.request))
	);
});
