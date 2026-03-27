"use strict";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const gamesPage        = document.getElementById("games-page");
const gamePage         = document.getElementById("game-page");
const gameGrid         = document.getElementById("game-grid");
const gameSearch       = document.getElementById("game-search");
const noResults        = document.getElementById("no-results");
const gameFrame        = document.getElementById("game-frame");
const gameBack         = document.getElementById("game-back");
const btnFullscreen    = document.getElementById("btn-fullscreen");
const btnReload        = document.getElementById("btn-reload");
const gameFrameWrapper = document.getElementById("game-frame-wrapper");

// ── Game registry — loaded entirely from games.txt ────────────────────────────
// Format: id|Display Name|URL|logo filename|search term|search term|...
// Lines starting with # are ignored (comments / unfilled placeholders).
let games = [];

async function loadGames() {
	try {
		const res  = await fetch("/games.txt");
		const text = await res.text();
		games = text.trim().split("\n")
			.filter(line => line.trim() && !line.startsWith("#"))
			.map(line => {
				const parts = line.split("|");
				return {
					id:      parts[0].trim(),
					display: parts[1].trim(),
					url:     parts[2].trim(),
					logo:    "images/game%20icons/" + encodeURIComponent(parts[3].trim()),
					terms:   parts.slice(1).map(t => t.trim().toLowerCase())
				};
			})
			.filter(g => g.id && g.url && g.url.startsWith("http"));
	} catch (e) {
		console.warn("Failed to load games.txt:", e);
		games = [];
	}
}

// ── Wait for scramjet controller to be ready ─────────────────────────────────
// math.html inits the controller async — we must wait before encoding URLs.
async function waitForSJController(timeoutMs = 8000) {
	const start = Date.now();
	while (!window.__scramjetController) {
		if (Date.now() - start > timeoutMs) {
			console.warn("SJ controller timed out, proceeding without it");
			return false;
		}
		await new Promise(r => setTimeout(r, 50));
	}
	return true;
}

// ── Proxy helpers ─────────────────────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

async function proxyUrl(rawUrl) {
	const proxy   = localStorage.getItem("proxy-choice") || "sj";
	const wispUrl = getWispUrl();

	if (proxy === "uv") {
		// Make sure UV transport is set
		const current = await connection.getTransport();
		if (current !== "/epoxy/index.mjs") {
			await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
		}
		// __uv$config is set synchronously by uv.config.js so always available
		return __uv$config.prefix + __uv$config.encodeUrl(rawUrl);

	} else {
		// Make sure SJ transport is set
		const current = await connection.getTransport();
		if (current !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
		}
		// Wait for controller to be ready before encoding
		const ready = await waitForSJController();
		if (ready && window.__scramjetController) {
			return window.__scramjetController.encodeUrl(rawUrl);
		}
		// Fallback — load raw (won't be proxied but won't crash)
		console.warn("SJ controller not ready, loading raw URL");
		return rawUrl;
	}
}

// ── Render grid ───────────────────────────────────────────────────────────────
function renderGrid(list) {
	gameGrid.innerHTML = "";
	noResults.style.display = list.length === 0 ? "block" : "none";

	list.forEach(g => {
		const card = document.createElement("div");
		card.className = "game-card";

		const img = document.createElement("img");
		img.src = g.logo;
		img.alt = g.display;

		const name = document.createElement("div");
		name.className = "game-name";
		name.textContent = g.display;

		card.appendChild(img);
		card.appendChild(name);
		card.addEventListener("click", () => openGame(g.id));
		gameGrid.appendChild(card);
	});
}

// ── Search ────────────────────────────────────────────────────────────────────
function doSearch(query) {
	const q = query.trim().toLowerCase();
	if (!q) { renderGrid(games); return; }
	renderGrid(games.filter(g => g.terms.some(t => t.includes(q))));
}

gameSearch.addEventListener("input",   () => doSearch(gameSearch.value));
gameSearch.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(gameSearch.value); });

// ── Open game ─────────────────────────────────────────────────────────────────
async function openGame(id) {
	const g = games.find(g => g.id === id);
	if (!g) return;

	try { await registerSW(); } catch(e) { console.warn("SW reg:", e); }

	const proxied = await proxyUrl(g.url);

	gamesPage.style.display = "none";
	gamePage.classList.add("active");
	gameFrame.src = proxied;

	history.pushState({ game: id }, "", `/math?game=${id}`);
}

// ── Back ──────────────────────────────────────────────────────────────────────
gameBack.addEventListener("click", () => {
	gameFrame.src = "about:blank";
	gamePage.classList.remove("active");
	gamesPage.style.display = "flex";
	history.pushState({}, "", "/math");
});

// ── Controls ──────────────────────────────────────────────────────────────────
btnFullscreen.addEventListener("click", () => {
	if (gameFrameWrapper.requestFullscreen) gameFrameWrapper.requestFullscreen();
	else if (gameFrameWrapper.webkitRequestFullscreen) gameFrameWrapper.webkitRequestFullscreen();
});

btnReload.addEventListener("click", () => {
	try { gameFrame.contentWindow.location.reload(); }
	catch(e) { gameFrame.src = gameFrame.src; }
});

// ── Handle ?game= on load ─────────────────────────────────────────────────────
async function checkUrlParam() {
	const id = new URLSearchParams(location.search).get("game");
	if (id) await openGame(id);
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
	await loadGames();
	renderGrid(games);
	await checkUrlParam();
})();
