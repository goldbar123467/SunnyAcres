# Sunny Acres — End Goal

A cozy, multiplayer farming game in TypeScript where up to **8 players share a server**, each runs their own farm, but their economies are interconnected: prices, supply, demand, trades, sabotage, gifts, and shared events all ripple between players.

The current `sunny-acres.html` is the single-player prototype. Everything below is the target shape we're building toward.

---

## Pillars

1. **Cozy core loop preserved.** Plant, tend, animals, buildings, orders, levels — the existing single-player feel is the foundation.
2. **8-player shared server.** Authoritative server state, real-time presence, deterministic time/ticks.
3. **Economic interdependence.** A player's choices visibly move the world for the other 7.
4. **Persistent + resumable.** Supabase-backed; offline progress reconciled at login.
5. **Cheat-resistant.** Server is source of truth; client only proposes intents.

---

## Target Architecture

```
┌────────────────┐     WebSocket      ┌──────────────────┐
│ Web client     │  ───────────────▶  │ Game server      │
│ (TS + Vite +   │  ◀───────────────  │ (Node + TS +     │
│  Canvas/DOM)   │     state diffs    │  Colyseus or ws) │
└────────────────┘                    └────────┬─────────┘
        │ Supabase auth (JWT)                  │
        │                                      │ Postgres rows + RLS
        └──────────────► Supabase ◀────────────┘
                        (Auth, Postgres, Realtime, Storage)
```

- **Client:** TypeScript, Vite, no framework lock-in (start with vanilla DOM port of current game, room for Phaser/Pixi later).
- **Server:** Node + TypeScript. Authoritative tick loop. Rooms of up to 8 players. Likely **Colyseus** (rooms, state sync, presence built in) — alternative: bare `ws` if we want full control.
- **DB:** Supabase Postgres. Tables for `players`, `farms`, `inventories`, `orders`, `market_listings`, `trades`, `events`, `server_state`. RLS so a client can only read its own private rows; shared market/event tables readable by all.
- **Auth:** Supabase Auth (email magic link or anonymous to start). JWT passed to game server.

---

## Multiplayer Economy — How Players Influence Each Other

The "influence" layer is what differentiates this from 8 parallel single-player games. Mechanics, in rough order of complexity:

- **Shared marketplace.** Listing crops/goods sets price; buyers across the server consume listings. Glut → prices fall.
- **Buy orders / contracts.** Players post "I'll pay X for Y by deadline." Others fulfill.
- **Co-op town orders.** Server-wide objectives (deliver 100 bread). Rewards split by contribution.
- **Gifts & trades.** Direct player-to-player resource transfers, optionally rate-limited.
- **Reputation & favors.** Helping fulfill someone's order builds rep, unlocks discounts.
- **World events.** Weather, blights, festivals — shared across the server, time-boxed, push prices.
- **Optional friction (later, opt-in):** crow attacks redirected to neighbors, market manipulation, sabotage with cooldowns. Disabled by default to preserve cozy feel.
- **Visiting.** View other farms read-only; leave kudos / water a friend's plot.

---

## Phased Roadmap

Each phase ends with something runnable and demoable. Don't start phase N+1 until N is solid.

### Phase 0 — Repo scaffold *(setup)*
- Monorepo layout: `apps/client`, `apps/server`, `packages/shared` (types, game rules, constants).
- TypeScript, ESLint, Prettier, Vitest. Vite for client. tsx/tsup for server.
- Port the existing `sunny-acres.html` styles/markup into the client app, untouched gameplay.

### Phase 1 — Single-player TS port *(parity)*
- Move game state, items, crops, animals, buildings, orders into `packages/shared` as typed modules.
- Pure functions for tick / harvest / craft / fulfill so the same code can run client- or server-side.
- localStorage save still works. **No multiplayer yet.** Goal: zero behavior change vs. the HTML file.

### Phase 2 — Supabase auth + cloud save *(identity)*
- Supabase project, `players` and `farms` tables, RLS.
- Login (anon → upgradable email). Save/load farm state to Postgres on tick boundaries.
- Still single-player; just no more localStorage-only.

### Phase 3 — Server authority, 1 player per room *(plumbing)*
- Stand up game server (Colyseus). Client connects via WS, sends intents (`PLANT`, `HARVEST`, `CRAFT`, `FULFILL`), server runs the shared tick logic and broadcasts state.
- Persistence to Supabase on interval + disconnect.
- Anti-cheat baseline: server validates every intent.

### Phase 4 — 8-player rooms, presence *(multiplayer arrives)*
- Matchmaking: join existing room with <8 players or create one.
- See other players' avatars, names, online state, level.
- Visit other farms (read-only).
- Chat or emotes (lightweight).

### Phase 5 — Shared marketplace *(first economic link)*
- `market_listings` table + server-side order book.
- List goods → others buy. Prices visible to all. Server-enforced taxes/fees.
- Listing fees and stack limits to prevent spam.

### Phase 6 — Contracts, gifts, reputation *(deeper interdependence)*
- Player-issued buy orders with deadlines and escrow.
- Direct gift sends with daily caps.
- Reputation score affecting fees and unlocking cosmetic perks.

### Phase 7 — Town goals + world events *(server feels alive)*
- Server-wide co-op orders with contribution tracking and split rewards.
- Scheduled events (harvest festival, drought) modifying drop rates and prices.
- Daily/weekly resets where appropriate.

### Phase 8 — Polish, balance, optional friction *(longevity)*
- Balance pass with telemetry from real sessions.
- Optional opt-in PvP-lite (sabotage, market manipulation) gated behind room settings.
- Cosmetics, seasons, achievements.

---

## Non-Goals (for now)

- Real-money transactions.
- Mobile-native apps (web-first; mobile web should still feel decent).
- Procedural worlds — fixed grid per farm is fine.
- Voice chat.

---

## Open Questions

- **Server framework:** Colyseus (batteries included) vs. raw `ws` + custom protocol. Leaning Colyseus.
- **Tick model:** real-time crop timers (current) vs. discrete server ticks. Probably keep real-time but snap to server clock.
- **Hosting:** Fly.io / Railway / Render for the Node server; Supabase hosted. Decide before Phase 3.
- **Anonymous vs. required accounts** at launch.
