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
- **Auth:** Supabase Auth. **Account required** — sign up before playing. Account identity is what matchmaking groups players by (no anonymous play, no throwaway sessions).

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
- **Reshuffle at every reset:** at each season boundary every account in the active pool is **reshuffled into a new room of up to 8**. No cohort carries across seasons. Matchmaking is a single global pairing pass at `00:00 UTC` of the start day.
  - Pool = every account that has logged in within the last N days (tunable, e.g. 14).
  - Buckets of 8 — start with random shuffle, can add light MMR grouping later.
- **Late joiners (mid-season signups or returners):** dropped into an **existing room that isn't full yet**, in the order they arrive. If every current room is full, a fresh "overflow" room is opened and gets filled by subsequent late joiners until it too has 8.
  - At the next reset they go back into the global shuffle with everyone else.
  - A small catch-up cash grant scaled to elapsed season time keeps them competitive without dominating.
- **Day 0 (00:00 UTC of start day):** all players seeded with equal starting cash, identical empty farm, fresh book. Event schedule for the season is generated server-side from a per-season seed.
- **Day 1–13:** real-time play, wall clock. Production timers and event windows are absolute UTC timestamps so it doesn't matter when a player logs in or how often.
- **Day 14 (00:00 UTC of end day):** market freezes. Open orders cancel and refund escrow. Inventories liquidated at last-trade price (with a static per-item floor for items that never traded). Final net worth written to `leaderboards`. Season archived.
- **Reset (same instant):** new season opens, global reshuffle runs, everyone joins their new room.
- **Humans only.** No AI / NPC players in scope. A room with 1 player simply has a sparse book until more humans join; that's accepted as part of early-stage seasons.

---

## Events & Randomization

Designed so the same strategy never wins twice. Each season picks a subset.

**Global, not per-room.** Events fire across **every room simultaneously** at fixed UTC timestamps for the season. Every player in the world experiences the same blight at the same moment. The schedule is generated once at season open from a single per-season seed, written to the `events` table, and broadcast to every room. This creates shared player-base narrative ("remember the day-7 drought?") without per-room RNG variance affecting fairness.

- **Blight:** target crop dies in plots, supply spikes scarce → price up.
- **Bumper crop:** target crop grows 2× speed for N hours → glut → price down.
- **Festival:** demand for specific cooked good (server posts time-limited buy orders at premium prices — a fixed event, not a player agent).
- **Drought:** all crops slower; water tokens become valuable.
- **Tax day:** flat % of cash skimmed; encourages staying in inventory.
- **Trade embargo:** an item halts trading for X hours.
- **Caravan:** the server posts a single large buy or sell at an off-market price (a one-shot event order, not an AI trader).
- **Reveal:** a future event is announced 24h ahead — info edge.

Events are seeded per season for replayability and fairness.

---

## Phased Roadmap

Each phase ends with something runnable. The order is built around **getting the order book live as fast as possible**, since that's the whole game.

Each phase has an explicit **exit test**. Don't move on until it passes.

### Phase 0 — Repo scaffold *(setup)*
- npm workspaces: `apps/client`, `apps/server`, `packages/shared`.
- TypeScript, ESLint, Prettier, Vitest. Vite for client. tsx for server dev, tsup for builds.
- `.env.example` for Supabase URL/keys. Cloudflare-tunnel-ready (server binds `0.0.0.0:PORT`, no host header coupling).
- **Exit test:** `npm run dev` from root brings up an empty client and a stub server; `npm test` runs (zero tests) green; lint passes.

