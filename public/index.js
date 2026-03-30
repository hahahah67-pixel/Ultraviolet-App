"use strict";

// ── DOM refs ────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

// ── bare-mux connection ─────────────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function ensureTransport(type, config) {
	try {
		const current = await connection.getTransport();
		if (current !== type) {
			await connection.setTransport(type, config);
			await new Promise(r => setTimeout(r, 60));
		}
	} catch (e) {
		console.warn("Transport error:", e);
	}
}

// ── Scramjet — LAZY loaded, only when SJ is actually used ───────────────────
// Do NOT init SJ on page load if UV is the active proxy.
// SJ's WASM init steals CPU/memory that hurts UV performance.
let scramjet      = null;
let sjReady       = false;
let sjInitPromise = null;

function getSjController() {
	if (scramjet) return scramjet;
	const { ScramjetController } = $scramjetLoadController();
	scramjet = new ScramjetController({
		files: {
			wasm: "/scram/scramjet.wasm.wasm",
			all:  "/scram/scramjet.all.js",
			sync: "/scram/scramjet.sync.js",
		},
	});
	return scramjet;
}

async function initSJ() {
	// Only init once — return existing promise if already in progress
	if (sjInitPromise) return sjInitPromise;
	sjInitPromise = (async () => {
		try {
			getSjController();
			await scramjet.init();
			sjReady = true;
		} catch (e) {
			console.warn("Scramjet init failed:", e);
			sjReady = true; // proceed anyway
		}
	})();
	return sjInitPromise;
}

// ── Persistent SJ frame ─────────────────────────────────────────────────────
let sjFrameWrapper = null;
let sjNavCount     = 0;

function getSjFrame() {
	if (!sjFrameWrapper) {
		const ctrl = getSjController();
		sjFrameWrapper = ctrl.createFrame();
		sjFrameWrapper.frame.id = "sj-frame";
		sjFrameWrapper.frame.style.display = "none";
		document.body.appendChild(sjFrameWrapper.frame);
	}
	return sjFrameWrapper;
}

function resetSjFrameIfNeeded() {
	sjNavCount++;
	if (sjNavCount >= 5) {
		if (sjFrameWrapper?.frame) {
			sjFrameWrapper.frame.src = "about:blank";
		}
		const oldFrame = sjFrameWrapper?.frame;
		sjFrameWrapper = getSjController().createFrame();
		if (oldFrame) sjFrameWrapper.frame = oldFrame;
		sjNavCount = 0;
	}
}

// ── Proxy toggle ────────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function getWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/"
	);
}

let swRegistered = false;

async function ensureSW() {
	if (swRegistered) return;
	await registerSW();
	swRegistered = true;
}

// ── Hard engine isolation ────────────────────────────────────────────────────
function resetUVFrame() {
	const uvFrame = document.getElementById("uv-frame");
	if (uvFrame) {
		uvFrame.src = "about:blank";
		uvFrame.style.display = "none";
	}
}

function resetSJFrame() {
	if (sjFrameWrapper?.frame) {
		sjFrameWrapper.frame.src = "about:blank";
		sjFrameWrapper.frame.style.display = "none";
	}
}

// ── Pre-warm — only warm up the active proxy, leave the other alone ──────────
(async () => {
	try {
		await ensureSW();
		const wispUrl = getWispUrl();
		const proxy   = localStorage.getItem("proxy-choice") || "sj";

		if (proxy === "uv") {
			// UV selected — just warm up epoxy transport, do NOT touch SJ at all
			await ensureTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		} else {
			// SJ selected — init SJ and warm up libcurl transport
			await initSJ();
			await ensureTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
			getSjFrame(); // pre-create frame so first nav is instant
		}
	} catch(e) {
		console.warn("Pre-warm failed:", e);
	}
})();

// ── Submit guard ─────────────────────────────────────────────────────────────
let isSubmitting = false;

// ── SJ navigation ────────────────────────────────────────────────────────────
function sjNavigate(sj, url) {
	try {
		sj.go(url);
	} catch (e) {
		console.warn("SJ go error:", e);
	}
}

// ── Form submit ──────────────────────────────────────────────────────────────
if (form) {
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (isSubmitting) return;
		isSubmitting = true;

		if (error)     error.textContent     = "";
		if (errorCode) errorCode.textContent = "";

		const proxyPicker = document.getElementById("proxy-picker");
		if (proxyPicker) proxyPicker.classList.add("hidden");

		try {
			await ensureSW();
		} catch (err) {
			if (error)     error.textContent     = "Failed to register service worker.";
			if (errorCode) errorCode.textContent = err.toString();
			isSubmitting = false;
			return;
		}

		const url     = search(address.value, searchEngine.value);
		const wispUrl = getWispUrl();
		const uvFrame = document.getElementById("uv-frame");

		try {
			if (activeProxy === "uv") {
				// ── UV path — clean and fast, SJ not touched at all ──────────
				resetSJFrame();
				await ensureTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);

				if (uvFrame) {
					uvFrame.style.display = "block";
					uvFrame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
				}

			} else {
				// ── SJ path — init lazily if not done yet ────────────────────
				resetUVFrame();

				// Init SJ now if it hasn't been yet (user started on UV, switched to SJ)
				await initSJ();
				await ensureTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);

				// Wait for SJ ready with timeout
				const sjReadyStart = Date.now();
				while (!sjReady) {
					if (Date.now() - sjReadyStart > 5000) {
						console.warn("SJ init timed out, proceeding anyway");
						break;
					}
					await new Promise(r => setTimeout(r, 50));
				}

				resetSjFrameIfNeeded();

				const sj = getSjFrame();
				sj.frame.style.display = "block";
				sjNavigate(sj, url);

				const homeCenter = document.getElementById("home-center");
				const consoleBar = document.getElementById("browser-console");

				if (homeCenter) homeCenter.classList.add("hidden");
				if (consoleBar) {
					consoleBar.style.display = "block";
					consoleBar.classList.remove("active");
				}
			}
		} finally {
			isSubmitting = false;
		}
	});
}
