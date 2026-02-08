# Split Static Hosting: Cloudflare Pages + R2

## Context

The website, pak files, WASM binary, and game server are all currently served from a single VPS behind Nginx. The goal is to move the static assets (website SPA + pak files) off the VPS to reduce cost and complexity, keeping only the dynamic components (proxy + ioq3ded + master API) on a real server.

**Target architecture:**
- **Cloudflare Pages** — serves the website SPA (HTML/JS/CSS/WASM, ~3 MB)
- **Cloudflare R2** — serves pak files (~486 MB) via a custom subdomain
- **VPS** — continues running proxy + ioq3ded + master API (no change)

---

## Changes

### 1. Add `VITE_ASSETS_URL` env var

**Files:** `website/src/env.ts`, `website/.env`, `website/.env.production`

Add a new `VITE_ASSETS_URL` variable that points pak file fetches at R2 instead of the current page origin. In dev, it stays as the local Vite server. In production, it points to the R2 custom domain.

- `website/src/env.ts` — add `VITE_ASSETS_URL: z.string().optional()` to the client schema
- `website/.env` — no change needed (falls back to `location.origin`)
- `website/.env.production` — add `VITE_ASSETS_URL=https://assets.cpma.live`

### 2. Update pak file URL construction

**File:** `website/src/game/index.ts` (line 105)

Change `dataURL` from `location.origin` to `VITE_ASSETS_URL` when set:

```typescript
// Before:
const dataURL = new URL(location.origin + location.pathname);

// After:
const dataURL = new URL(env.VITE_ASSETS_URL ?? location.origin);
```

### 3. Add R2 upload script

**New file:** `scripts/upload-assets-r2.sh`

A simple shell script that uses `wrangler` CLI to upload all pak files to the R2 bucket:

```bash
#!/usr/bin/env bash
BUCKET="cpma-assets"
for f in website/public/baseq3/*.pk3; do
  wrangler r2 object put "$BUCKET/baseq3/$(basename $f)" --file="$f"
done
for f in website/public/cpma/*.pk3; do
  wrangler r2 object put "$BUCKET/cpma/$(basename $f)" --file="$f"
done
```

### 4. Add Cloudflare Pages config

**New file:** `website/wrangler.toml`

Minimal config for `wrangler pages deploy`:

```toml
name = "cpma-live"
compatibility_date = "2025-01-01"

[site]
bucket = "./dist"
```

### 5. Add deploy script to package.json

**File:** `website/package.json`

Add a `deploy` script:
```json
"deploy": "npm run build && wrangler pages deploy dist --project-name=cpma-live"
```

### 6. R2 bucket CORS configuration

**New file:** `scripts/r2-cors.json`

R2 needs CORS headers so the browser can fetch pak files cross-origin. Applied once via:
```bash
wrangler r2 bucket cors put cpma-assets --rules ./scripts/r2-cors.json
```

```json
[
  {
    "allowedOrigins": ["https://cpma.live", "http://localhost:3000"],
    "allowedMethods": ["GET", "HEAD"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 86400
  }
]
```

---

## Setup Steps (one-time, manual)

These are Cloudflare dashboard / CLI steps, not code changes:

1. **Add domain to Cloudflare** — transfer or point `cpma.live` nameservers to Cloudflare
2. **Create R2 bucket** — `wrangler r2 bucket create cpma-assets`
3. **Set R2 custom domain** — in Cloudflare dashboard, add `assets.cpma.live` as a custom domain for the R2 bucket (auto SSL)
4. **Apply CORS rules** — `wrangler r2 bucket cors put cpma-assets --rules ./scripts/r2-cors.json`
5. **Upload pak files** — `./scripts/upload-assets-r2.sh`
6. **Create Pages project** — first deploy creates it: `cd website && npm run deploy`
7. **Set Pages custom domain** — in Cloudflare dashboard, add `cpma.live` as a custom domain for the Pages project

---

## Files Modified
- `website/src/env.ts` — add `VITE_ASSETS_URL`
- `website/src/game/index.ts` — use `VITE_ASSETS_URL` as base URL for pak fetches
- `website/.env.production` — add `VITE_ASSETS_URL=https://assets.cpma.live`
- `website/package.json` — add `deploy` script

## Files Created
- `scripts/upload-assets-r2.sh` — R2 upload script
- `scripts/r2-cors.json` — CORS config for R2 bucket
- `website/wrangler.toml` — Cloudflare Pages config

## Verification

1. **Local dev** — `cd website && npm run dev` still works (no `VITE_ASSETS_URL` set, falls back to `location.origin`, pak files served from `public/`)
2. **R2 upload** — run `./scripts/upload-assets-r2.sh`, verify files exist with `wrangler r2 object list cpma-assets --prefix baseq3/`
3. **CORS** — `curl -H "Origin: https://cpma.live" -I https://assets.cpma.live/baseq3/pak0.pk3` should return `Access-Control-Allow-Origin`
4. **Pages deploy** — `cd website && npm run deploy`, verify site loads at `cpma.live`
5. **End-to-end** — load `https://cpma.live`, click a server, confirm pak files download from `assets.cpma.live` (check Network tab), game launches
