"use strict";

// ── DOM refs ─────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");

const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

const uvFrame      = document.getElementById("uv-frame");

// ── BareMux (UV only) ─────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

// ── Scramjet legacy loader ONLY ───────────────────────────
async function loadScramjet() {
	if (window.__scramjetLoaded) return;
	await import("/scram/scramjet.sync.js");
	window.__scramjetLoaded = true;
}

// ── ensure SJ iframe exists ───────────────────────────────
function getSJFrame() {
	let frame = document.getElementById("sj-frame");
	if (!frame) {
		frame = document.createElement("iframe");
		frame.id = "sj-frame";
		frame.style.width = "100%";
		frame.style.height = "100%";
		frame.style.border = "none";
		frame.style.position = "fixed";
		frame.style.inset = "0";
		document.body.appendChild(frame);
	}
	return frame;
}

// ── simple URL normalizer ─────────────────────────────────
function normalize(input, engine) {
	try {
		return new URL(input).href;
	} catch {
		return engine.replace("%s", encodeURIComponent(input));
	}
}

// ── FORM SUBMIT ───────────────────────────────────────────
form.addEventListener("submit", async (e) => {
	e.preventDefault();

	error.textContent = "";
	errorCode.textContent = "";

	const engineUrl =
		localStorage.getItem("fish-search-engine") ||
		searchEngine.value;

	const url = normalize(address.value, engineUrl);
	const proxy = localStorage.getItem("fish-proxy-choice") || "sj";

	// ── UV MODE ───────────────────────────────────────────
	if (proxy === "uv") {
		try {
			await registerSW();

			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [
					{ wisp: getWispUrl() }
				]);
			}

			uvFrame.style.display = "block";
			uvFrame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

		} catch (err) {
			error.textContent = "UV failed";
			errorCode.textContent = err.toString();
		}
		return;
	}

	// ── SCRAMJET LEGACY ONLY ───────────────────────────────
	try {
		await loadScramjet();

		const frame = getSJFrame();

		// IMPORTANT: hide UV frame if it was used before
		if (uvFrame) uvFrame.style.display = "none";

		// wait a frame so Scramjet is ready
		requestAnimationFrame(() => {
			if (!window.__scramjetNavigate) {
				error.textContent = "Scramjet not initialized";
				return;
			}

			window.__scramjetNavigate(frame, url);
		});

	} catch (err) {
		error.textContent = "Scramjet failed";
		errorCode.textContent = err.toString();
		console.error(err);
	}
});
