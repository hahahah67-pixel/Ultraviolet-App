import { join } from "node:path";
import { hostname } from "node:os";
import { createServer } from "node:http";
import express from "express";
import wisp from "wisp-server-node";
import cookieParser from "cookie-parser";

import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const app = express();
app.use(cookieParser());

// ===== Private beta gate =====
const ENTRY_PATHS = ["/index.html", "/math", "/math.html"];
const ACCESS_COOKIE = "beta_access";

const SW_ASSET_PREFIXES = [
  "/sw.js",
  "/uv/",
  "/scram/",
  "/epoxy/",
  "/libcurl/",
  "/baremux/",
];

// Gate middleware
app.use((req, res, next) => {
  const hasAccessCookie = req.cookies?.[ACCESS_COOKIE] === "true";

  if (ENTRY_PATHS.includes(req.path) || hasAccessCookie) {
    return next();
  }

  if (req.path === "/health") return next();

  if (SW_ASSET_PREFIXES.some(p => req.path.startsWith(p))) return next();

  return sendError(res, 404, "404.html");
});

// Health check endpoint — responds 200 for AWS load balancer
app.get("/health", (req, res) => {
  res.sendStatus(200);
});

// Entry point — sets cookie then serves index directly with 1102 fallback
app.get("/index.html", (req, res) => {
  res.cookie(ACCESS_COOKIE, "true", {
    httpOnly: true,
    sameSite: "strict",
    path: "/"
  });
  res.sendFile("./public/index.html", { root: "." }, (err) => {
    if (err) sendError(res, 1102, "1102.html");
  });
});

// Games page — /math and /math.html both serve math.html with 1102 fallback
function serveMath(req, res) {
  res.cookie(ACCESS_COOKIE, "true", {
    httpOnly: true,
    sameSite: "strict",
    path: "/"
  });
  res.sendFile("./public/math.html", { root: "." }, (err) => {
    if (err) sendError(res, 1102, "1102.html");
  });
}
app.get("/math", serveMath);
app.get("/math.html", serveMath);
// ===== End beta gate =====

// Explicit root route so we can catch load errors → 1102
app.get("/", (req, res) => {
  res.sendFile("./public/index.html", { root: "." }, (err) => {
    if (err) sendError(res, 1102, "1102.html");
  });
});

// ── 444 Forbidden: intercept internal files BEFORE express.static serves them
const FORBIDDEN_PATTERNS = [
  /^\/sw\.js$/,
  /^\/register-sw\.js$/,
  /^\/search\.js$/,
  /^\/index\.js$/,
  /^\/index\.css$/,
  /^\/math\.js$/,
  /^\/math\.css$/,
  /^\/error\.js$/,
  /^\/404\.html$/,
  /^\/444\.html$/,
  /^\/1102\.html$/,
  /^\/games\.txt$/,
  /^\/images\//,
];
app.use((req, res, next) => {
  if (FORBIDDEN_PATTERNS.some(p => p.test(req.path))) {
    return sendError(res, 444, "444.html");
  }
  next();
});

// Public files (includes vendored /scram/ and /libcurl/ folders)
app.use(express.static("./public"));

// Ultraviolet vendor files (still served from npm)
app.use("/uv/", express.static(uvPath));

// Transport layers (epoxy for UV, baremux shared)
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

// Note: /scram/ and /libcurl/ are vendored directly in public/
// and served by express.static("./public") above — no npm routes needed.

// ── Error page helper
function sendError(res, code, file) {
	res.status(code);
	res.sendFile(`./public/${file}`, { root: "." });
}

// ── Genuine 404 catchall
app.use((req, res) => {
  sendError(res, 404, "404.html");
});

const server = createServer();

server.on("request", (req, res) => {
	// Required for SharedArrayBuffer support (used by Scramjet's WASM module)
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	app(req, res);
});

server.on("upgrade", (req, socket, head) => {
	// Single wisp endpoint serves both proxies
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
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	server.close();
	process.exit(0);
}

server.listen({
	port,
});
