"use strict";

// ── localStorage keys (shared with index.html / index.js) ─────────────────
const KEY_ENGINE = "fish-search-engine";
const KEY_CURSOR = "fish-cursor-color";
const KEY_PROXY  = "fish-proxy-choice";

// ── Defaults ──────────────────────────────────────────────────────────────
const DEFAULT_ENGINE = "https://duckduckgo.com/?q=%s";
const DEFAULT_CURSOR = "black";
const DEFAULT_PROXY  = "sj";

// ── Color map for fish cursor SVG ─────────────────────────────────────────
const CURSOR_COLORS = {
  black: "#111111",
  red:   "#e83333",
  blue:  "#4a8fff",
  green: "#2ecc71",
};

// ── Load saved values and pre-select radios ───────────────────────────────
(function loadSettings() {
  const engine = localStorage.getItem(KEY_ENGINE) || DEFAULT_ENGINE;
  const cursor = localStorage.getItem(KEY_CURSOR) || DEFAULT_CURSOR;
  const proxy  = localStorage.getItem(KEY_PROXY)  || DEFAULT_PROXY;

  const engineInputs = document.querySelectorAll('input[name="engine"]');
  engineInputs.forEach(r => { if (r.value === engine) r.checked = true; });

  const cursorInputs = document.querySelectorAll('input[name="cursor"]');
  cursorInputs.forEach(r => { if (r.value === cursor) r.checked = true; });

  const proxyInputs = document.querySelectorAll('input[name="proxy"]');
  proxyInputs.forEach(r => { if (r.value === proxy) r.checked = true; });
})();

// ── Save button ───────────────────────────────────────────────────────────
document.getElementById("save-btn").addEventListener("click", () => {
  const engineEl = document.querySelector('input[name="engine"]:checked');
  const cursorEl = document.querySelector('input[name="cursor"]:checked');
  const proxyEl  = document.querySelector('input[name="proxy"]:checked');

  if (engineEl) localStorage.setItem(KEY_ENGINE, engineEl.value);
  if (cursorEl) localStorage.setItem(KEY_CURSOR, cursorEl.value);
  if (proxyEl)  localStorage.setItem(KEY_PROXY, proxyEl.value);

  // Go back to homepage
  window.location.href = "/";
});

// ── Fish cursor — black = system default, others = custom fish ────────────
(function initCursor() {
  const color = localStorage.getItem(KEY_CURSOR) || DEFAULT_CURSOR;
  if (color === "black") return; // use system cursor

  const hex = CURSOR_COLORS[color];
  if (!hex) return;

  const el = document.createElement("div");
  el.id = "fish-cursor";
  el.style.cssText = "position:fixed;pointer-events:none;z-index:99999;width:22px;height:38px;transform:translate(-3px,-1px);display:none;";
  el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="38" viewBox="0 0 22 38">'
    + '<path d="M3,1 L3,24 Q0,31 3,37 Q7,31 10,25 Q14,37 18,37 Q16,30 12,23 L20,20 Z" fill="' + hex + '"/>'
    + '</svg>';
  document.body.appendChild(el);
  document.body.classList.add("fish-cursor-on");

  document.addEventListener("mousemove", (e) => {
    el.style.left = e.clientX + "px";
    el.style.top  = e.clientY + "px";
    el.style.display = "block";
  });
  document.addEventListener("mouseleave", () => { el.style.display = "none"; });
  document.addEventListener("mouseenter", () => { el.style.display = "block"; });
})();

// ── Starfield ─────────────────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById("starfield");
  const ctx    = canvas.getContext("2d");
  const COUNT  = 180;
  const SPEED  = 0.25;
  let stars    = [];
  let resizeTimer = null;

  function mkStar() {
    return {
      x:          Math.random() * canvas.width,
      y:          Math.random() * canvas.height,
      r:          Math.random() * 1.4 + 0.3,
      opacity:    Math.random() * 0.6 + 0.2,
      phase:      Math.random() * Math.PI * 2,
      phaseSpeed: Math.random() * 0.015 + 0.005
    };
  }

  function init() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: COUNT }, mkStar);
  }

  function resize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars = Array.from({ length: COUNT }, mkStar);
    }, 80);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.y += SPEED;
      if (s.y > canvas.height + 2) { s.y = -2; s.x = Math.random() * canvas.width; }
      s.phase += s.phaseSpeed;
      const a = s.opacity * (0.7 + 0.3 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  init();
  requestAnimationFrame(draw);
})();

// ── Tab cloak ─────────────────────────────────────────────────────────────
(function initCloak() {
  const KEY_CLOAK_TITLE = "fish-cloak-title";
  const KEY_CLOAK_ICON  = "fish-cloak-icon";

  const titleInput  = document.getElementById("cloak-title-input");
  const saveBtn     = document.getElementById("cloak-save-btn");
  const resetBtn    = document.getElementById("cloak-reset-btn");
  const iconOptions = document.querySelectorAll(".cloak-icon-option");

  let selectedIcon = localStorage.getItem(KEY_CLOAK_ICON) || null;

  // Pre-fill saved values
  const savedTitle = localStorage.getItem(KEY_CLOAK_TITLE);
  if (savedTitle) titleInput.value = savedTitle;
  if (selectedIcon) {
    iconOptions.forEach(opt => {
      if (opt.dataset.icon === selectedIcon) opt.classList.add("selected");
    });
  }

  // Icon selection
  iconOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      iconOptions.forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      selectedIcon = opt.dataset.icon;
    });
  });

  // Save cloak — applies immediately to this tab
  saveBtn.addEventListener("click", () => {
    const title = titleInput.value.trim();
    if (title) {
      document.title = title;
      localStorage.setItem(KEY_CLOAK_TITLE, title);
    }
    if (selectedIcon) {
      setFavicon(selectedIcon);
      localStorage.setItem(KEY_CLOAK_ICON, selectedIcon);
    }
  });

  // Reset — back to study.com defaults
  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(KEY_CLOAK_TITLE);
    localStorage.removeItem(KEY_CLOAK_ICON);
    titleInput.value = "";
    iconOptions.forEach(o => o.classList.remove("selected"));
    selectedIcon = null;
    document.title = "Online Courses for College Credit, Exam Prep & K-12 | Study.com";
    setFavicon("https://study.com/favicon.ico");
  });

  function setFavicon(href) {
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "shortcut icon";
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = href;
  }
})();
