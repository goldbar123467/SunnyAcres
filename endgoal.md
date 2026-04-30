# Sunny Acres — End Goal

A competitive multiplayer farming-and-trading game in TypeScript. Players are auto-matched into **8-player seasons that run for two weeks**. Each player produces goods on their farm and **trades them on a shared limit-order book** against the other 7 players. Random events shake the market throughout the season. **Whoever has the highest net worth at season end wins.**

The current `sunny-acres.html` is the single-player production prototype — its crops/animals/buildings become the supply side of the new economy.

---

## The Core Loop

1. **Produce** on your farm (existing crop/animal/building system).
2. **Trade** what you produce on the order book — post limit buy/sell orders, hit other players' resting orders, manage inventory and cash.
3. **React** to events (blights, festivals, droughts, demand spikes, tax days) that shift supply and demand mid-season.
4. **Survive two weeks.** Highest net worth = cash + inventory marked-to-market at season close.

The single-player farm and the multiplayer order book are the *same* game — production feeds trading, trading funds production, and the only way to win is to do both well against 7 humans.

---

## Pillars

1. **Order book is the heart.** Real bid/ask matching, not a simple list of fixed-price stalls. Other players are the liquidity.
2. **Two-week competitive seasons.** Hard start, hard end, fresh leaderboard each season. Auto-matched into a server at season open.
3. **Events drive volatility.** Scheduled + random shocks make every season tell a different story.
4. **Server is authoritative.** Cheating the matching engine, inventory, or clock is impossible from the client.
5. **Production grounds the economy.** Goods come from farming, not thin air; supply is real and constrained.

---

## Target Architecture

```
┌────────────────┐     WebSocket      ┌──────────────────┐
│ Web client     │  ───────────────▶  │ Game server      │
│ (TS + Vite +   │  ◀───────────────  │ (Node + TS +     │
│  Canvas/DOM)   │   state diffs +    │  Colyseus)       │
└────────────────┘   order book feed  └────────┬─────────┘
        │ Supabase JWT                         │
        │                                      │ Postgres + RLS
        └──────────────► Supabase ◀────────────┘
                        (Auth, Postgres, Storage)
```

- **Client:** TypeScript + Vite. DOM/CSS port of current art for the farm view; new order-book UI (depth chart, ladder, recent trades, my orders, my inventory).
- **Server:** Node + TypeScript + **Colyseus**. One room = one season cohort (≤8 players). Holds the order book in memory, persists state to Postgres on each fill and on a periodic snapshot. Deployed on your server, exposed via Cloudflare tunnel on a subdomain.
- **DB (Supabase Postgres):**
  - `seasons` (id, starts_at, ends_at, status)
  - `season_players` (season_id, player_id, starting_cash, joined_at, final_net_worth)
  - `players` (id, display_name, auth_user_id)
  - `farms` (season_player_id, plots/animals/buildings JSON)
  - `inventories` (season_player_id, item_id, qty)
  - `orders` (id, season_id, player_id, item_id, side, price, qty, qty_filled, status, ts)
  - `trades` (id, season_id, item_id, price, qty, buy_order_id, sell_order_id, ts)
  - `events` (id, season_id, kind, payload, starts_at, ends_at)
  - `leaderboards` (season_id, player_id, rank, net_worth)
  - RLS: a player reads only their own farm/inventory/orders; `trades`, `events`, public order book aggregates readable by all in-season.
- **Auth:** Supabase Auth, anonymous to start, upgradable to email.

---

## Order Book Design (MVP)

- **Per-item book.** One book per tradable item (carrots, eggs, bread, …). Start with ~6–10 items.
- **Limit orders only** in MVP. Market orders = limit at top of book server-side.
- **Price-time priority.** Best price first, FIFO at same price.
- **Integer prices in coins**, integer quantities — no floats, no partial units.
- **Escrow on placement:** sell orders lock inventory, buy orders lock cash. Cancellation refunds.
- **Fee model:** small taker fee (e.g. 1%) routed to a season-end "town pot" or burned. Maker free to encourage liquidity.
- **Position limits per item** to prevent one whale cornering a market in MVP.
- **Public feed:** top N levels of bids/asks + last N trades broadcast to the room. Private feed: your own open orders + fills.

Stretch (post-MVP): market orders proper, stop orders, iceberg orders, a futures/contract item ("deliver 50 bread by day 10").

---

## Season Lifecycle

- **Matchmaking:** on login, join the next open season. New seasons spin up when one fills (or on a schedule). 1–8 players to start a season; below 8, NPC market-maker bots fill empty seats with mild liquidity (so a 3-player game still has a working book).
- **Day 0:** all players seeded with equal starting cash, identical empty farm, fresh book.
- **Day 1–13:** real-time play. Production timers run on wall clock; client can disconnect and reconnect.
- **Day 14:** market closes. Inventories liquidated at last-trade price (or VWAP) for scoring. Final leaderboard locked into `leaderboards`. Season archived; players can join the next.
- **Always-on:** at any moment there should be at least one joinable season.

