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
const gameLoader   = document.getElementById("game-loader");
const glBg         = document.getElementById("gl-bg");
const glIcon       = document.getElementById("gl-icon");
const glTitle      = document.getElementById("gl-title");
const glEngine     = document.getElementById("gl-engine");
const gamesCount       = document.getElementById("games-count");
const gamesDiceBtn     = document.getElementById("games-dice-btn");

// ── Dice state ────────────────────────────────────────────────────────────────
// Cycles: all games → random pick → all games → random pick ...
let diceMode = "all"; // "all" or "random"
let randomGame = null;

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
			.filter(g => g.id && g.url);
	} catch (e) {
		console.warn("Failed to load games.txt:", e);
		games = [];
	}
}

// SJ is now handled via Controller API (controller.api.js) — see getSJGameFrame() below.

// ── Proxy helpers ─────────────────────────────────────────────────────────────
// bare-mux connection — UV only. SJ no longer uses bare-mux in new architecture.
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
	return (location.protocol === "https:" ? "wss" : "ws") +
		"://" + location.host + "/wisp/";
}

// UV-only URL encoder
async function proxyUrlUV(rawUrl) {
	const wispUrl = getWispUrl();
	const current = await connection.getTransport();
	if (current !== "/epoxy/index.mjs") {
		await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
	}
	return __uv$config.prefix + __uv$config.encodeUrl(rawUrl);
}

// ── SJ Game Frame ─────────────────────────────────────────────────────────────
// Singleton Controller + Frame wrapping #game-frame for SJ-proxied games.
// $scramjetController is set globally by controller.api.js in math.html.
let _sjCtrl      = null;
let _sjGameFrame = null;

// ── Get the SW controlling this page — the exact object Controller needs ──────
async function getActiveSW() {
	if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
	return new Promise((resolve) => {
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			resolve(navigator.serviceWorker.controller);
		}, { once: true });
	});
}

async function getSJGameFrame() {
	if (_sjGameFrame) return _sjGameFrame;

	// Get the ServiceWorker controlling this page — what Controller expects
	const sw = await getActiveSW();
	if (!sw) throw new Error("[Fish/SJ] No controlling service worker found");

	// LibcurlClient imported from the existing /libcurl/index.mjs
	const { default: LibcurlClient } = await import("/libcurl/index.mjs");
	const transport = new LibcurlClient({ wisp: getWispUrl() });
	await transport.init();

	// Controller config points to new split files in /scram/
	_sjCtrl = new $scramjetController.Controller({
		serviceworker: sw,
		transport,
		config: {
			scramjetPath: "/scram/scramjet.js",
			injectPath:   "/scram/controller.inject.js",
			wasmPath:     "/scram/scramjet.wasm",
		},
	});

	await _sjCtrl.wait();

	// Wrap the existing #game-frame element — frame.go() will set its src directly
	_sjGameFrame = _sjCtrl.createFrame(gameFrame);
	return _sjGameFrame;
}

// ── Render grid ───────────────────────────────────────────────────────────────
function updateCount(shown) {
	const total = games.length;
	const q = gameSearch.value.trim();
	if (!q && shown === total) {
		gamesCount.textContent = "All Games: " + total;
	} else {
		gamesCount.textContent = "Games " + shown + " out of " + total;
	}
}

function renderGrid(list) {
	gameGrid.innerHTML = "";
	noResults.style.display = list.length === 0 ? "block" : "none";
	updateCount(list.length);

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
	diceMode = "all"; // reset dice when searching
	if (!q) { renderGrid(games); return; }
	renderGrid(games.filter(g => g.terms.some(t => t.includes(q))));
}

gameSearch.addEventListener("input",   () => doSearch(gameSearch.value));
gameSearch.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(gameSearch.value); });

