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

	// Re-read proxy choice in case user changed it in settings
	activeProxy = localStorage.getItem("fish-proxy-choice") || "sj";

	// Apply search engine from settings
	const savedEngine = localStorage.getItem("fish-search-engine");
	if (savedEngine) searchEngine.value = savedEngine;

	const url     = search(address.value, searchEngine.value);
	const wispUrl = getWispUrl();

	if (activeProxy === "uv") {
		// ── Ultraviolet ──────────────────────────────────────────────────────
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}

		const sjFrame = document.getElementById("sj-frame");
		if (sjFrame) sjFrame.remove();

		let frame = document.getElementById("uv-frame");
		frame.style.display = "block";
		frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
		// UV show/hide and console handled by uvFrame.load listener in index.html

	} else {
		// ── Scramjet ─────────────────────────────────────────────────────────
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
		}

		const uvFrame = document.getElementById("uv-frame");
		uvFrame.style.display = "none";
		uvFrame.src = "";

		// Remove old SJ frame and create fresh — this is how Scramjet is designed
		const oldSjFrame = document.getElementById("sj-frame");
		if (oldSjFrame) oldSjFrame.remove();

		const sjFrameWrapper = scramjet.createFrame();
		sjFrameWrapper.frame.id = "sj-frame";
		document.body.appendChild(sjFrameWrapper.frame);
		sjFrameWrapper.go(url);

		// SJ never fires uvFrame.load so handle show/hide manually
		if (typeof hideHome === "function") hideHome();
		const consoleBar = document.getElementById("browser-console");
		if (consoleBar) {
			consoleBar.style.display = "block";
			consoleBar.classList.remove("active");
		}
	}
});