### Phase 1 — Single-player TS port + frozen catalog + start screen *(production engine + first impression)*
- Lift items, crops, animals, buildings, recipes from `sunny-acres.html` into `packages/shared` as typed modules and pure functions.
- **Freeze the v1 tradable item catalog** (6–10 items, with declared starting seed/feed allowances and untradable seed shop prices).
- Client renders the farm in TS with the same look. localStorage save.
- **Start screen** (landing): title, pitch line, UTC reset countdown placeholder, sign-up CTA stub (no auth wired yet — that's Phase 3), "How to play" entry.
- **First-run intro popup sequence** (the 4-step explainer), with "Don't show again" persisted in localStorage.
- **Exit test:** new browser session lands on start screen; clicking play shows intro popups once; full single-player session (plant → harvest → craft → fulfill order) plays with no regressions vs. the HTML; catalog frozen and reviewed.

### Phase 2 — Order book engine in `shared` *(the core, headless)*
- Pure-TS `OrderBook` class: place, cancel, match, snapshot, depth, last-trade.
- Includes self-trade prevention, integer prices/qty, escrow accounting, position limits, taker-fee burn.
- Property-style tests: cash + inventory + escrow conserved across thousands of randomized intent sequences.
- **Exit test:** Vitest suite covers price-time priority, partial fills, cancellation, self-trade rejection, position-limit rejection, and conservation; all green; engine has zero network/UI deps.

### Phase 3 — Server skeleton + Supabase *(plumbing)*
- Colyseus room, JWT auth via Supabase, account-required login flow on client.
- Tables created with RLS: `players`, `seasons`, `season_players`, `farms`, `inventories`, `orders`, `trades`, `events`, `leaderboards`.
- Snapshot + journal pipeline: every intent journaled before broadcast; 30s snapshots; recovery path implemented and tested.
- **Exit test:** kill the server mid-session; restart; client reconnects and sees identical farm state, identical open orders, no duplicate fills.

### Phase 4 — Order book live in a room + tutorial *(MVP playable)*
- Wire `OrderBook` into the Colyseus room. Intents: `PLACE_ORDER`, `CANCEL_ORDER`. Broadcast top-of-book + recent trades + own orders.
- Order-book UI: ladder, my orders, my inventory, my cash, trade tape.
- Order rate limit + min time-in-book enforced server-side.
- **Scripted tutorial** runs against a local sandbox (no server connection): plant → harvest → place sell → place buy → scripted fill → cancel → leaderboard glance. Replayable from menu.
- **Contextual tooltips** wired for first-time-seen UI elements; "seen" flags persisted per account.
- **Exit test:** brand-new account lands on start screen → completes intro popups → completes tutorial → joins a hardcoded "season" with up to 7 others → places, fills, and cancels orders successfully; abuse attempts (self-trade, spam, oversell) all rejected.

### Phase 5 — Seasons, matchmaking, AFK, leaderboard *(competitive shape)*
- Season lifecycle aligned to UTC, 14-day cadence, 00:00 UTC boundaries.
- Global reshuffle pass at each reset; late joiners fill not-yet-full rooms in arrival order.
- 48h AFK rule: seat freed, state preserved, restored on return.
- Final scoring (cash + inventory at last-trade with per-item floor) → `leaderboards`.
- Live in-room leaderboard updated on fills.
- **Start-screen integration:** real UTC reset countdown, real current-season-day indicator, real sign-up/log-in flow.
- **Late-joiner re-orientation banner** (current day, time to settlement, catch-up grant, recent event highlights).
- **End-of-season screen** with final standings + countdown to next reshuffle.
- **Exit test:** simulated short-cadence season (e.g. 1h "season" with reset) end-to-end: open → active → settle → close → reshuffle → new season; rosters change; leaderboard frozen for old season; AFK seat-frees observed; late joiner sees re-orientation banner; end-of-season screen shows correct standings.

### Phase 6 — Global events *(volatility)*
- Event scheduler runs per-season seed at season open; events fire at fixed UTC timestamps **across every room simultaneously**.
- Catalogue: blight, bumper crop, festival, drought, tax day, embargo, caravan, reveal.
- Event log visible to players; reveal events show upcoming events 24 h ahead.
- **No AI traders.** Festival/caravan post fixed server-issued orders.
- **Exit test:** two rooms in the same season see the same event timeline; effects applied identically; tape and event log show synchronized timestamps.

### Phase 7 — In-room chat, polish, balance *(longevity)*
- Per-room text chat with rate limit and basic moderation hooks.
- Tutorial polish pass (timings, copy, illustrative thumbnails).
- Telemetry on real seasons: price curves, win rates, item utilization.
- Balance pass on production rates, fees, position limits, event severity.
- **Exit test:** new account completes start screen → intro popups → tutorial → first season join in <10 min; one full real 14-day season runs without manual intervention; balance review writeup committed.

### Phase 8 (post-v1) — Stretch *(explicitly v2 territory; do not start during v1)*
- Market / stop / iceberg orders, forward contracts.
- Cosmetics, achievements, cross-season ranks.
- MMR-grouped reshuffle.
- Opt-in friction (sabotage, alliances).
- Horizontal scaling.

---

## Economy & Monetary Policy

The room is a closed economy. We pin the rules so balance work in Phase 7 has something to push against.

- **Money sources:** day-0 starting cash (equal for everyone), late-joiner catch-up grant (capped, scaled to elapsed time), event payouts (festival premium fills), tax-day rebates if any. Nothing else mints coins.
- **Money sinks:** taker fees on every trade, tax-day skim, listing/cancel fees if Phase 7 balance needs them.
- **Fee destination:** **burned** in v1 — leaves the room economy entirely. Simplest mental model, no "pot" UI to design.
- **Settlement:** at season end, inventory is marked at last-trade price; items that never traded use a static per-item floor (a constant in code, not an in-game buyer).

## Item Catalog & Inputs

Tradable items are declared in `packages/shared` as typed constants. Phase 1 freezes the v1 catalog before order-book work starts.

- **v1 catalog target:** 6–10 items spanning raw crops, animal products, and crafted goods, drawn directly from `sunny-acres.html`.
- **Seeds and inputs:**
  - Each player starts day 0 with a small **seed and feed allowance** so a first plant is possible without trading.
  - Seeds are **not tradable in v1** — bought from a fixed-price NPC seed shop (constant prices, not an order book). Removes a degree of freedom we don't need yet.
  - Crafted goods (bread, cheese, …) are tradable; their inputs (wheat, milk) are tradable.
- **Position limits per item** are static numbers in the catalog, picked in Phase 7 balance pass.

## Anti-Cheat Baseline (v1)

The server is the source of truth; this section names the specific abuses we close before launch.

- **One account = one season seat.** Enforced by `auth_user_id` uniqueness on `season_players`.
- **Self-trade prevention.** Orders from the same account never match — incoming aggressor against own resting order is rejected at the engine, not the API.
- **Order rate limit.** Per-account cap (e.g. 10 placements + cancels per second) to kill spoof/spam.
- **Min time-in-book** (e.g. 250 ms) before a resting order can be cancelled, to deter quote-stuffing.
- **All intents server-validated.** Cash, inventory, position-limit, and item-existence checks on every `PLACE_ORDER`. Client never authoritative.
- **Out of v1 scope:** cross-account collusion detection, multi-accounting via separate emails, anti-bot behavioral analysis. Logged as v2.

## Persistence, Crash Recovery, and AFK

A 14-day persistent room must survive Node restarts and idle players without losing state.

- **Snapshot + journal model.**
  - **Journal:** every accepted intent and every fill is written to Postgres synchronously before the room broadcasts a confirmation. This is the source of truth.
  - **Snapshot:** full room state (order books, inventories, cash, farms) written every 30 s and on graceful shutdown.
  - **Recovery:** on server boot, each active room rehydrates from latest snapshot, then replays journal entries since that snapshot.
- **Persistence granularity:** journal-on-fill is non-negotiable; everything else (production timers, UI state) is snapshot-only.
- **AFK / inactivity:** if an account is offline for **48 h continuous**, its seat is freed for late joiners. Its farm state, open orders, and inventory are preserved and restored if it returns before the season ends. Open orders **stay live** in the book during AFK — escrow already covers the risk.
- **Reconnect:** on rejoin, client receives latest snapshot diff for its account plus the public top-of-book; resumes seamlessly.

## Live Information & Communication

Strategy is shaped by what players can see and say.

- **Live leaderboard:** visible in-room during the season, updated on each fill. Net worth = cash + inventory at last-trade price. This is intentional pressure on the leader.
- **Counterparty privacy:** order book is **anonymous while resting**. After a fill, both sides see who they traded with. (Inside one 8-player room, full anonymity is fragile anyway.)
- **In-room chat:** simple text channel per room, server-moderated rate-limited. v1 includes chat; emotes/reactions are v2. No cross-room or global chat in v1.
- **Trade tape:** public log of recent trades (price, qty, time, counterparties post-fill) visible to the room.

## Client UX Notes

- **Internal time = UTC.** Always. Timers, event windows, season boundaries.
- **Display = local time** with a visible UTC countdown to next reset on every screen.
- **Mobile web is supported but not optimized.** Order book ladder collapses gracefully; no native apps.

## Start Screen, Intro Popups, Tutorial

The first 60 seconds determine whether a new player understands what they're playing. v1 includes a real onboarding flow, not a TODO.

- **Start screen (pre-auth landing).**
  - Game title art, one-line pitch ("Farm. Trade. Win the season."), a live **countdown to next UTC reset**, and current-season-day indicator if mid-season.
  - Primary CTA: **Sign up / Log in** (Supabase auth). Secondary: **How to play** (opens tutorial walkthrough without an account, read-only).
  - Footer: changelog/version, link to rules, status indicator (server up/down).
- **First-run intro popups (post-auth, before first lobby join).** A short modal sequence — skippable, but on by default — that establishes:
  1. *The world resets every 14 days at 00:00 UTC; you'll be reshuffled with new players.*
  2. *Your farm produces goods. Goods get traded with the 7 other humans in your room.*
  3. *Highest net worth on day 14 wins. Events along the way will move prices.*
  4. *Your inputs are seeds and feed; cash and inventory are escrowed when you place orders.*
  Each popup ≤ 2 sentences + one illustrative thumbnail. "Don't show again" checkbox.
- **Scripted tutorial.** Interactive, no other players, no bots. Runs against a local sandbox state so it can't pollute the real account.
  - Steps: plant a crop → wait/skip a timer → harvest → look at the order book → place a sell limit → place a buy limit → see a fill (driven by the script, not an AI) → cancel an order → check leaderboard.
  - Replayable any time from the menu.
- **Contextual tooltips in-game.** First time you open the order book, build a building, or see an event banner, a single tooltip explains it. Stored "seen" flags per account. No tooltip ever blocks input.
- **Re-orientation banner for late joiners.** If you join mid-season, the room shows a banner with: current day, time to settlement, your catch-up grant amount, and a "what's happened" summary (event log highlights). One-time, dismissible.
- **End-of-season screen.** Final standings, your rank, key stats (best trade, biggest position, total fills), and a countdown to the next season's open and reshuffle.

## Scope Boundary — v1 vs v2

Locking this so we don't bleed.

**v1 (this `endgoal.md`):**
- Account, 8-player UTC seasons, reshuffle, late-join fill, server-authoritative limit-order book, escrow, fees, position limits, global events, settlement, leaderboard, in-room chat, snapshot+journal recovery, 48h AFK seat-freeing, anti-cheat baseline above, web client (mobile-okay).

**v2 and later (explicitly NOT v1):**
- Market / stop / iceberg orders, forward contracts.
- AI traders or market-maker bots of any kind.
- Cross-room or global chat, friends list, parties.
- Persistent cross-season progression (cosmetics, ranks, achievements).
- MMR / skill-based reshuffle.
- Sabotage, alliances, info-asymmetry events.
- Horizontal scaling across multiple Node hosts (single-host first; design lets us add a router later).
- Native mobile apps, voice chat.
- Collusion detection, multi-account detection.
- Real-money anything.

## Non-Goals (forever, not just v1)

- Real-money trading or wagering.
- Procedural farms — fixed grid is fine.
- Voice chat.

---

## Open Questions

- **Reshuffle skill grouping:** pure random, or lightly MMR-grouped from prior seasons' net worth ranks? Start random; revisit once we have data.
- **Catch-up grant size for late joiners:** linear in elapsed season time, or capped (e.g. max 50% of starting cash)? Probably capped to discourage waiting strategies.
- **Settlement price:** last trade, end-of-season VWAP, or a fixed floor for items that never traded? Probably last trade with a static per-item floor for illiquid items (still a constant, not an AI buyer).
- **Public order book vs. partially anonymized:** show counterparties or hide them? Leaning hidden until a trade fills.
