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

	// Look these up here — they live below the <script> tag in the HTML
	// so they don't exist yet when the file first loads at the top level.
	const dotUV      = document.getElementById("dot-uv");
	const dotSJ      = document.getElementById("dot-sj");
	const pickUV     = document.getElementById("pick-uv");
	const pickSJ     = document.getElementById("pick-sj");

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

// ── Form submit ───────────────────────────────────────────────────────────────
form.addEventListener("submit", async (event) => {
	event.preventDefault();

	error.textContent    = "";
	errorCode.textContent = "";

	try {
		await registerSW();
	} catch (err) {
		error.textContent    = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const url     = search(address.value, searchEngine.value);
	const wispUrl = getWispUrl();

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
	}
});
