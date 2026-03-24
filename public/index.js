"use strict";

// ── DOM refs ────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");
const uvFrame      = document.getElementById("uv-frame");
const consoleBar   = document.getElementById("browser-console");

// ── bare-mux connection ─────────────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

// ── Scramjet controller ─────────────────────────────────────────────────────
const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all:  "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

scramjet.init();

// ── Persistent SJ frame ─────────────────────────────────────────────────────
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

// ── Proxy state ─────────────────────────────────────────────────────────────
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
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function getWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/"
	);
}

function getActiveFrame() {
	const sj = document.getElementById("sj-frame");
	if (sj && sj.style.display !== "none") return sj;
	return uvFrame;
}

// ── Console visibility ──────────────────────────────────────────────────────
function updateConsoleVisibility() {
	const sj = document.getElementById("sj-frame");
	const usingSJ = sj && sj.style.display !== "none";

	const usingUV = uvFrame &&
		uvFrame.style.display !== "none" &&
		uvFrame.src !== "about:blank";

	if (usingSJ || usingUV) {
		consoleBar.style.display = "block";
	} else {
		consoleBar.style.display = "none";
	}
}

// ── Service worker ──────────────────────────────────────────────────────────
let swRegistered = false;

async function ensureSW() {
	if (swRegistered) return;
	await registerSW();
	swRegistered = true;
}

// ── Prewarm ─────────────────────────────────────────────────────────────────
(async () => {
	try {
		await ensureSW();
		const wispUrl = getWispUrl();

		if (activeProxy === "uv") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		} else {
			await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
			getSjFrame();
		}
	} catch(e) {
		console.warn("Prewarm failed:", e);
	}
})();

// ── Mutation observer (FIXED) ───────────────────────────────────────────────
let lastSJState = false;

new MutationObserver(() => {
	const sj = document.getElementById("sj-frame");
	const isActive = sj && sj.style.display !== "none";

	if (isActive !== lastSJState) {
		lastSJState = isActive;

		const proxyPicker = document.getElementById("proxy-picker");
		const homeCenter  = document.getElementById("home-center");

		if (isActive) {
			if (proxyPicker) proxyPicker.classList.add("hidden");
			if (homeCenter) homeCenter.classList.add("hidden");
		} else {
			if (proxyPicker) proxyPicker.classList.remove("hidden");
			if (homeCenter) homeCenter.classList.remove("hidden");
		}
	}

	updateConsoleVisibility();
}).observe(document.body, { attributes: true, subtree: true });

// ── Submit ──────────────────────────────────────────────────────────────────
let isSubmitting = false;

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (isSubmitting) return;
	isSubmitting = true;

	error.textContent     = "";
	errorCode.textContent = "";

	const proxyPicker = document.getElementById("proxy-picker");
	if (proxyPicker) proxyPicker.classList.add("hidden");

	try {
		await ensureSW();
	} catch (err) {
		error.textContent = "SW failed.";
		errorCode.textContent = err.toString();
		isSubmitting = false;
		return;
	}

	const url     = search(address.value, searchEngine.value);
	const wispUrl = getWispUrl();

	try {
		if (activeProxy === "uv") {
			const sj = getSjFrame();
			sj.frame.style.display = "none";

			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
			}

			uvFrame.style.display = "block";
			uvFrame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

		} else {
			uvFrame.style.display = "none";
			uvFrame.src = "about:blank";

			if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
				await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
			}

			const sj = getSjFrame();
			sj.frame.style.display = "block";
			sj.go(url);

			// IMPORTANT: prevent freeze
			setTimeout(() => {
				try { sj.frame.contentWindow.focus(); } catch(e) {}
			}, 100);
		}
	} finally {
		isSubmitting = false;
	}
});
