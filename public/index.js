"use strict";

// ── DOM refs ────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

// ── bare mux ────────────────────────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

// ── legacy scramjet loader ───────────────────────────────────────────────────
async function loadScramjet() {
	if (!window.__scramjetLoaded) {
		await import("/scram/scramjet.sync.js");
		window.__scramjetLoaded = true;
	}
}

// ── Scramjet frame helper (stable) ───────────────────────────────────────────
function getOrCreateSJFrame() {
	let frame = document.getElementById("sj-frame");

	if (!frame) {
		frame = document.createElement("iframe");
		frame.id = "sj-frame";
		document.body.appendChild(frame);
	}

	return frame;
}

// ── form submit ──────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
	e.preventDefault();

	error.textContent = "";
	errorCode.textContent = "";

	await registerSW();

	const engineUrl = localStorage.getItem("fish-search-engine") || searchEngine.value;
	const url = search(address.value, engineUrl);

	const proxy = localStorage.getItem("fish-proxy-choice") || "sj";

	// ── UV MODE ──────────────────────────────────────────────────────────────
	if (proxy === "uv") {
		if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [
				{ wisp: getWispUrl() }
			]);
		}

		const frame = document.getElementById("uv-frame");
		frame.style.display = "block";
		frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

		return;
	}

	// ── SCRAMJET LEGACY MODE ────────────────────────────────────────────────
	try {
		await loadScramjet();

		const frame = getOrCreateSJFrame();

		if (typeof window.__scramjetNavigate !== "function") {
			throw new Error("Scramjet legacy runtime not initialized");
		}

		window.__scramjetNavigate(frame, url);

	} catch (err) {
		error.textContent = "Scramjet failed";
		errorCode.textContent = err.toString();
		console.error(err);
	}
});
