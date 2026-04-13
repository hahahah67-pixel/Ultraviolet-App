import { join } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import express from "express";
import wisp from "wisp-server-node";
import cookieParser from "cookie-parser";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const app = express();
app.use(cookieParser());
app.use(express.json());

// ===== Analytics =====
const ANALYTICS_FILE = "./analytics.json";
const ADMIN_PASSWORDS = ["1738", "4400062230070154"];

function loadAnalytics() {
  if (existsSync(ANALYTICS_FILE)) {
    try { return JSON.parse(readFileSync(ANALYTICS_FILE, "utf8")); } catch(e) {}
  }
  return { users: {}, totalUsers: 0, weeklyDomains: {}, weekStart: getWeekStart() };
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day;
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function checkWeekRollover() {
  const currentWeek = getWeekStart();
  if (!analytics.weekStart || analytics.weekStart !== currentWeek) {
    // Archive old week, start fresh
    if (!analytics.pastWeeks) analytics.pastWeeks = [];
    if (analytics.weeklyDomains && Object.keys(analytics.weeklyDomains).length > 0) {
      analytics.pastWeeks.unshift({
        week: analytics.weekStart,
        domains: analytics.weeklyDomains
      });
      // Keep only last 8 weeks
      if (analytics.pastWeeks.length > 8) analytics.pastWeeks = analytics.pastWeeks.slice(0, 8);
    }
    analytics.weeklyDomains = {};
    analytics.weekStart = currentWeek;
    saveAnalytics(analytics);
  }
}

function saveAnalytics(data) {
  try { writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

let analytics = loadAnalytics();

// Get real IP (handles proxies/CloudFront)
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["cf-connecting-ip"] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

// Visit endpoint — called on page load
app.post("/api/visit", (req, res) => {
  const ip = getIP(req);
  const today = getToday();
  const now = Date.now();

  // Tally settings stats (aggregate only — no user identity)
  const { engine, proxy, cursor } = req.body || {};
  if (!analytics.settingsStats) analytics.settingsStats = {};
  if (!analytics.settingsStats[today]) {
    analytics.settingsStats[today] = {
      engine: {}, proxy: {}, cursor: {}
    };
  }
  const todayStats = analytics.settingsStats[today];
  // Only tally if values are present (null sent on repeat page loads within same session)
  if (engine && typeof engine === "string") todayStats.engine[engine] = (todayStats.engine[engine] || 0) + 1;
  if (proxy  && typeof proxy  === "string") todayStats.proxy[proxy]   = (todayStats.proxy[proxy]   || 0) + 1;
  if (cursor && typeof cursor === "string") todayStats.cursor[cursor] = (todayStats.cursor[cursor] || 0) + 1;

  if (!analytics.users[ip]) {
    analytics.totalUsers++;
    analytics.users[ip] = {
      id: `user_${analytics.totalUsers}`,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      totalSeconds: 0,
      dailySeconds: {},
      visits: 0,
    };
  }

  const user = analytics.users[ip];
  user.lastSeen = new Date().toISOString();
  user.visits++;
  if (!user.dailySeconds[today]) user.dailySeconds[today] = 0;

  saveAnalytics(analytics);
  res.json({ userId: user.id });
});

// Ping endpoint — called every 60s to track time spent
app.post("/api/ping", (req, res) => {
  const ip = getIP(req);
  const today = getToday();

  if (analytics.users[ip]) {
    const user = analytics.users[ip];
    user.totalSeconds += 60;
    if (!user.dailySeconds[today]) user.dailySeconds[today] = 0;
    user.dailySeconds[today] += 60;
    user.lastSeen = new Date().toISOString();
    saveAnalytics(analytics);
  }
  res.sendStatus(200);
});

// Domain tracking endpoint — aggregate only, no user identity
app.post("/api/domain", (req, res) => {
  const { domain } = req.body || {};
  if (!domain || typeof domain !== "string") return res.sendStatus(400);

  // Sanitize — only keep the hostname part
  let host;
  try {
    host = new URL(domain.startsWith("http") ? domain : "https://" + domain).hostname;
    host = host.replace(/^www\./, "");
  } catch(e) { return res.sendStatus(400); }

  checkWeekRollover();
  if (!analytics.weeklyDomains[host]) analytics.weeklyDomains[host] = 0;
  analytics.weeklyDomains[host]++;
  saveAnalytics(analytics);
  res.sendStatus(200);
});

// Admin panel
app.get("/admin", (req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Fish Proxy — Admin</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:monospace;background:#0a0a0a;color:#e0e0e0;min-height:100vh;padding:32px 24px}
    h1{font-size:22px;color:#fff;margin-bottom:24px;letter-spacing:0.05em}
    h2{font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.12em;margin:28px 0 12px}
    .card{background:#111;border:1px solid #222;border-radius:12px;padding:20px 24px;margin-bottom:12px}
    .stat{font-size:32px;font-weight:700;color:#fff}
    .stat-label{font-size:12px;color:#555;margin-top:4px;letter-spacing:0.06em;text-transform:uppercase}
    .stats-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px}
    .stats-row .card{flex:1;min-width:140px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{text-align:left;padding:10px 12px;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid #1e1e1e}
    td{padding:10px 12px;border-bottom:1px solid #161616;color:#ccc}
    tr:hover td{background:#141414}
    .uid{color:#4a8fff;font-weight:600}
    #login{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px}
    #login h1{font-size:18px;letter-spacing:0.1em;color:#fff}
    #pw{background:#111;border:1px solid #333;border-radius:8px;padding:12px 16px;color:#fff;font-size:16px;font-family:monospace;width:260px;outline:none}
    #pw:focus{border-color:#4a8fff}
    #login-btn{background:#4a8fff;color:#fff;border:none;border-radius:8px;padding:11px 32px;font-size:14px;font-family:monospace;cursor:pointer;letter-spacing:0.06em}
    #login-btn:hover{background:#3a7aee}
    #err{color:#e83333;font-size:13px;display:none}
    #panel{display:none}
  </style>
</head>
<body>
  <div id="login">
    <h1>🐟 FISH PROXY ADMIN</h1>
    <input id="pw" type="password" placeholder="password" autofocus/>
    <button id="login-btn" onclick="doLogin()">enter</button>
    <div id="err">wrong password</div>
  </div>
  <div id="panel"></div>
  <script>
    let _pw = "";
    function doLogin() {
      const pw = document.getElementById("pw").value;
      fetch("/api/admin/data", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({password: pw})
      }).then(r => {
        if (!r.ok) { document.getElementById("err").style.display="block"; return; }
        return r.json();
      }).then(data => {
        if (!data) return;
        _pw = pw;
        document.getElementById("login").style.display = "none";
        renderPanel(data);
        document.getElementById("panel").style.display = "block";
      });
    }
    document.getElementById("pw").addEventListener("keydown", e => {
      if (e.key === "Enter") doLogin();
    });

    function fmtTime(secs) {
      if (!secs) return "0m";
      const h = Math.floor(secs/3600);
      const m = Math.floor((secs%3600)/60);
      return h > 0 ? h+"h "+m+"m" : m+"m";
    }

    function downloadData() {
      fetch("/api/admin/download", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({password: _pw})
      }).then(r => r.blob()).then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "analytics.json";
        a.click();
      });
    }

    function renderTopDomains(data) {
      const domains = data.weeklyDomains || {};
      const sorted = Object.entries(domains)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 10);

      if (sorted.length === 0) return '<span style="color:#555;font-size:13px">No domain data yet this week.</span>';

      const max = sorted[0][1];
      const weekStart = data.weekStart || "";

      return \`<div style="font-size:11px;color:#555;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.08em">Week of \${weekStart}</div>\`
        + sorted.map(([domain, count], i) => {
          const pct = Math.round(count/max*100);
          return \`<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;align-items:center">
              <span style="color:#fff;font-size:13px"><span style="color:#555;margin-right:8px">#\${i+1}</span>\${domain}</span>
              <span style="color:#fff;font-weight:600;font-size:13px">\${count} <span style="color:#555;font-weight:400">visits</span></span>
            </div>
            <div style="background:#1a1a1a;border-radius:4px;height:5px">
              <div style="background:#4a8fff;border-radius:4px;height:5px;width:\${pct}%"></div>
            </div>
          </div>\`;
        }).join("");
    }

    function renderSettingsStats(stats) {
      const today = new Date().toISOString().split("T")[0];
      const s = stats && stats[today];
      if (!s) return "<div class='card' style='color:#555;font-size:13px'>No settings data yet for today.</div>";

      const ENGINE_LABELS = {
        "https://duckduckgo.com/?q=%s": "DuckDuckGo",
        "https://www.startpage.com/search?q=%s": "Startpage",
        "https://www.google.com/search?q=%s": "Google",
        "https://search.yahoo.com/search?p=%s": "Yahoo"
      };

      function buildBlock(title, data) {
        const total = Object.values(data).reduce((a,b)=>a+b,0) || 1;
        const rows = Object.entries(data).map(([k,v]) => {
          const label = ENGINE_LABELS[k] || k;
          const pct = Math.round(v/total*100);
          return \`<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#ccc;font-size:13px">\${label}</span>
              <span style="color:#fff;font-weight:600">\${v} <span style="color:#555;font-weight:400">(\${pct}%)</span></span>
            </div>
            <div style="background:#1a1a1a;border-radius:4px;height:6px">
              <div style="background:#4a8fff;border-radius:4px;height:6px;width:\${pct}%"></div>
            </div>
          </div>\`;
        }).join("");
        return \`<div class="card" style="min-width:200px;flex:1">
          <div class="stat-label" style="margin-bottom:16px">\${title}</div>
          \${rows || '<span style="color:#555;font-size:13px">no data</span>'}
        </div>\`;
      }

      return buildBlock("Search Engine", s.engine||{})
           + buildBlock("Proxy Type", s.proxy||{})
           + buildBlock("Cursor Color", s.cursor||{});
    }

    function renderPanel(data) {
      const users = Object.values(data.users).sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric:true}));
      const today = new Date().toISOString().split("T")[0];
      const activeToday = users.filter(u => u.dailySeconds[today] > 0).length;
      const totalTime = users.reduce((s,u) => s + (u.totalSeconds||0), 0);

      let rows = users.map(u => {
        const todayTime = u.dailySeconds[today] || 0;
        return \`<tr>
          <td class="uid">\${u.id}</td>
          <td>\${new Date(u.firstSeen).toLocaleDateString()}</td>
          <td>\${new Date(u.lastSeen).toLocaleString()}</td>
          <td>\${u.visits||0}</td>
          <td>\${fmtTime(todayTime)}</td>
          <td>\${fmtTime(u.totalSeconds)}</td>
        </tr>\`;
      }).join("");

      document.getElementById("panel").innerHTML = \`
        <h1>🐟 Fish Proxy Analytics <button onclick="downloadData()" style="margin-left:16px;background:#222;color:#fff;border:1px solid #333;border-radius:8px;padding:7px 18px;font-size:12px;font-family:monospace;cursor:pointer;letter-spacing:0.05em;vertical-align:middle">⬇ download json</button></h1>
        <h2>Overview</h2>
        <div class="stats-row">
          <div class="card"><div class="stat">\${data.totalUsers}</div><div class="stat-label">Total Users</div></div>
          <div class="card"><div class="stat">\${activeToday}</div><div class="stat-label">Active Today</div></div>
          <div class="card"><div class="stat">\${fmtTime(totalTime)}</div><div class="stat-label">Total Time All Users</div></div>
        </div>
        <h2>Weekly Top 10 Domains</h2>
        <div class="card" style="margin-bottom:8px">
          \${renderTopDomains(data)}
        </div>
        <h2>Settings Stats — Today</h2>
        <div class="stats-row" id="settings-stats">
          \${renderSettingsStats(data.settingsStats)}
        </div>
        <h2>Users</h2>
        <div class="card" style="padding:0;overflow:auto">
          <table>
            <thead><tr>
              <th>User ID</th><th>First Seen</th><th>Last Seen</th>
              <th>Visits</th><th>Time Today</th><th>Total Time</th>
            </tr></thead>
            <tbody>\${rows}</tbody>
          </table>
        </div>\`;
    }
  </script>
</body>
</html>`);
});

// Admin data API
app.post("/api/admin/data", (req, res) => {
  if (!ADMIN_PASSWORDS.includes(req.body?.password)) {
    return res.sendStatus(401);
  }
  res.json(analytics);
});

// Admin download — returns analytics.json as a downloadable file
app.post("/api/admin/download", (req, res) => {
  if (!ADMIN_PASSWORDS.includes(req.body?.password)) {
    return res.sendStatus(401);
  }
  res.setHeader("Content-Disposition", "attachment; filename=analytics.json");
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(analytics, null, 2));
});

// ===== End Analytics =====

// ===== Private beta gate =====
const ENTRY_PATHS = ["/index.html", "/math", "/math.html", "/settings"];
const ACCESS_COOKIE = "beta_access";

const SW_ASSET_PREFIXES = [
  "/sw.js",
  "/uv/",
  "/scram/",
  "/epoxy/",
  "/libcurl/",
  "/baremux/",
];

app.use((req, res, next) => {
  const hasAccessCookie = req.cookies?.[ACCESS_COOKIE] === "true";
  if (ENTRY_PATHS.includes(req.path) || hasAccessCookie) return next();
  if (req.path === "/health") return next();
  if (req.path === "/admin") return next();
  if (req.path.startsWith("/api/")) return next();
  if (SW_ASSET_PREFIXES.some(p => req.path.startsWith(p))) return next();
  return sendError(res, 404, "404.html");
});

app.get("/health", (req, res) => { res.sendStatus(200); });

app.get("/index.html", (req, res) => {
  res.cookie(ACCESS_COOKIE, "true", { httpOnly: true, sameSite: "strict", path: "/" });
  res.redirect("/");
});

function serveMath(req, res) {
  res.cookie(ACCESS_COOKIE, "true", { httpOnly: true, sameSite: "strict", path: "/" });
  res.sendFile("./public/math.html", { root: "." }, (err) => {
    if (err) sendError(res, 1102, "1102.html");
  });
}
app.get("/math", serveMath);
app.get("/math.html", serveMath);

app.get("/settings", (req, res) => {
  res.cookie(ACCESS_COOKIE, "true", { httpOnly: true, sameSite: "strict", path: "/" });
  res.sendFile("./public/settings.html", { root: "." }, (err) => {
    if (err) sendError(res, 1102, "1102.html");
  });
});

app.get("/", (req, res) => {
  res.sendFile("./public/index.html", { root: "." }, (err) => {
    if (err) sendError(res, 1102, "1102.html");
  });
});

const FORBIDDEN_PATHS = ["/404.html", "/444.html", "/1102.html"];
app.use((req, res, next) => {
  if (FORBIDDEN_PATHS.includes(req.path)) return sendError(res, 444, "444.html");
  next();
});

app.use(express.static("./public"));
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

function sendError(res, code, file) {
  res.status(code);
  res.sendFile(`./public/${file}`, { root: "." });
}

app.use((req, res) => { sendError(res, 404, "404.html"); });

const server = createServer();

server.on("request", (req, res) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  app(req, res);
});

server.on("upgrade", (req, socket, head) => {
  if (req.url.endsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
    return;
  }
  socket.end();
});

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

server.on("listening", () => {
  const address = server.address();
  console.log("Listening on:");
  console.log(`\thttp://localhost:${address.port}`);
  console.log(`\thttp://${hostname()}:${address.port}`);
  console.log(`\thttp://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close();
  process.exit(0);
}

server.listen({ port });
