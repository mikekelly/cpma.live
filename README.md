# Q3 Promode

> Quake III CPMA in the browser — WebAssembly client on Cloudflare, dedicated server on a VPS.

Play at [cpma.live](https://cpma.live).

## Architecture

```
Browser (React + ioquake3.wasm)
    ├── HTTPS ─→ Cloudflare Pages    (website)
    ├── HTTPS ─→ Cloudflare Workers  (master server API)
    ├── HTTPS ─→ Cloudflare R2       (pak assets)
    └── WSS   ─→ VPS proxy           (WebSocket↔UDP) ─→ ioq3ded
```

| Hostname             | Target                              |
|----------------------|-------------------------------------|
| `cpma.live`          | Cloudflare Pages (website)          |
| `master.cpma.live`   | Cloudflare Workers (master API)     |
| `assets.cpma.live`   | Cloudflare R2 (game assets)         |
| `proxy.cpma.live`    | VPS — Rust WS↔UDP proxy (TLS)      |

## Repository map

| Path         | Description                                                         |
|--------------|---------------------------------------------------------------------|
| `game/`      | Emscripten build scripts — compiles `ioquake3` to `ioquake3.{js,wasm}` |
| `website/`   | Vite + React + TanStack Router UI, deployed to CF Pages             |
| `master-cf/` | Cloudflare Worker — master server API (Durable Objects + SQLite)    |
| `proxy/`     | Rust WebSocket↔UDP proxy, runs on VPS with TLS via Let's Encrypt   |
| `server/`    | Native `ioq3ded` build scripts + CPMA config                       |
| `deploy/`    | systemd unit files and deploy hooks for the VPS                     |
| `scripts/`   | Asset upload and utility scripts                                    |
| `ioq3/`      | Submodule — ioquake3 source                                        |

## Prerequisites

Before building or running anything, you need the git submodules and the game
data. Neither is committed to this repo — the submodules are upstream sources and
the game assets are copyrighted id Software data.

### 1. Submodules (`ioq3`, `emsdk`)

The engine source and the Emscripten SDK used to compile the WebAssembly client
are git submodules. Clone them after checkout:

```bash
git submodule update --init --recursive
```

- `ioq3/` — ioquake3 engine source (needed to build both the wasm client and the native `ioq3ded` server).
- `emsdk/` — Emscripten SDK, used by `game/build.sh` to compile the engine to `ioquake3.{js,wasm}`. After init, activate it once:

  ```bash
  cd emsdk && ./emsdk install latest && ./emsdk activate latest && cd ..
  ```

  > A prebuilt `ioquake3.{js,wasm}` is already committed under `website/src/lib/`,
  > so `emsdk` is only required if you want to **rebuild** the client.

### 2. Game assets (pak files)

The `.pk3` game data (Quake 3 demo paks, hi-res textures, CPMA 1.53, map pack,
etc.) is **not** in the repo and is git-ignored. Download it with:

```bash
./scripts/download-assets.sh
```

This populates both the client (`website/game-assets/`) and the server
(`server/baseq3/`, `server/cpma/`) trees. Sources include the Quake 3 demo paks,
ioquake3 patch paks, and CPMA 1.53 from playmorepromode.com. The script is
idempotent — it skips files that already exist.

Once downloaded, upload the assets to Cloudflare R2 (see
[Game assets](#game-assets-cloudflare-r2) under Deployment) so the browser client
can fetch them at runtime.

## Deployment

### Website (Cloudflare Pages)

```bash
cd website
npm install && npm run build
npx wrangler pages deploy dist
```

### Master server (Cloudflare Workers)

```bash
cd master-cf
npm install
npx wrangler deploy
```

### Game assets (Cloudflare R2)

```bash
./scripts/upload-assets-r2.sh
```

### Game server (VPS — systemd)

The dedicated server (`ioq3ded`) and WebSocket proxy run as systemd services.
Unit files are in `deploy/`.

```bash
# Copy unit files
sudo cp deploy/q3server.service /etc/systemd/system/
sudo cp deploy/q3proxy.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now q3server q3proxy

# Certbot renewal hook (restarts proxy to pick up new TLS certs)
sudo cp deploy/certbot-renew-hook.sh /etc/letsencrypt/renewal-hooks/deploy/restart-q3proxy.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-q3proxy.sh
```

VPS directory layout:
```
/opt/q3promode/
├── server/
│   ├── ioq3ded
│   ├── server.cfg
│   ├── baseq3/
│   └── cpma/
└── proxy/
    └── q3proxy          # compiled Rust binary
```

## Local development

> First complete the [Prerequisites](#prerequisites): init the submodules and run
> `./scripts/download-assets.sh`. The client and server both need the `.pk3` data.

1. **Build the WebAssembly client** (optional — a prebuilt copy is already committed)
   ```bash
   cd game && ./build.sh
   ```
   Compiles `ioq3` via `emsdk` and copies `ioquake3.{js,wasm}` into `website/src/lib/`.

2. **Run the website**
   ```bash
   cd website && npm install && npm run dev
   ```

3. **Run the proxy** (optional — only needed if testing game connections)
   ```bash
   cd proxy && cargo run
   ```

## CPMA game types

| Type | Mode              |
|------|-------------------|
| 0    | FFA               |
| 1    | Duel              |
| 2    | HoonyMode         |
| 3    | TDM               |
| 4    | CTF               |
| 5    | Clan Arena        |
| 6    | Freeze Tag        |
| 7    | Capture Strike    |
| 8    | NTF               |

## License & credits

- Engine source derived from [ioquake3](https://github.com/ioquake/ioq3) (GPLv2). See `ioq3/`.
- Game assets remain (c) id Software / Bethesda. Supply your own `baseq3` data — see [Prerequisites](#2-game-assets-pak-files).
- WebSocket proxy and integration glue by [lklacar](https://github.com/lklacar).
