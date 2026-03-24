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

  return res.sendStatus(404);
});

// Health check endpoint — responds 200 for AWS load balancer
app.get("/health", (req, res) => {
  res.sendStatus(200);
});

// Entry point — sets session cookie and redirects to homepage
app.get("/index.html", (req, res) => {
  res.cookie(ACCESS_COOKIE, "true", {
    httpOnly: true,
    sameSite: "strict",
    path: "/"
  });
  res.redirect("/");
});

// Games page — /math serves math.html and sets access cookie
app.get("/math", (req, res) => {
  res.cookie(ACCESS_COOKIE, "true", {
    httpOnly: true,
    sameSite: "strict",
    path: "/"
  });
  res.sendFile("./public/math.html", { root: "." });
});
// ===== End beta gate =====

// Public files (includes vendored /scram/ and /libcurl/ folders)
app.use(express.static("./public"));

// Ultraviolet vendor files (still served from npm)
app.use("/uv/", express.static(uvPath));

// Transport layers (epoxy for UV, baremux shared)
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

// Note: /scram/ and /libcurl/ are vendored directly in public/
// and served by express.static("./public") above — no npm routes needed.

// 404 fallback
app.use((req, res) => {
	res.status(404);
	res.sendFile("./public/404.html", { root: "." });
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