// ── Open game ─────────────────────────────────────────────────────────────────
async function openGame(id) {
	const g = games.find(g => g.id === id);
	if (!g) return;

	// ── Show game page + loader IMMEDIATELY on click ──────────────────────────
	// Must happen before any awaits so user sees the loader straight away.
	// URL resolution (which can take seconds for SJ controller) runs after.
	const proxy       = localStorage.getItem("fish-proxy-choice") || "sj";
	const engineLabel = proxy === "uv" ? "Ultraviolet" : "Scramjet";
	const iconSrc     = g.logo || "";

	glBg.style.backgroundImage = iconSrc ? `url(${iconSrc})` : "none";
	glIcon.src                 = iconSrc;
	glIcon.style.display       = iconSrc ? "block" : "none";
	glTitle.textContent        = g.display || g.id;
	glEngine.textContent       = engineLabel;

	gamesPage.style.display = "none";
	gamePage.classList.add("active");
	gameLoader.classList.add("active");
	gameFrame.style.opacity = "0";
	gameFrame.src = "about:blank";

	const loaderShownAt = Date.now();

	// ── Register SW and resolve proxy URL while loader is already visible ─────
	try { await registerSW(); } catch(e) { console.warn("SW reg:", e); }

	let frameSrc;
	if (g.url.startsWith("http") && proxy !== "uv") {
		// ── Scramjet: Controller frame handles encoding + navigation ─────────────
		try {
			const sjf = await getSJGameFrame();
			const elapsed   = Date.now() - loaderShownAt;
			const remaining = Math.max(0, 1500 - elapsed);
			setTimeout(() => {
				gameLoader.classList.remove("active");
				gameFrame.style.opacity = "";
				sjf.go(g.url); // encodes URL and sets gameFrame.src internally
			}, remaining);
		} catch(e) {
			console.error("[Fish/SJ] getSJGameFrame failed:", e);
			gameLoader.classList.remove("active");
			gameFrame.style.opacity = "";
		}
		history.pushState({ game: id }, "", `/math?game=${id}`);
		return; // early return — no frameSrc needed for SJ http
	} else if (g.url.startsWith("http")) {
		// ── UV: encode URL via bare-mux + epoxy ──────────────────────────────────
		frameSrc = await proxyUrlUV(g.url);
	} else if (g.url.startsWith("emu:")) {
		// Format in games.txt: emu:core:romfilename.ext
		// ROM file goes in: public/game files/emu games/
		const parts = g.url.split(":");
		const core  = parts[1];
		const rom   = parts.slice(2).join(":");
		frameSrc = `/game%20files/emulator.html?core=${encodeURIComponent(core)}&rom=/game%20files/emu%20games/${encodeURIComponent(rom)}`;
	} else if (g.url.startsWith("flash:")) {
		// Format in games.txt: flash:filename.swf
		// SWF file goes in: public/game files/swf/
		const swf = g.url.slice(6);
		frameSrc = `/game%20files/ruffle-player.html?swf=/game%20files/swf/${encodeURIComponent(swf)}`;
	} else {
		frameSrc = "/game%20files/" + g.url.split("/").map(encodeURIComponent).join("/");
	}

	// ── Show loader for at least 1.5s, then load game ─────────────────────────
	// If resolution already took longer than 1.5s, load immediately.
	const elapsed   = Date.now() - loaderShownAt;
	const remaining = Math.max(0, 1500 - elapsed);
	setTimeout(() => {
		gameLoader.classList.remove("active");
		gameFrame.style.opacity = "";
		gameFrame.src = frameSrc;
	}, remaining);

	history.pushState({ game: id }, "", `/math?game=${id}`);
}

// ── Back ──────────────────────────────────────────────────────────────────────
gameBack.addEventListener("click", () => {
	gameFrame.src = "about:blank";
	gameFrame.style.opacity = "";
	gameLoader.classList.remove("active");
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
	const proxy = localStorage.getItem("fish-proxy-choice") || "sj";
	if (proxy === "sj" && _sjGameFrame) {
		_sjGameFrame.reload(); // uses Frame.reload() → contentWindow.location.reload()
	} else {
		try { gameFrame.contentWindow.location.reload(); }
		catch(e) { gameFrame.src = gameFrame.src; }
	}
});

// ── Handle ?game= on load ─────────────────────────────────────────────────────
async function checkUrlParam() {
	const id = new URLSearchParams(location.search).get("game");
	if (id) await openGame(id);
}

// ── Dice button ───────────────────────────────────────────────────────────────
if (gamesDiceBtn) {
	gamesDiceBtn.addEventListener("click", () => {
		if (games.length === 0) return;

		// Animate the button
		gamesDiceBtn.style.transition = "transform 0.15s ease";
		gamesDiceBtn.style.transform = "scale(1.3) rotate(20deg)";
		setTimeout(() => {
			gamesDiceBtn.style.transform = "scale(1) rotate(0deg)";
		}, 200);
		setTimeout(() => {
			gamesDiceBtn.style.transform = "scale(1.15)";
		}, 200);
		setTimeout(() => {
			gamesDiceBtn.style.transform = "scale(1)";
		}, 350);

		if (diceMode === "all") {
			// Pick a random game and show only it
			const idx = Math.floor(Math.random() * games.length);
			randomGame = games[idx];
			gameSearch.value = ""; // clear search
			renderGrid([randomGame]);
			gamesCount.textContent = "🎲 Random: " + randomGame.display;
			diceMode = "random";
		} else {
			// Show all games again
			renderGrid(games);
			diceMode = "all";
		}
	});
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
	await loadGames();
	renderGrid(games);
	await checkUrlParam();
})();
