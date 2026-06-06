"use strict";

const gamesPage     = document.getElementById("games-page");
const gamePage      = document.getElementById("game-page");
const gameGrid      = document.getElementById("game-grid");
const gameSearch    = document.getElementById("game-search");
const gameFrame     = document.getElementById("game-frame");
const gameLoader    = document.getElementById("game-loader");
const gameBack      = document.getElementById("game-back");

let games = [];

// ── safe loader ──
async function loadGames() {
	try {
		const res = await fetch("/games.txt");
		const text = await res.text();

		games = text.split("\n")
			.filter(l => l && !l.startsWith("#"))
			.map(line => {
				const p = line.split("|");
				return {
					id: p[0]?.trim(),
					name: p[1]?.trim(),
					url: p[2]?.trim(),
					icon: "images/game%20icons/" + encodeURIComponent(p[3] || "")
				};
			})
			.filter(g => g.id && g.url);

		render(games);
	} catch (e) {
		console.warn("games failed", e);
	}
}

// ── render ──
function render(list) {
	if (!gameGrid) return;

	gameGrid.innerHTML = "";

	list.forEach(g => {
		const el = document.createElement("div");
		el.textContent = g.name || "game";
		el.onclick = () => openGame(g);
		gameGrid.appendChild(el);
	});
}

// ── Scramjet legacy only ──
async function loadScramjet() {
	if (window.__scramjetLoaded) return;
	await import("/scram/scramjet.sync.js");
	window.__scramjetLoaded = true;
}

// ── frame ──
function getFrame() {
	let f = document.getElementById("game-frame");
	if (!f) {
		f = document.createElement("iframe");
		f.id = "game-frame";
		document.body.appendChild(f);
	}
	return f;
}

// ── open game ──
async function openGame(g) {
	await loadScramjet();

	if (gamesPage) gamesPage.style.display = "none";
	if (gamePage) gamePage.classList.add("active");

	if (gameLoader) gameLoader.classList.add("active");

	const frame = getFrame();

	setTimeout(() => {
		gameLoader?.classList.remove("active");

		if (window.__scramjetNavigate) {
			window.__scramjetNavigate(frame, g.url);
		}
	}, 800);
}

// ── back ──
if (gameBack) {
	gameBack.onclick = () => {
		if (gamePage) gamePage.classList.remove("active");
		if (gamesPage) gamesPage.style.display = "flex";
		if (gameFrame) gameFrame.src = "about:blank";
	};
}

// ── search ──
if (gameSearch) {
	gameSearch.addEventListener("input", () => {
		const q = gameSearch.value.toLowerCase();
		render(games.filter(g => g.name?.toLowerCase().includes(q)));
	});
}

loadGames();
