importScripts("/scram/controller.sw.js");

// Headers that reveal proxy/bot identity — strip from outgoing requests
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

function scrubRequest(request) {
	try {
		const headers = new Headers(request.headers);
		let modified = false;
		for (const h of STRIP_HEADERS) {
			if (headers.has(h)) { headers.delete(h); modified = true; }
		}
		if (!headers.has("sec-fetch-site")) {
			headers.set("sec-fetch-site", "same-origin");
			headers.set("sec-fetch-mode", "navigate");
			headers.set("sec-fetch-dest", "document");
			modified = true;
		}
		if (!modified) return request;
		return new Request(request, { headers });
	} catch (e) { return request; }
}

// controller.sw.js handles install, activate (skipWaiting + clients.claim), and message.
// We only add the fetch handler here.
self.addEventListener("fetch", (event) => {
	event.respondWith(
		(async () => {
			if ($scramjetController.shouldRoute(event)) {
				return await $scramjetController.route(event);
			}
			return fetch(scrubRequest(event.request));
		})().catch(() => fetch(event.request))
	);
});
