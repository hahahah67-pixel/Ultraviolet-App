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
const ENTRY_PATHS = ["/index.html", "/math", "/math.html", "/settings"];
const ALLOWED_HOSTS = ["100.52.135.225"];
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
  const host = req.headers.host?.split(":")[0];
  if (ENTRY_PATHS.includes(req.path) || hasAccessCookie || ALLOWED_HOSTS.includes(host)) return next();
  if (req.path === "/health") return next();
  if (req.path === "/messages.txt") return next();
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
