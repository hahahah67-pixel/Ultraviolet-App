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

// ── Persistent SJ frame — created ONCE, never destroyed between navigations ───
// Destroying and recreating the SJ frame on every navigation causes black
// screens because the service worker loses its interception context. We create
// it once upfront, hide/show it as needed, and just call .go() for new URLs.
let sjFrameWrapper = null;

function getSjFrame() {
	if (!sjFrameWrapper) {
		sjFrameWrapper = scramjet.createFrame();
		sjFrameWrapper.frame.id = "sj-frame";
		sjFrameWrapper.frame.style.display = "none";
		document.body.appendChild(sjFrameWrapper.frame);
	}
	return sjFrameWrapper;
}

// ── Proxy toggle state ────────────────────────────────────────────────────────
let activeProxy = localStorage.getItem("proxy-choice") || "sj";

function setProxy(name) {
	activeProxy = name;
	localStorage.setItem("proxy-choice", name);

	const dotUV  = document.getElementById("dot-uv");
	const dotSJ  = document.getElementById("dot-sj");
	const pickUV = document.getElementById("pick-uv");
	const pickSJ = document.getElementById("pick-sj");

	if (dotUV)  dotUV.classList.toggle("active",  name === "uv");
	if (dotSJ)  dotSJ.classList.toggle("active",  name === "sj");
	if (pickUV) pickUV.classList.toggle("active", name === "uv");
	if (pickSJ) pickSJ.classList.toggle("active", name === "sj");
}

document.addEventListener("DOMContentLoaded", () => {
	setProxy(activeProxy);

	const dotUV  = document.getElementById("dot-uv");
	const dotSJ  = document.getElementById("dot-sj");
	const pickUV = document.getElementById("pick-uv");
	const pickSJ = document.getElementById("pick-sj");

	if (dotUV)  dotUV.addEventListener("click",  () => setProxy("uv"));
	if (dotSJ)  dotSJ.addEventListener("click",  () => setProxy("sj"));
	if (pickUV) pickUV.addEventListener("click", () => setProxy("uv"));
	if (pickSJ) pickSJ.addEventListener("click", () => setProxy("sj"));
});

// ── Wisp URL helper ───────────────────────────────────────────────────────────
function getWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/"
	);
}

// ── SW registered once flag ───────────────────────────────────────────────────
// Re-registering the SW on every submit can cause SJ's SW to reload and lose
// its config mid-session, causing black screens on subsequent navigations.
let swRegistered = false;

async function ensureSW() {
	if (swRegistered) return;
	await registerSW();
	swRegistered = true;
}

// ── Pre-warm transport on page load ───────────────────────────────────────────
// Set up the correct transport immediately so the first navigation doesn't
// have to wait for it to establish.
(async () => {
	try {
		await ensureSW();
		const wispUrl = getWispUrl();
		const proxy   = localStorage.getItem("proxy-choice") || "sj";
		if (proxy === "uv") {
			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
			}
		} else {
			if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
				await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
			}
			// Also pre-create the SJ frame so it's ready to go
			getSjFrame();
		}
	} catch(e) {
		console.warn("Pre-warm failed:", e);
	}
})();

// ── Submit guard — prevents double-fire during async transport switch ─────────
let isSubmitting = false;

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (event) => {
	event.preventDefault();

	if (isSubmitting) return;
	isSubmitting = true;

	error.textContent     = "";
	errorCode.textContent = "";

	// Hide picker immediately
	const proxyPicker = document.getElementById("proxy-picker");
	if (proxyPicker) proxyPicker.classList.add("hidden");

	try {
		await ensureSW();
	} catch (err) {
		error.textContent     = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		isSubmitting = false;
		return;
	}

	const url     = search(address.value, searchEngine.value);
	const wispUrl = getWispUrl();
	const uvFrame = document.getElementById("uv-frame");

	try {
		if (activeProxy === "uv") {
			// ── Ultraviolet ───────────────────────────────────────────────────
			// Hide SJ frame but DO NOT destroy it — just hide it
			const sj = getSjFrame();
			sj.frame.style.display = "none";

			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
			}

			uvFrame.style.display = "block";
			uvFrame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

		} else {
			// ── Scramjet ──────────────────────────────────────────────────────
			// Hide UV frame — use about:blank not "" to avoid accidental UV SW trigger
			uvFrame.style.display = "none";
			uvFrame.src = "about:blank";

			if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
				await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
			}

			// Reuse the persistent SJ frame — just navigate to the new URL
			const sj = getSjFrame();
			sj.frame.style.display = "block";
			sj.go(url);
		}
	} finally {
		isSubmitting = false;
	}
});
