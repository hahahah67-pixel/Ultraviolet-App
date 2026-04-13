"use strict";

// ── DOM refs (using stock UV element IDs) ─────────────────────────────────────
const form = document.getElementById("uv-form");
const address = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error = document.getElementById("uv-error");
const errorCode = document.getElementById("uv-error-code");

// ── bare-mux connection (shared by both proxies) ──────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// ── Scramjet controller ───────────────────────────────────────────────────────
const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

// ── Proxy toggle state ────────────────────────────────────────────────────────
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

	const engineUrl = localStorage.getItem("fish-search-engine") || searchEngine.value;
	const url = search(address.value, engineUrl);
	const wispUrl = getWispUrl();

	// Send domain to analytics — only track direct site visits, not search queries
	try {
		const _rawInput = address.value.trim();
		// Only track if user typed a URL directly (not a search term)
		// search() returns a search engine URL for plain text queries
		// We detect direct URLs by checking if the raw input parses as a URL
		let _trackDomain = null;
		try {
			const _parsed = new URL(_rawInput.startsWith("http") ? _rawInput : "https://" + _rawInput);
			if (_parsed.hostname.includes(".")) _trackDomain = _parsed.hostname.replace(/^www\./, "");
		} catch(e) {}
		if (_trackDomain) {
			fetch("/api/domain", {
				method: "POST",
				headers: {"Content-Type":"application/json"},
				body: JSON.stringify({ domain: _trackDomain })
			}).catch(() => {});
		}
	} catch(e) {}

	if (activeProxy === "uv") {
		// Ultraviolet: use Epoxy transport, load into static iframe
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}

		const sjFrame = document.getElementById("sj-frame");
		if (sjFrame) sjFrame.remove();

		let frame = document.getElementById("uv-frame");
		frame.style.display = "block";
		frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
	} else {
		// Scramjet: use libcurl transport, create SJ frame dynamically
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
		}

		const uvFrame = document.getElementById("uv-frame");
		uvFrame.style.display = "none";
		uvFrame.src = "";

		const oldSjFrame = document.getElementById("sj-frame");
		if (oldSjFrame) oldSjFrame.remove();

		const sjFrameWrapper = scramjet.createFrame();
		sjFrameWrapper.frame.id = "sj-frame";
		document.body.appendChild(sjFrameWrapper.frame);
		sjFrameWrapper.go(url);

		// SJ never fires uvFrame.load — handle home hide + console manually
		if (typeof hideHome === "function") hideHome();
		const _bar = document.getElementById("browser-console");
		if (_bar) { _bar.style.display = "block"; _bar.classList.remove("active"); }
	}
});
