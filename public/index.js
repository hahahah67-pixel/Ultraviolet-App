"use strict";

const form         = document.getElementById("uv-form");
const address      = document.getElementById("uv-address");
const searchEngine = document.getElementById("uv-search-engine");
const uvFrame      = document.getElementById("uv-frame");
const error        = document.getElementById("uv-error");
const errorCode    = document.getElementById("uv-error-code");

function safe(el, fn) {
	if (el) fn(el);
}

// ── BareMux (UV only) ──
const connection = window.BareMux
	? new BareMux.BareMuxConnection("/baremux/worker.js")
	: null;

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

function normalize(input, engine) {
	try {
		return new URL(input).href;
	} catch {
		return engine.replace("%s", encodeURIComponent(input));
	}
}

// ── Scramjet legacy loader ──
async function loadScramjet() {
	if (window.__scramjetLoaded) return;
	await import("/scram/scramjet.sync.js");
	window.__scramjetLoaded = true;
}

// ── SJ frame getter ──
function getSJFrame() {
	let frame = document.getElementById("sj-frame");
	if (!frame) {
		frame = document.createElement("iframe");
		frame.id = "sj-frame";
		frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:none;";
		document.body.appendChild(frame);
	}
	return frame;
}

// ── Submit ──
if (form) {
	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		safe(error, el => el.textContent = "");
		safe(errorCode, el => el.textContent = "");

		const engine =
			localStorage.getItem("fish-search-engine") ||
			(searchEngine ? searchEngine.value : "https://duckduckgo.com/?q=%s");

		const url = normalize(address.value, engine);
		const mode = localStorage.getItem("fish-proxy-choice") || "sj";

		// ── UV MODE ──
		if (mode === "uv") {
			try {
				await registerSW?.();

				if (connection) {
					if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
						await connection.setTransport("/epoxy/index.mjs", [
							{ wisp: getWispUrl() }
						]);
					}
				}

				if (uvFrame) {
					uvFrame.style.display = "block";
					uvFrame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
				}

			} catch (err) {
				safe(error, el => el.textContent = "UV failed");
				safe(errorCode, el => el.textContent = String(err));
			}
			return;
		}

		// ── SCRAMJET LEGACY ONLY ──
		try {
			await loadScramjet();

			const frame = getSJFrame();

			if (uvFrame) uvFrame.style.display = "none";

			requestAnimationFrame(() => {
				if (window.__scramjetNavigate) {
					window.__scramjetNavigate(frame, url);
				}
			});

		} catch (err) {
			safe(error, el => el.textContent = "Scramjet failed");
			safe(errorCode, el => el.textContent = String(err));
		}
	});
}
