# Fish 🐟 Proxy

a powerful web proxy powered by proxy engines ultraviolet and scramjet, great UI and features.

#Features:
-use ultraviltot and scramjet proxy servers
-very good clean animation, branding and charm.
-powered by AWS EC2 instance ubuntu linux
-made to bypass restrictions with special code to bypass filters
-has a broswer consloe letting users change URL, reload page, go home, back forward button etc..
-good proxy!!

## Setup

```bash
npm install
npm start
```

Server runs on port `8080` by default, or whatever `PORT` env var is set to.

## Deploy to Railway / Render / Fly.io

1. Push this repo to GitHub
2. Connect repo to Railway / Render / Fly.io
3. Set start command to `npm start`
4. Done — HTTPS is handled automatically

## File Structure

```
Ultraviolet-App-main/
│
├── .dockerignore
├── .gitignore
├── .prettierignore
├── .replit
│
├── Dockerfile
├── docker-compose.yml
├── LICENSE
├── README.md
├── app.json
│
├── package.json
├── pnpm-lock.yaml
├── prettier.config.js
├── eslint.config.mjs
├── replit.nix
│
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── config.yml
│   │
│   └── workflows/
│       ├── docker-image.yml
│       └── eslint.yml
│
├── public/
│   │
│   ├── index.html
│   ├── index.js
│   ├── index.css
│   │
│   ├── 404.html
│   ├── credit.html
│   ├── credits.html
│   ├── settings.html
│   │
│   ├── config.js
│   ├── search.js
│   ├── error.js
│   │
│   ├── register-sw.js
│   ├── sw.js
│   │
│   ├── favicon.ico
│   ├── uv.png
│   │
│   ├── uv/
│   │   └── uv.config.js
│   │
│   └── scramjet/
│       ├── scramjet.all.js
│       ├── scramjet.bundle.js
│       ├── scramjet.sync.js
│       └── scramjet.wasm.wasm
│
└── src/
    └── index.js


## Requirements

- All normal requirements of ultraviltot example app ONLY
