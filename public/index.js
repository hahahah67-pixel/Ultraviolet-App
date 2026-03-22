"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form = document.getElementById("uv-form");
const address = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error = document.getElementById("uv-error");
const errorCode = document.getElementById("uv-error-code");
const dotUV = document.getElementById("dot-uv");
const dotSJ = document.getElementById("dot-sj");
const proxyPicker = document.getElementById("proxy-picker");

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
let activeProxy = localStorage.getItem("proxy-choice") || "sj";

function setProxy(name) {
	activeProxy = name;
	localStorage.setItem("proxy-choice", name);
	dotUV.classList.toggle("active", name === "uv");
	dotSJ.classList.toggle("active", name === "sj");
}

setProxy(activeProxy);

dotUV.addEventListener("click", () => setProxy("uv"));
dotSJ.addEventListener("click", () => setProxy("sj"));

// ── Proxy picker visibility — only show on home page ─────────────────────────
function showPicker() {
	proxyPicker.style.display = "flex";
}

function hidePicker() {
	proxyPicker.style.display = "none";
}

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

	const url = search(address.value, searchEngine.value);
	const wispUrl = getWispUrl();

	if (activeProxy === "uv") {
		// Ultraviolet: use Epoxy transport, load into static iframe
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}

		// Remove any existing SJ frame
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

		// Hide/clear UV frame
		const uvFrame = document.getElementById("uv-frame");
		uvFrame.style.display = "none";
		uvFrame.src = "";

		// Remove old SJ frame if present
		const oldSjFrame = document.getElementById("sj-frame");
		if (oldSjFrame) oldSjFrame.remove();

		// Create new SJ frame and navigate
		const sjFrameWrapper = scramjet.createFrame();
		sjFrameWrapper.frame.id = "sj-frame";
		document.body.appendChild(sjFrameWrapper.frame);
		sjFrameWrapper.go(url);
	}
});
