# Plan: Client-side config text field

## Overview
Add a simple textarea to the join dialog for extra client cvars (e.g. `+set cg_fov 110 +set sensitivity 3`). Persisted in localStorage, appended to the engine command line.

## Files to modify

| File | Change |
|------|--------|
| `website/src/components/join-server-button.tsx` | Add a textarea for config, persist with `useLocalStorage`, pass via URL param |
| `website/src/routes/game.tsx` | Add `config` as optional search param |
| `website/src/pages/GamePage.tsx` | Extract `config` from search params, pass to `startGame` |
| `website/src/game/index.ts` | Accept `config` param, append to `generatedArguments` |

## Details

### 1. `join-server-button.tsx`
- Add `const [config, setConfig] = useLocalStorage("q3config", "")`
- Add a `<textarea>` below the name input, labelled "Config" with placeholder like `+set cg_fov 110`
- Add `config` to the game URL: `&config=${encodeURIComponent(config)}`

### 2. `routes/game.tsx`
- Add `config: z.string().optional()` to the search params schema

### 3. `GamePage.tsx`
- Extract `config` from `useSearch` alongside `host`, `proxyPort`, `name`
- Pass `config` to `startGame()`

### 4. `game/index.ts`
- Add `config?: string` to `Params` type
- After existing argument building, append: `if (config) generatedArguments += " " + config`

## Verification
- Open cpma.live, click Connect, see textarea in dialog
- Type `+set cg_fov 110`, join, verify FOV is 110 in-game
- Refresh page — config text should persist from localStorage
