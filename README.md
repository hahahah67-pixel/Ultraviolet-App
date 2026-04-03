# Fish 🐟 Proxy

a powerful web proxy powered by proxy engines ultraviolet and scramjet, great UI and features.

---

## Features

- **Dual proxy engine** — switch between Ultraviolet and Scramjet on the fly
- **Games page** — dedicated games section at `/math` with a growing library
- **Custom background** — set any image as your homepage background, persists across sessions
- **Quick links** — one-click access to Roblox and the Games page from the homepage
- **Browser console** — in-proxy navigation bar with back, forward, reload, and home
- **Study.com disguise** — page appears as Study.com to casual observers
- **CAPTCHA support** — works on sites with hCaptcha and reCAPTCHA
- **Service worker header scrubbing** — strips proxy-revealing headers to reduce bot detection

---

## Tech Stack

- **Node.js** with Express
- **Ultraviolet** — UV proxy engine
- **Scramjet 2.0.0** — SJ proxy engine with WASM rewriting
- **BareMux** — transport multiplexer
- **libcurl transport** — for Scramjet
- **Epoxy transport** — for Ultraviolet
- **Wisp** — WebSocket tunneling protocol
- **AWS EC2** — hosting (t3.small)
- **CloudFront** — CDN for static assets
- **GitHub** — auto-pull deployment every 30 minutes

---

## Proxy Engines

### Ultraviolet
The classic, battle-tested engine. Best compatibility with most sites. Loads fast and stable.

### Scramjet
Newer engine with WASM-powered JS rewriting. Better at bypassing detection on modern sites. Lazy-loaded only when selected to avoid slowing down UV users.

---



## Deployment

Fish Proxy cannot be deployed in github seervices like railway,render etc instead:

1. host in a real wbe server with a linux VM (AWS)
2. fork our repo or make a site to fetch from it to make more unblocked links!

---

## Environment

- Node.js 24+
- pnpm 10+
- 2GB swap recommended alongside base RAM (since Fish Proxy provides both UV and SJ as proxy engines)

---

## License

AGPL-3.0 license
