# Vibe Coding Starter Pack: 3D Multiplayer

3D multiplayer game starter kit — React 19 + Three.js + SpacetimeDB 2.0.1 (Rust backend).

## Architecture

- `server/` — SpacetimeDB Rust module (compiled to WASM, runs on SpacetimeDB server)
- `client/` — Vite + React + React Three Fiber frontend

Data flow: client input (20Hz) → WebSocket → `updatePlayerInput` reducer → server updates PlayerData table → subscription pushes changes → all clients render.

## Key Files

### Server (Rust)
- `server/src/lib.rs` — Tables (`PlayerData`, `LoggedOutPlayerData`, `GameTickSchedule`), reducers (`register_player`, `update_player_input`), lifecycle handlers (`init`, `identity_connected`, `identity_disconnected`)
- `server/src/player_logic.rs` — `calculate_new_position()`, `update_input_state()`, `update_players_logic()` (game tick placeholder)
- `server/src/common.rs` — Shared types: `Vector3`, `InputState`. Constants: `PLAYER_SPEED = 7.5`, `SPRINT_MULTIPLIER = 1.8`

### Client (TypeScript/React)
- `client/src/App.tsx` — SpacetimeDB connection, input handling (keyboard/mouse), game loop (requestAnimationFrame throttled to 20Hz), state management
- `client/src/components/Player.tsx` — FBX model loading, animation system, client-side prediction, camera follow/orbital modes, nametags
- `client/src/components/GameScene.tsx` — R3F Canvas, sky, lighting, shadows, ground plane, player rendering
- `client/src/components/DebugPanel.tsx` — Collapsible dev panel: status, player list, controls reference, model checker
- `client/src/components/PlayerUI.tsx` — HUD overlay: health/mana bars, damage flash
- `client/src/components/JoinGameDialog.tsx` — Username + class selection modal
- `client/src/simulation.ts` — Bot load-testing tool (spawns N SpacetimeDB clients)
- `client/src/generated/` — Auto-generated bindings (do NOT edit manually)

## SpacetimeDB v2 API Patterns

### Server (Rust)
```rust
// Table macro uses `accessor`, not `name`
#[spacetimedb::table(name = "player", public)]
#[derive(Clone, Debug)]
pub struct PlayerData {
    #[primary_key]
    pub identity: Identity,
    // ...
}

// ctx.sender() is a METHOD in v2 (not a field)
// ctx.timestamp is still a FIELD (not a method)
let caller = ctx.sender();
let time = ctx.timestamp;
```

### Client (TypeScript)
```typescript
// Package is "spacetimedb" (not @clockworklabs/spacetimedb-sdk)
import { DbConnection, EventContext, ErrorContext } from './generated';
import { PlayerData, InputState } from './generated/types';

// Connection — use withDatabaseName (not withModuleName), add withConfirmedReads(false)
DbConnection.builder()
  .withUri('ws://localhost:3000')
  .withDatabaseName('vibe-multiplayer')
  .withConfirmedReads(false)  // v2 defaults to confirmed reads — this reduces latency
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .build();

// Tables are PROPERTY access (no parentheses)
conn.db.player.onInsert(callback);  // correct
conn.db.player.iter();              // correct

// Reducers take a SINGLE OBJECT argument
conn.reducers.registerPlayer({ username, characterClass });
conn.reducers.updatePlayerInput({ input, clientPos, clientRot, clientAnimation });

// Subscriptions: register callbacks BEFORE subscribing (backfill fires immediately in v2)
conn.subscriptionBuilder()
  .onApplied(() => { /* ... */ })
  .onError((err) => { /* ... */ })
  .subscribe('SELECT * FROM player');
```

## Deployment

### Vercel (Frontend) + SpacetimeDB Cloud (Backend)

The client deploys to Vercel. The Rust WASM backend runs on SpacetimeDB Cloud.

**Live database:** `vibe-3d-multiplayer` on `maincloud.spacetimedb.com`
**Dashboard:** https://spacetimedb.com/vibe-3d-multiplayer

```bash
# 1. Build + publish server to SpacetimeDB Cloud
cd server
spacetime build
spacetime publish vibe-3d-multiplayer -y
spacetime generate --lang typescript --out-dir ../client/src/generated --module-path .

# 2. Deploy client to Vercel
vercel --prod
```

### Connection Configuration

App.tsx auto-detects local vs production:
- **Local dev** (`localhost`): connects to `ws://localhost:3000`
- **Vercel/production**: connects to `wss://maincloud.spacetimedb.com`

Environment variables (set in Vercel dashboard):
```
VITE_SPACETIMEDB_URI=maincloud.spacetimedb.com
VITE_SPACETIMEDB_NAME=vibe-3d-multiplayer
```

## Development Commands

```bash
# Server (local dev)
cd server
spacetime build                    # Compile Rust → WASM
spacetime start                    # Start local SpacetimeDB server (port 3000)
spacetime publish vibe-3d-multiplayer # Publish to cloud (or use local alias)

# Server (cloud publish — after schema changes)
cd server
spacetime build
spacetime publish vibe-3d-multiplayer -y
spacetime generate --lang typescript --out-dir ../client/src/generated --module-path .

# Client
cd client
npm run dev                        # Vite dev server (localhost:5173)
npm run build                      # Production build

# Load testing
npm run simulate                   # 10 bots, 10 seconds (against localhost)
VITE_SPACETIMEDB_URI=maincloud.spacetimedb.com npm run simulate -- 50 30  # against cloud
```

## Critical Conventions

- **Stale closure avoidance**: Use `useRef` for identity, localPlayer, connected status — React state captured in `useCallback` goes stale. See `identityRef`, `localPlayerRef`, `connectedRef` in App.tsx.
- **sendInputRef pattern**: Wrap `sendInput` in a ref so the game loop `useEffect` doesn't restart on every state change.
- **Client-side prediction**: Uses actual frame `dt` from `useFrame`, NOT a fixed `SERVER_TICK_DELTA`. Speed constants must match server (`PLAYER_SPEED = 7.5`).
- **Register callbacks before subscribing**: In v2, table backfill fires immediately on subscribe. If callbacks aren't registered yet, you miss the initial data.
- **Game loop at 20Hz**: The `requestAnimationFrame` loop in App.tsx throttles input sends to every 50ms. Server `delta_time_estimate = 1/20` matches this.
- **FBX models**: Wizard scale `0.02`, Paladin scale `1.0`. Models in `client/public/models/`.
- **Connection config**: Auto-detected in `App.tsx` and `simulation.ts` via env vars + `window.location.hostname` check. Falls back to `maincloud.spacetimedb.com` for non-localhost.

## Schema Changes

Adding/removing table columns requires deleting and republishing the database:
```bash
cd server
spacetime delete vibe-3d-multiplayer
spacetime publish vibe-3d-multiplayer -y
spacetime generate --lang typescript --out-dir ../client/src/generated --module-path .
```
