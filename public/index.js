"use strict";

// ── DOM refs ────────────────────────────────────────────────────────────────
const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

// ── BareMux ────────────────────────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

// ── Scramjet loader (LEGACY SAFE) ───────────────────────────────────────────
async function loadScramjet() {
	if (!window.__scramjetLoaded) {
		await import("/scram/scramjet.sync.js");
		window.__scramjetLoaded = true;
	}

	// wait for runtime to actually exist (prevents black screen race)
	for (let i = 0; i < 60; i++) {
		if (typeof window.__scramjetNavigate === "function") return;
		await new Promise(r => setTimeout(r, 50));
	}

	throw new Error("Scramjet failed to initialize (legacy runtime missing)");
}

// ── helper: get / create SJ frame ───────────────────────────────────────────
function getScramjetFrame() {
	let frame = document.getElementById("sj-frame");

	if (!frame) {
		frame = document.createElement("iframe");
		frame.id = "sj-frame";
		frame.style.width = "100%";
		frame.style.height = "100%";
		frame.style.border = "none";
		frame.style.position = "fixed";
		frame.style.top = "0";
		frame.style.left = "0";
		frame.style.zIndex = "9999";
		document.body.appendChild(frame);
	}

	return frame;
}

// ── form submit ─────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
	e.preventDefault();

	error.textContent = "";
	errorCode.textContent = "";

	await registerSW();

	const engineUrl = localStorage.getItem("fish-search-engine") || searchEngine.value;
	const url = search(address.value, engineUrl);

	const proxy = localStorage.getItem("fish-proxy-choice") || "sj";

	// ─────────────────────────────────────────────
	// UV MODE
	// ─────────────────────────────────────────────
	if (proxy === "uv") {
		try {
			if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
				await connection.setTransport("/epoxy/index.mjs", [
					{ wisp: getWispUrl() }
				]);
			}

			const frame = document.getElementById("uv-frame");
			frame.style.display = "block";
			frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);

		} catch (err) {
			error.textContent = "UV error";
			errorCode.textContent = err.toString();
			console.error(err);
		}

		return;
	}

	// ─────────────────────────────────────────────
	// LEGACY SCRAMJET MODE (FIXED)
	// ─────────────────────────────────────────────
	try {
		const frame = getScramjetFrame();

		frame.style.display = "block";
		frame.src = "about:blank";

		await loadScramjet();

		// small delay ensures runtime hooks attach
		setTimeout(() => {
			try {
				window.__scramjetNavigate(frame, url);
			} catch (e) {
				error.textContent = "Scramjet navigation failed";
				errorCode.textContent = e.toString();
				console.error(e);
			}
		}, 120);

	} catch (err) {
		error.textContent = "Scramjet failed (init)";
		errorCode.textContent = err.toString();
		console.error(err);
	}
});
