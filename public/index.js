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

// Run after DOM is fully ready so picker elements exist
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

// ── Submit guard — prevents double-fire during async transport switch ─────────
let isSubmitting = false;

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (event) => {
	event.preventDefault();

	// Block re-entry while a submit is already in flight
	if (isSubmitting) return;
	isSubmitting = true;

	error.textContent     = "";
	errorCode.textContent = "";

	// ── Hide picker immediately — don't wait for frame load ──────────────────
	const proxyPicker = document.getElementById("proxy-picker");
	if (proxyPicker) proxyPicker.classList.add("hidden");

	try {
		await registerSW();
	} catch (err) {
		error.textContent     = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		isSubmitting = false;
		return;
	}

	const url     = search(address.value, searchEngine.value);
	const wispUrl = getWispUrl();

	try {
		if (activeProxy === "uv") {
			// ── Ultraviolet ───────────────────────────────────────────────────
			// Tear down SJ frame first before touching transport
			const sjFrame = document.getElementById("sj-frame");
			if (sjFrame) sjFrame.remove();

			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
			}

			const frame = document.getElementById("uv-frame");
			frame.style.display = "block";
			frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

		} else {
			// ── Scramjet ──────────────────────────────────────────────────────
			// Tear down UV frame first before touching transport
			const uvFrame = document.getElementById("uv-frame");
			uvFrame.style.display = "none";
			uvFrame.src = "";

			if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
				await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
			}

			const oldSjFrame = document.getElementById("sj-frame");
			if (oldSjFrame) oldSjFrame.remove();

			const sjFrameWrapper = scramjet.createFrame();
			sjFrameWrapper.frame.id = "sj-frame";
			document.body.appendChild(sjFrameWrapper.frame);
			sjFrameWrapper.go(url);
		}
	} finally {
		// Always release the guard when done, success or failure
		isSubmitting = false;
	}
});
