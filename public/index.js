"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

// ── bare-mux connection — UV only ─────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

// ── Get the active controlling ServiceWorker — the exact object Controller needs ──
// navigator.serviceWorker.controller is the SW currently controlling this page.
// Must wait for it: on first load after install, clients.claim() sets it async.
async function getActiveSW() {
	// Already controlling this page — best case
	if (navigator.serviceWorker.controller) {
		return navigator.serviceWorker.controller;
	}
	// Wait for controllerchange event — fires when clients.claim() runs
	// Timeout after 15s to avoid hanging forever if something goes wrong
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error("[Fish/SJ] Timed out waiting for service worker controller (15s)"));
		}, 15000);
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			clearTimeout(timeout);
			resolve(navigator.serviceWorker.controller);
		}, { once: true });
	});
}

// ── SJ Controller — lazy singleton ───────────────────────────────────────────
// $scramjetController global is set by /scram/controller.api.js in index.html
let _sjController = null;

async function initSJController() {
	if (_sjController) return _sjController;

	// Get the ServiceWorker that controls this page — what Controller expects
	const sw = await getActiveSW();
	if (!sw) throw new Error("[Fish/SJ] No controlling service worker found");

	// Import libcurl transport.
	// libcurl/index.mjs exports ONLY: LibcurlClient as default
	// The WASM is embedded as a data URI inside the 2MB bundle and loads
	// automatically when the module is imported — no manual load_wasm() needed.
	const { default: LibcurlClient } = await import("/libcurl/index.mjs");

const transport = new LibcurlClient({ wisp: getWispUrl() });
await transport.init();

// legacy Scramjet mode (no controller API)
_sjController = {
	transport,
	sync: null
};

// load legacy engine once
if (!window.__scramjetLoaded) {
	await import("/scram/scramjet.sync.js");
	window.__scramjetLoaded = true;
}
	return _sjController;
}

// ── Proxy toggle ──────────────────────────────────────────────────────────────
let activeProxy = localStorage.getItem("fish-proxy-choice") || "sj";
localStorage.setItem("fish-proxy-choice", activeProxy);

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (event) => {
	event.preventDefault();
	error.textContent     = "";
	errorCode.textContent = "";

	try {
		await registerSW();
	} catch (err) {
		error.textContent     = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const engineUrl = localStorage.getItem("fish-search-engine") || searchEngine.value;
	const url       = search(address.value, engineUrl);

	if (activeProxy === "uv") {
		// ── UV: Epoxy transport, static #uv-frame ─────────────────────────────
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: getWispUrl() }]);
		}
		const sjFrame = document.getElementById("sj-frame");
		if (sjFrame) sjFrame.remove();
		const frame = document.getElementById("uv-frame");
		frame.style.display = "block";
		frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

	} else {
		// ── SJ: Controller API, libcurl transport ─────────────────────────────
		const uvFrame = document.getElementById("uv-frame");
		uvFrame.style.display = "none";
		uvFrame.src = "";
		const oldSjFrame = document.getElementById("sj-frame");
		if (oldSjFrame) oldSjFrame.remove();

		try {
			await initSJController();

const frame = document.createElement("iframe");
frame.id = "sj-frame";
document.body.appendChild(frame);

window.__scramjetNavigate?.(frame, url);

			if (typeof hideHome === "function") hideHome();
			const _bar = document.getElementById("browser-console");
			if (_bar) { _bar.style.display = "block"; _bar.classList.remove("active"); }
		} catch (err) {
			// Show error inline rather than silently failing
			error.textContent     = "Scramjet failed to initialize.";
			errorCode.textContent = err.toString();
			console.error("[Fish/SJ] init error:", err);
		}
	}
});
