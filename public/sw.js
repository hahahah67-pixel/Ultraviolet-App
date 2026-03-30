importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Load config once on SW startup — not per fetch
let configReady = scramjet.loadConfig().catch(e => {
	console.warn("[SJ SW] Config load failed:", e);
});

// Headers that reveal proxy/bot identity — strip these from outgoing requests
const STRIP_HEADERS = [
	"x-forwarded-for",
	"x-forwarded-host",
	"x-forwarded-proto",
	"x-real-ip",
	"x-request-id",
	"x-scramjet-stripping",
	"via",
	"forwarded",
];

// Clean request headers to look more like a real browser
function scrubRequest(request) {
	try {
		const headers = new Headers(request.headers);
		let modified = false;

		// Strip proxy-revealing headers
		for (const h of STRIP_HEADERS) {
			if (headers.has(h)) {
				headers.delete(h);
				modified = true;
			}
		}

		// If no sec-fetch-site, spoof it — missing sec-fetch-* headers
		// is a strong bot signal that YouTube checks for
		if (!headers.has("sec-fetch-site")) {
			headers.set("sec-fetch-site", "same-origin");
			headers.set("sec-fetch-mode", "navigate");
			headers.set("sec-fetch-dest", "document");
			modified = true;
		}

		if (!modified) return request;

		return new Request(request, { headers });
	} catch (e) {
		// If anything goes wrong just return original request unchanged
		return request;
	}
}

self.addEventListener("fetch", (event) => {
	event.respondWith(
		configReady.then(() => {
			if (scramjet.route(event)) {
				return scramjet.fetch(event);
			}
			// For non-proxied requests apply header scrubbing
			return fetch(scrubRequest(event.request));
		}).catch(() => fetch(event.request))
	);
});
