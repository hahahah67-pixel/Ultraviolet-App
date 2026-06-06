"use strict";

// ── DOM refs ────────────────────────────────────────────────────────────────
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
const gameLoader       = document.getElementById("game-loader");
const glBg             = document.getElementById("gl-bg");
const glIcon           = document.getElementById("gl-icon");
const glTitle          = document.getElementById("gl-title");
const glEngine         = document.getElementById("gl-engine");
const gamesCount       = document.getElementById("games-count");
const gamesDiceBtn     = document.getElementById("games-dice-btn");

// ── state ───────────────────────────────────────────────────────────────────
let games = [];
let diceMode = "all";
let randomGame = null;

// ── load games ───────────────────────────────────────────────────────────────
async function loadGames() {
    try {
        const res = await fetch("/games.txt");
        const text = await res.text();

        games = text.trim().split("\n")
            .filter(l => l && !l.startsWith("#"))
            .map(line => {
                const p = line.split("|");
                return {
                    id: p[0].trim(),
                    display: p[1].trim(),
                    url: p[2].trim(),
                    logo: "images/game%20icons/" + encodeURIComponent(p[3].trim()),
                    terms: p.slice(1).map(t => t.trim().toLowerCase())
                };
            })
            .filter(g => g.id && g.url);
    } catch (e) {
        console.warn("games load failed", e);
        games = [];
    }
}

// ── legacy Scramjet loader ───────────────────────────────────────────────────
async function loadScramjet() {
    if (!window.__scramjetLoaded) {
        await import("/scram/scramjet.sync.js");
        window.__scramjetLoaded = true;
    }
}

// ── render grid ──────────────────────────────────────────────────────────────
function renderGrid(list) {
    gameGrid.innerHTML = "";
    noResults.style.display = list.length ? "none" : "block";

    gamesCount.textContent = `Games ${list.length} / ${games.length}`;

    for (const g of list) {
        const card = document.createElement("div");
        card.className = "game-card";

        const img = document.createElement("img");
        img.src = g.logo;

        const name = document.createElement("div");
        name.textContent = g.display;

        card.appendChild(img);
        card.appendChild(name);

        card.onclick = () => openGame(g.id);

        gameGrid.appendChild(card);
    }
}

// ── search ───────────────────────────────────────────────────────────────────
gameSearch.addEventListener("input", () => {
    const q = gameSearch.value.toLowerCase().trim();
    if (!q) return renderGrid(games);

    renderGrid(games.filter(g =>
        g.terms.some(t => t.includes(q))
    ));
});

// ── game frame helper ─────────────────────────────────────────────────────────
function getGameFrame() {
    return document.getElementById("game-frame");
}

// ── open game ────────────────────────────────────────────────────────────────
async function openGame(id) {
    const g = games.find(x => x.id === id);
    if (!g) return;

    await loadScramjet();

    glTitle.textContent = g.display;
    glIcon.src = g.logo;
    glEngine.textContent = "Scramjet (Legacy)";

    gamesPage.style.display = "none";
    gamePage.classList.add("active");

    gameLoader.classList.add("active");

    const frame = getGameFrame();
    frame.src = "about:blank";

    try {
        if (typeof window.__scramjetNavigate !== "function") {
            throw new Error("Scramjet runtime not ready");
        }

        // ensure loader minimum display time
        setTimeout(() => {
            gameLoader.classList.remove("active");
            window.__scramjetNavigate(frame, g.url);
        }, 1000);

        history.pushState({}, "", `/math?game=${id}`);

    } catch (err) {
        console.error(err);
        gameLoader.classList.remove("active");
    }
}

// ── back ─────────────────────────────────────────────────────────────────────
gameBack.onclick = () => {
    gamePage.classList.remove("active");
    gamesPage.style.display = "flex";
    getGameFrame().src = "about:blank";
};

// ── controls ──────────────────────────────────────────────────────────────────
btnReload.onclick = () => {
    const frame = getGameFrame();
    try {
        frame.contentWindow.location.reload();
    } catch (e) {
        console.warn("reload failed", e);
    }
};

btnFullscreen.onclick = () => {
    const el = gameFrameWrapper;
    if (el.requestFullscreen) el.requestFullscreen();
};

// ── init ─────────────────────────────────────────────────────────────────────
(async () => {
    await loadGames();
    renderGrid(games);
})();
