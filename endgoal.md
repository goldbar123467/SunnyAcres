# Sunny Acres — End Goal

A competitive multiplayer farming-and-trading game in TypeScript. The world runs on **globally synchronized 2-week seasons** aligned to **UTC**. At every reset every active player is reshuffled into a new **room of 8** for the next season. Each player produces goods on their farm and **trades them on a shared limit-order book** against the other 7 players. Random events shake the market throughout the season. **Whoever has the highest net worth at season end wins.**

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
2. **Two-week competitive seasons, globally synchronized in UTC.** Hard start, hard end, fresh leaderboard each season. At every reset every player is reshuffled into a new room of 8.
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

Seasons are **globally synchronized** in **UTC**. There is one canonical season cadence; everyone in the world is in the same epoch.

- **Cadence:** seasons last exactly **14 days**, starting and ending at **00:00 UTC**. A new season begins the instant the previous one closes — no gap, no overlap.
- **Reshuffle at every reset:** at each season boundary every active player is **reshuffled into a new room of up to 8**. No one carries a cohort across seasons. Matchmaking is a single global pairing pass at `00:00 UTC` of the start day.
  - Pool = every player who has logged in within the last N days (tunable, e.g. 14).
  - Buckets of 8 by registration order / shuffled / lightly skill-grouped (start with random; can add MMR later).
  - Players who first log in mid-season are dropped into an existing room with a free seat (or a late-join room), but **at the next reset they're re-shuffled with everyone else**.
- **Day 0 (00:00 UTC of start day):** all players seeded with equal starting cash, identical empty farm, fresh book. Event schedule for the season is generated server-side from a per-season seed.
- **Day 1–13:** real-time play, wall clock. Production timers and event windows are absolute UTC timestamps so it doesn't matter when a player logs in or how often.
- **Day 14 (00:00 UTC of end day):** market freezes. Open orders cancel and refund escrow. Inventories liquidated at last-trade price (with an NPC floor for illiquid items). Final net worth written to `leaderboards`. Season archived.
- **Reset (same instant):** new season opens, global reshuffle runs, everyone joins their new room.
- **Bots only when needed:** if a room has fewer than 4 humans, NPC market-maker bots are added to keep the book functional. Above that threshold, no bots — pure human-vs-human.

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
- Season lifecycle aligned to UTC: open → active → settling → closed, on a 14-day cadence with a hard `00:00 UTC` boundary.
- Global reshuffle pass at each reset: every active player goes into a new room of up to 8.
- Late joiners drop into an open seat for the current season; rejoined at the next reset.
- Final scoring + leaderboard write.
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

- **Late joiners:** drop into an existing in-progress room with a free seat, or sit in a "waiting room" until the next reset? Leaning: drop in, with a small catch-up cash bonus scaled to elapsed time.
- **Reshuffle skill grouping:** pure random, or lightly MMR-grouped from prior seasons' net worth ranks? Start random; revisit once we have data.
- **Anonymous accounts at season start:** allow play without email, upgrade later? Probably yes.
- **Settlement price:** last trade, end-of-season VWAP, or NPC buyback at floor? Probably last trade with an NPC floor for illiquid items.
- **Public order book vs. partially anonymized:** show counterparties or hide them? Leaning hidden until a trade fills.