---

## Events & Randomization

Designed so the same strategy never wins twice. Each season picks a subset.

- **Blight:** target crop dies in plots, supply spikes scarce → price up.
- **Bumper crop:** target crop grows 2× speed for N hours → glut → price down.
- **Festival:** demand for specific cooked good (NPC bots place aggressive buys).
- **Drought:** all crops slower; water tokens become valuable.
- **Tax day:** flat % of cash skimmed; encourages staying in inventory.
- **Trade embargo:** an item halts trading for X hours.
- **Caravan:** NPC posts a single large buy or sell at off-market price.
- **Reveal:** a future event is announced 24h ahead — info edge.

Events are seeded per season for replayability and fairness.

---

## Phased Roadmap

Each phase ends with something runnable. The order is built around **getting the order book live as fast as possible**, since that's the whole game.

### Phase 0 — Repo scaffold *(setup)*
- npm workspaces: `apps/client`, `apps/server`, `packages/shared`.
- TypeScript, ESLint, Prettier, Vitest. Vite for client. tsx for server dev, tsup for builds.
- `.env.example` for Supabase URL/keys. Cloudflare-tunnel-ready (server binds `0.0.0.0:PORT`, no host header coupling).

### Phase 1 — Single-player TS port *(production engine)*
- Lift items, crops, animals, buildings, recipes from `sunny-acres.html` into `packages/shared` as typed modules and pure functions.
- Client renders the farm in TS with the same look. localStorage save for now.
- Goal: zero gameplay regression vs. the HTML.

### Phase 2 — Order book engine in `shared` *(the core, headless)*
- Pure-TS `OrderBook` class: place, cancel, match, snapshot, depth, last-trade.
- Heavy unit tests with Vitest: price-time priority, partial fills, cancellation, escrow accounting.
- No network, no UI yet. This is the algorithm we'll bet the whole game on, so we test it before we wire it up.

### Phase 3 — Server skeleton + Supabase *(plumbing)*
- Colyseus room, JWT auth via Supabase, basic schemas.
- Tables: `players`, `seasons`, `season_players`, `farms`, `inventories`, `orders`, `trades`. RLS on private rows.
- Connect, identify, persist farm state. No trading yet.

### Phase 4 — Order book live in a room *(MVP playable)*
- Wire `OrderBook` into the Colyseus room. Intents: `PLACE_ORDER`, `CANCEL_ORDER`. Broadcast top-of-book + recent trades.
- Order-book UI: ladder, my orders, my inventory, my cash.
- 1–8 players can join a single hardcoded "season," produce on their farm, and trade.

### Phase 5 — Seasons & matchmaking *(competitive shape)*
- Season lifecycle: open → active → settling → closed. Auto-create new season when full or on schedule.
- Auto-match on login. Final scoring + leaderboard write.
- Reconnect: rejoin in-progress season, see your open orders restored from DB.

### Phase 6 — Events & NPC liquidity *(volatility + filler)*
- Event scheduler with the catalogue above. Effects applied server-side.
- NPC market-maker bots that quote mild bid/ask spreads on each item to keep the book functional in low-population seasons.
- Event log visible to players.

### Phase 7 — Polish & balance *(longevity)*
- Telemetry on real seasons: price curves, win rates, item utilization.
- Balance pass on production rates, fees, position limits, event severity.
- Cosmetics, achievements, season banners. Optional voice/chat or emotes.

### Phase 8 — Stretch order types & deeper PvP
- Market / stop / iceberg orders.
- Forward contracts ("deliver X by day Y").
- Opt-in friction: sabotage, info-asymmetry events, alliances. Off by default.

---

## Non-Goals (for now)

- Real-money trading or any wagering. In-game coins only.
- Persistent cross-season wealth (each season is a fresh start; only ranks/cosmetics persist).
- Mobile-native apps. Web-first, mobile web should still feel okay.
- Procedural farms — fixed grid is fine.

---

## Open Questions

- **Tick rate / time scale:** does a "day" in the 2-week season equal a real day, or do we compress (e.g. 14 in-game days over 14 real days but with shorter production timers)? Leaning real-time = real-time.
- **Anonymous accounts at season start:** allow play without email, upgrade later? Probably yes.
- **Bot count:** always fill empty seats with bots, or only below a threshold? Leaning: bots only when <4 humans.
- **Settlement price:** last trade, end-of-season VWAP, or NPC buyback at floor? Probably last trade with an NPC floor for illiquid items.
- **Public order book vs. partially anonymized:** show counterparties or hide them? Leaning hidden until a trade fills.
