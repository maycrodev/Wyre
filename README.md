<div align="center">

# Wyre

**Local file transfer between your phone and PC — no cables, no cloud, no installs.**

Scan a QR code. Open a browser. Done.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![npm](https://img.shields.io/badge/npm-workspaces-orange)](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
[![Status](https://img.shields.io/badge/status-in%20development-yellow)]()

</div>

---

## The problem

50 years of computers and the most effective way to move a file from your phone to your PC is still sending it to yourself on WhatsApp.

Wyre fixes that.

---

## How it works

```
$ wyre

  ████████████████████
  ██ ▄▄▄▄▄ █▀ █▀ ▀██
  ██ █   █ █▀▀▀▀▄ ███
  ██ █▄▄▄█ █▀ ▀▄▀ ███
  ██▄▄▄▄▄▄▄█▄▀▄█▄▄███
  ████████████████████

  Local network ready
  http://192.168.1.42:3131
```

1. Run `wyre` on your PC
2. Scan the QR code with your phone
3. Your phone opens a browser — no app required
4. Drag, drop, download. Done.

Everything stays on your local network. Nothing touches the internet.

---

## Features

- **Zero install on mobile** — works in any modern browser
- **Bidirectional transfer** — phone to PC and PC to phone
- **Real-time progress** — live progress bar during transfer
- **Chunked transfers** — handles large files without issues
- **Auto QR generation** — detects your local IP automatically
- **Fast** — local network speeds, not cloud bottlenecks
- **Private** — your files never leave your network

---

## Installation

```bash
npm install -g @wyre/cli
```

Or run directly without installing:

```bash
npx @wyre/cli
```

---

## Usage

```bash
# Start Wyre (shares current directory)
wyre

# Share a specific folder
wyre --dir ~/Downloads

# Use a custom port
wyre --port 8080

# Receive only (disable uploads from phone)
wyre --receive-only
```

---

## Tech stack

| Package | Role |
|---|---|
| `@wyre/server` | Express + WebSocket server, file routing |
| `@wyre/cli` | Terminal interface, QR generation, IP detection |
| `@wyre/web-client` | Mobile browser UI (vanilla HTML/CSS/JS) |

- **Runtime:** Node.js 18+, TypeScript
- **Monorepo:** npm workspaces
- **Transport:** HTTP + WebSockets (same port, upgrade)
- **Mobile UI:** Zero-dependency vanilla HTML — loads instantly on any device

---

## Development

```bash
# Clone the repo
git clone https://github.com/maycrodev/wyre.git
cd wyre

# Install dependencies
npm install

# Build all packages
npm run build --workspaces

# Run locally
node packages/cli/dist/cli.js
```

### Project structure

```
wyre/
├── packages/
│   ├── server/         # HTTP + WebSocket server
│   │   └── src/
│   │       └── index.ts
│   ├── cli/            # `wyre` command
│   │   └── src/
│   │       └── cli.ts
│   └── web-client/     # Mobile browser UI
│       └── src/
│           └── index.html
├── docs/
│   └── architecture.md
└── package.json
```

---

## Why not just use LocalSend / Snapdrop / Sharedrop?

They exist. They work. But:

- LocalSend requires installing an app on your phone
- Snapdrop and Sharedrop depend on external servers
- Most alternatives require both devices to be on the same session or app

Wyre requires nothing on your phone — just a browser. One command, one QR, done.

---

## License

[MIT](LICENSE) — © 2026 Juan José Cordeiro

---

<div align="center">
  Built with frustration at USB cables and WhatsApp Web.
</div>
