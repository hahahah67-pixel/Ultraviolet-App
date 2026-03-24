"use strict";

// ── Game data ─────────────────────────────────────────────────────────────────
// id must match the key in GAME_URLS and the logo filename pattern
const GAME_URLS = {
  "bitlife":           "https://sz-games.github.io/games/game.html?game=https://sz-games.github.io/Games9/bitlife#goog_rewarded",
"crossy-road":       "https://azgames.io/crossy-road.embed",
  "escape-road":       "https://azgames.io/escape-road.embed",
  "escape-road-2":     "https://game.azgame.io/escape-road-2/",
  "escape-road-2-city":"https://game.azgame.io/escape-road-city-2/",
  "path-to-glory":     "https://pizzaedition.win/assets/allgames/pathtoglory/index.html",
  "subway-surfers":    "https://sz-games.github.io/games/game.html?game=https://dddavit.github.io/subway/"
};

const GAME_LOGOS = {
  "bitlife":            "images/game%20icons/Bit%20life%20logo.png",
  "crossy-road":        "images/game%20icons/Crossy%20road%20logo.png",
  "escape-road":        "images/game%20icons/escape%20road%20logo.png",
  "escape-road-2":      "images/game%20icons/escape%20road%202%20logo.png",
  "escape-road-2-city": "images/game%20icons/escape%20road%202%20city%20logo.png",
  "path-to-glory":      "images/game%20icons/path%20to%20glory%20logo.png",
  "subway-surfers":     "images/game%20icons/subway%20surfers%20logo.png"
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const gamesPage    = document.getElementById("games-page");
const gamePage     = document.getElementById("game-page");
const gameGrid     = document.getElementById("game-grid");
const gameSearch   = document.getElementById("game-search");
const noResults    = document.getElementById("no-results");
const gameFrame    = document.getElementById("game-frame");
const gameBack     = document.getElementById("game-back");
const btnFullscreen= document.getElementById("btn-fullscreen");
const btnReload    = document.getElementById("btn-reload");

// ── Search index — loaded from games.txt ─────────────────────────────────────
let searchIndex = []; // [ { id, display, terms[] } ]

async function loadSearchIndex() {
  try {
    const res  = await fetch("/games.txt");
    const text = await res.text();
    searchIndex = text.trim().split("\n").map(line => {
      const parts = line.split("|");
      return {
        id:      parts[0].trim(),
        display: parts[1].trim(),
        terms:   parts.slice(1).map(t => t.trim().toLowerCase())
      };
    });
  } catch (e) {
    // Fallback: build index from GAME_URLS keys if txt fails
    searchIndex = Object.keys(GAME_URLS).map(id => ({
      id,
      display: id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      terms:   [id.replace(/-/g, " ")]
    }));
  }
}

// ── Proxy helpers ─────────────────────────────────────────────────────────────
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function getWispUrl() {
  return (location.protocol === "https:" ? "wss" : "ws") +
    "://" + location.host + "/wisp/";
}

async function proxyUrl(rawUrl) {
  const proxy    = localStorage.getItem("proxy-choice") || "sj";
  const wispUrl  = getWispUrl();

  if (proxy === "uv") {
    if ((await connection.getTransport()) !== "/epoxy/index.mjs") {
      await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
    }
    return __uv$config.prefix + __uv$config.encodeUrl(rawUrl);
  } else {
    if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
      await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
    }
    // Scramjet encodes URLs differently — use the controller
    return window.__scramjetController
      ? window.__scramjetController.encodeUrl(rawUrl)
      : rawUrl;
  }
}

// ── Render game grid ──────────────────────────────────────────────────────────
function renderGrid(ids) {
  gameGrid.innerHTML = "";
  noResults.style.display = ids.length === 0 ? "block" : "none";

  ids.forEach(id => {
    const entry = searchIndex.find(e => e.id === id);
    if (!entry) return;

    const card = document.createElement("div");
    card.className = "game-card";
    card.dataset.id = id;

    const img = document.createElement("img");
    img.src = GAME_LOGOS[id] || "";
    img.alt = entry.display;

    const name = document.createElement("div");
    name.className = "game-name";
    name.textContent = entry.display;

    card.appendChild(img);
    card.appendChild(name);
    card.addEventListener("click", () => openGame(id));
    gameGrid.appendChild(card);
  });
}

function getAllIds() {
  return searchIndex.map(e => e.id).filter(id => GAME_URLS[id]);
}

// ── Search ────────────────────────────────────────────────────────────────────
function doSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderGrid(getAllIds());
    return;
  }
  const matched = searchIndex
    .filter(e => e.terms.some(t => t.includes(q)))
    .map(e => e.id)
    .filter(id => GAME_URLS[id]);
  renderGrid(matched);
}

gameSearch.addEventListener("input", () => doSearch(gameSearch.value));
gameSearch.addEventListener("keydown", e => {
  if (e.key === "Enter") doSearch(gameSearch.value);
});

// ── Open game ─────────────────────────────────────────────────────────────────
async function openGame(id) {
  const rawUrl = GAME_URLS[id];
  if (!rawUrl) return;

  // Register SW first
  try { await registerSW(); } catch(e) { console.warn("SW reg failed:", e); }

  const proxied = await proxyUrl(rawUrl);

  // Switch views
  gamesPage.style.display = "none";
  gamePage.classList.add("active");

  gameFrame.src = proxied;

  // Update URL without reloading
  history.pushState({ game: id }, "", `/math?game=${id}`);
}

// ── Back button ───────────────────────────────────────────────────────────────
gameBack.addEventListener("click", () => {
  gameFrame.src = "about:blank";
  gamePage.classList.remove("active");
  gamesPage.style.display = "flex";
  history.pushState({}, "", "/math");
});

// ── Fullscreen ────────────────────────────────────────────────────────────────
const gameFrameWrapper = document.getElementById("game-frame-wrapper");

btnFullscreen.addEventListener("click", () => {
  if (gameFrameWrapper.requestFullscreen) gameFrameWrapper.requestFullscreen();
  else if (gameFrameWrapper.webkitRequestFullscreen) gameFrameWrapper.webkitRequestFullscreen();
});

// ── Reload ────────────────────────────────────────────────────────────────────
btnReload.addEventListener("click", () => {
  try { gameFrame.contentWindow.location.reload(); } catch(e) {
    gameFrame.src = gameFrame.src;
  }
});

// ── Handle ?game= param on load ───────────────────────────────────────────────
async function checkUrlParam() {
  const params = new URLSearchParams(location.search);
  const gameId = params.get("game");
  if (gameId && GAME_URLS[gameId]) {
    await openGame(gameId);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await loadSearchIndex();
  renderGrid(getAllIds());
  await checkUrlParam();
})();
