"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

// ── bare-mux connection — UV only. SJ uses libcurl directly. ──────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// ── Wisp URL helper ───────────────────────────────────────────────────────────
function getWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/"
	);
}

// ── SJ Controller — lazy singleton, created once after SW is registered ───────
// $scramjetController global is set by controller.api.js loaded in index.html.
let _sjController = null;

async function initSJController() {
	if (_sjController) return _sjController;

	// Find specifically the Scramjet SW at /sw.js — not the UV one at /uv/sw.js
	const regs  = await navigator.serviceWorker.getRegistrations();
	const sjReg = regs.find(r =>
		r.active && new URL(r.active.scriptURL).pathname === "/sw.js"
	);
	const sw = sjReg?.active;
	if (!sw) throw new Error("[Fish/SJ] Scramjet SW not active — registerSW() first");

	// LibcurlClient imported from existing /libcurl/index.mjs
	const { default: LibcurlClient } = await import("/libcurl/index.mjs");
	const transport = new LibcurlClient({ wisp: getWispUrl() });
	await transport.init();

	// Controller config points to the new split files in /scram/
	_sjController = new $scramjetController.Controller({
		serviceworker: sw,
		transport,
		config: {
			scramjetPath: "/scram/scramjet.js",
			injectPath:   "/scram/controller.inject.js",
			wasmPath:     "/scram/scramjet.wasm",
		},
	});

	await _sjController.wait();
	return _sjController;
}

// ── Proxy toggle state ────────────────────────────────────────────────────────
let activeProxy = localStorage.getItem("fish-proxy-choice") || "sj";

function setProxy(name) {
	activeProxy = name;
	localStorage.setItem("fish-proxy-choice", name);
}

setProxy(activeProxy);

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
	const wispUrl   = getWispUrl();

	if (activeProxy === "uv") {
		// ── Ultraviolet: Epoxy transport → static #uv-frame ───────────────────
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}

		const sjFrame = document.getElementById("sj-frame");
		if (sjFrame) sjFrame.remove();

		const frame = document.getElementById("uv-frame");
		frame.style.display = "block";
		frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

	} else {
		// ── Scramjet: new Controller API with libcurl transport ────────────────
		const uvFrame = document.getElementById("uv-frame");
		uvFrame.style.display = "none";
		uvFrame.src = "";

		// Remove any previous SJ frame
		const oldSjFrame = document.getElementById("sj-frame");
		if (oldSjFrame) oldSjFrame.remove();

		const ctrl           = await initSJController();
		const sjFrameWrapper = ctrl.createFrame();         // creates a new iframe
		sjFrameWrapper.element.id = "sj-frame";           // .element not .frame
		document.body.appendChild(sjFrameWrapper.element);
		sjFrameWrapper.go(url);                            // handles URL encoding internally

		// SJ doesn't fire uvFrame.load — show browser UI manually
		if (typeof hideHome === "function") hideHome();
		const _bar = document.getElementById("browser-console");
		if (_bar) { _bar.style.display = "block"; _bar.classList.remove("active"); }
	}
});
