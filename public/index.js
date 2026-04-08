"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

// ── bare-mux connection (shared by both proxies) ──────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// ── Scramjet controller ───────────────────────────────────────────────────────
const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all:  "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

// ── Proxy state ───────────────────────────────────────────────────────────────
let activeProxy = localStorage.getItem("fish-proxy-choice") || "sj";

// SJ wrapper created once and reused — never destroyed to avoid state leaks
let sjWrapper = null;

function setProxy(name) {
	activeProxy = name;
	localStorage.setItem("fish-proxy-choice", name);
}

setProxy(activeProxy);

// ── Wisp URL helper ───────────────────────────────────────────────────────────
function getWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/"
	);
}

// ── Show browser console helper ───────────────────────────────────────────────
function showConsole() {
	const bar = document.getElementById("browser-console");
	if (bar) {
		bar.style.display = "block";
		bar.classList.remove("active");
	}
}

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (event) => {
	event.preventDefault();

	error.textContent = "";
	errorCode.textContent = "";

	try {
		await registerSW();
	} catch (err) {
		error.textContent = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	// Apply search engine from settings
	const savedEngine = localStorage.getItem("fish-search-engine");
	if (savedEngine) searchEngine.value = savedEngine;

	// Re-read proxy choice in case it changed via settings page
	activeProxy = localStorage.getItem("fish-proxy-choice") || "sj";

	const url      = search(address.value, searchEngine.value);
	const wispUrl  = getWispUrl();
	const uvFrame  = document.getElementById("uv-frame");

	if (activeProxy === "uv") {
		// ── Ultraviolet ──────────────────────────────────────────────────────
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}

		// Hide SJ frame if it exists — do NOT destroy it, just hide
		if (sjWrapper) {
			sjWrapper.frame.style.display = "none";
		}

		uvFrame.style.display = "block";
		uvFrame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
		// UV show/hide and console handled by uvFrame.load listener in index.html

	} else {
		// ── Scramjet ─────────────────────────────────────────────────────────
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
		}

		// Hide UV frame without triggering load events
		uvFrame.style.display = "none";
		uvFrame.src = "";

		if (!sjWrapper) {
			// Create SJ frame exactly once for the lifetime of this page
			sjWrapper = scramjet.createFrame();
			sjWrapper.frame.id = "sj-frame";
			sjWrapper.frame.style.cssText = "border:none;position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:200000;background:#000;display:block;";
			document.body.appendChild(sjWrapper.frame);
		} else {
			// Reuse — just make it visible again
			sjWrapper.frame.style.display = "block";
		}

		sjWrapper.go(url);

		// SJ never fires uvFrame.load so we handle show/hide manually
		if (typeof hideHome === "function") hideHome();
		showConsole();
	}
});
