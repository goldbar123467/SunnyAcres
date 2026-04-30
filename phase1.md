# Phase 1 — Single-player TS port + frozen catalog + start screen

**Status:** draft for human review. Agents may execute against this once approved.
**Parent:** `endgoal.md` → "Phase 1 — Single-player TS port + frozen catalog + start screen".
**Prereq:** Phase 0 complete (workspaces, lint, vitest, vite all green).

---

## Goal (one line)

Port `sunny-acres.html` into the TS workspace with no gameplay regressions, freeze the v1 tradable item catalog as typed shared modules, and add the start screen + first-run intro popups.

## Pillar alignment

- **Pillar 5 (Production grounds the economy):** locks the supply side. Phase 2 (order book) cannot start until the catalog is frozen.
- **Onboarding spec in `endgoal.md`:** start screen + 4-popup intro are the *first 60 seconds* of a new player's experience. They must exist before any multiplayer surface.

---

## Scope IN

1. Lift `CROPS`, `ANIMALS`, `BUILDINGS`, `ITEMS` from `sunny-acres.html` into `packages/shared` as typed TS modules with pure functions for all derived state (grow time remaining, production progress, recipe cost, etc.).
2. Freeze the **v1 tradable item catalog** (table below) as a single exported constant in `packages/shared/src/catalog.ts`. No magic numbers anywhere else.
3. TS+Vite client in `apps/client` that renders the farm with **visual parity** to the HTML (same emojis, same panel layout, same colors). DOM/CSS port — no canvas rewrite.
4. localStorage save under key `sunny_acres_v1` (versioned), with migration stub from `farmville_save_v1` if present.
5. **Start screen** (pre-auth landing): title, pitch line, UTC reset countdown placeholder (static text "Next reset: TBD" — wired in Phase 5), **Play** CTA, **How to play** CTA stub.
6. **First-run intro popups** (4 steps, copy in §6) shown once on first play; "Don't show again" persisted in localStorage; replayable from a menu entry.
7. Vitest unit tests on every pure function lifted into `shared`.

## Scope OUT (do not implement in Phase 1)

- Auth, sign-up, log-in (Phase 3).
- Server, websockets, Colyseus (Phase 3).
- Order book UI, ladder, depth chart (Phase 4).
- Real UTC reset countdown (Phase 5 — render as placeholder string).
- Tutorial walkthrough (Phase 4).
- Contextual tooltips (Phase 4).
- Events, chat, leaderboard (Phase 5+).
- Animal feed *mechanic* — declare the allowance constant, but do not consume feed in single-player. HTML has no feed mechanic; we keep parity.
- Levels/XP changes — keep HTML's level/XP logic as-is for single-player parity. It will be stripped when wiring to multiplayer in Phase 4.
- Truck orders changes — keep HTML's truck-order system as-is for the exit-test "fulfill order" step. It is replaced by the order book in Phase 4.

---

## Workspace layout

Create / touch these files. Do not create files outside this list without updating this doc.

```
packages/shared/src/
  catalog.ts          # frozen v1 catalog (items, crops, animals, buildings, recipes, allowances)
  types.ts            # ItemId, CropId, AnimalId, BuildingId, RecipeId, etc.
  crops.ts            # pure: growTimeRemaining, isReady, harvestYield
  animals.ts          # pure: productionProgress, isProductReady
  buildings.ts        # pure: recipeCost, recipeProgress, canCraft
  save.ts             # SaveV1 schema, load/save/migrate
  index.ts            # re-exports

apps/client/src/
  main.ts             # entry, route between start-screen and game
  startScreen.ts      # landing UI
  introPopups.ts      # 4-step modal sequence
  game/
    farm.ts           # plot rendering + plant/harvest UI
    barn.ts           # animal rendering + collect UI
    production.ts     # building rendering + craft UI
    inventory.ts      # inventory tab
    shop.ts           # shop tab (seed shop = fixed prices)
    truckOrders.ts    # truck order panel (HTML parity)
    header.ts         # coins, level, XP bar
  styles/
    main.css          # ported from HTML <style> block, unchanged

packages/shared/test/
  catalog.test.ts
  crops.test.ts
  animals.test.ts
  buildings.test.ts
  save.test.ts
```

---

## Tasks (ordered)

1. **Catalog first.** Create `catalog.ts` with the frozen table in §5. All other code imports from here. No item data may live elsewhere.
2. **Types.** Define string-literal union types for every ID. No `string` ids in business code.
3. **Pure functions.** Lift `growTime`, `cooldown`, `recipe.time` math into pure functions in `crops.ts`/`animals.ts`/`buildings.ts`. Each takes `(state, now)` and returns derived data. No side effects. No DOM.
4. **Save schema.** Define `SaveV1` as a versioned discriminated union. Implement `load()` (handles missing + legacy `farmville_save_v1` → migrates → deletes legacy key), `save(state)` (debounced 5000ms, matches HTML), `wipe()`.
5. **Styles.** Copy the entire `<style>` block from `sunny-acres.html` verbatim into `apps/client/src/styles/main.css`. Do not refactor.
6. **Game UI.** Port each panel one at a time, keeping IDs and class names identical to the HTML so the styles still apply. Visual parity is the bar — diff a screenshot if uncertain.
7. **Start screen.** New screen at app entry. If save exists, show **Continue** + **New game**; otherwise show **Play**. Either CTA enters the game and triggers intro popups if not previously dismissed.
8. **Intro popups.** Build a small modal sequencer (4 steps, copy in §6). Persist `intro_dismissed: true` to localStorage on completion or "Don't show again". Add a "Replay intro" entry under a menu (gear icon, top-right of game).
9. **Tests.** Vitest covers every exported pure function. Save load/migrate round-trips a known fixture. No DOM tests required for Phase 1.
10. **Exit-test playthrough.** Run the manual exit test in §7 end-to-end before declaring done.

---

## v1 frozen catalog (the freeze)

Pulled directly from `sunny-acres.html`. Numbers are final for v1 unless a human edits this doc.

### Tradable items (8)

| id      | name    | emoji | settlement floor | unlock level |
|---------|---------|-------|------------------|--------------|
| wheat   | Wheat   | 🌾    | 4                | 1            |
| carrot  | Carrot  | 🥕    | 12               | 2            |
| corn    | Corn    | 🌽    | 25               | 3            |
| tomato  | Tomato  | 🍅    | 55               | 4            |
| egg     | Egg     | 🥚    | 8                | 2            |
| milk    | Milk    | 🥛    | 18               | 3            |
| bread   | Bread   | 🍞    | 18               | 2            |
| butter  | Butter  | 🧈    | 60               | 3            |

`unlock level` is single-player only and goes away in Phase 4. `settlement floor` will be used by Phase 5 end-of-season pricing for items that never trade; it equals HTML's `sellPrice`.

### Crops (planted on plots)

| id     | seedCost | growTime (s) | yield | xpOnHarvest |
|--------|----------|--------------|-------|-------------|
| wheat  | 2        | 10           | 2     | 1           |
| carrot | 5        | 25           | 2     | 3           |
| corn   | 10       | 45           | 2     | 6           |
| tomato | 20       | 90           | 2     | 12          |

### Animals (cooldown producers)

| id      | cost | productId | cooldown (s) |
|---------|------|-----------|--------------|
| chicken | 50   | egg       | 30           |
| cow     | 250  | milk      | 75           |

### Buildings (recipes)

| building | recipeId | input        | output | time (s) | xpOnCraft |
|----------|----------|--------------|--------|----------|-----------|
| bakery   | bread    | { wheat: 2 } | bread  | 20       | 4         |
| dairy    | butter   | { milk: 1 }  | butter | 30       | 8         |

Bakery cost: 150. Dairy cost: 400.

### Seed shop (untradable, fixed prices)

Same `seedCost` as crops table. Buying seeds is the only sink for cash that produces tradable supply.

### Day-0 starting allowances (declared now, used in Phase 4)

```ts
export const STARTING = {
  cash: 50,                         // matches HTML starting coins
  seeds: { wheat: 5 },              // enough for one plot row
  feed: { chicken: 0, cow: 0 },     // declared; not consumed in v1
} as const;
```

> Human review: confirm `cash: 50` and `seeds: { wheat: 5 }` are correct day-0 values for **multiplayer** as well as single-player. The single-player port itself uses HTML's existing 50 coins.

---

## Start screen spec

Single screen, single column, mobile-okay.

- **Title:** "Sunny Acres" (large, top).
- **Pitch line:** "Farm. Trade. Win the season." (immediately below title).
- **Countdown row:** "Next season reset: TBD" (placeholder string; Phase 5 wires real countdown).
- **Primary CTA:** **Play** (or **Continue** if `sunny_acres_v1` save exists, with **New game** as secondary).
- **Secondary CTA:** **How to play** — opens the intro popup sequence in read-only review mode (no localStorage write).
- **Footer:** version string from `package.json`, link "Rules" → static page (Phase 5), server status indicator placeholder.

No auth UI in Phase 1. The **Sign up / Log in** CTA from `endgoal.md` is added in Phase 3.

---

## Intro popups spec

4 steps. Each ≤ 2 sentences + one illustrative thumbnail (use a placeholder emoji at 96px for v1; real art in Phase 7). Modal blocks game until done; "Skip" closes all 4 at once.

1. **Reset cadence.** "The world resets every 14 days at 00:00 UTC. At each reset you're reshuffled into a new room with 7 other players." Thumbnail: 🔄
2. **Production loop.** "Your farm produces goods — crops, eggs, bread. Goods are how you make money." Thumbnail: 🌾
3. **The win.** "Highest net worth on day 14 wins the season. Random events will move prices along the way." Thumbnail: 🏆
4. **Inputs and escrow.** "You start with seeds, feed, and a little cash. When you place an order, your cash or inventory is held until it fills or you cancel." Thumbnail: 🔒

Footer of each popup: **Back** / **Next** (or **Done** on step 4) and a "Don't show again" checkbox (default unchecked).

---

## Persistence keys (localStorage)

- `sunny_acres_v1` — main save, JSON, schema = `SaveV1`.
- `sunny_acres_intro_dismissed` — `"true"` after first run.
- Legacy `farmville_save_v1` — read once, migrate, delete.

No other keys.

---

## Exit test (binary; all must pass)

Run as a fresh browser session in incognito.

1. ☐ Lands on start screen with title, pitch line, placeholder countdown, **Play** CTA visible.
2. ☐ Clicking **Play** triggers the 4 intro popups in order.
3. ☐ Completing or skipping the popups stores the dismissed flag; reloading the page and clicking **Continue** does **not** show popups again.
4. ☐ **How to play** from start screen replays the popups without setting any localStorage flag.
5. ☐ Plant wheat → wait → harvest → bake bread → fulfill a truck order → coins go up. No errors in console. Visual parity vs. HTML at each step.
6. ☐ Reload mid-game: state restored exactly (coins, plot timers, building progress, truck orders).
7. ☐ Hard refresh after **Reset Farm**: returns to start screen with **Play** (not **Continue**).
8. ☐ `npm test` green; `npm run lint` clean; `npm run build` produces a deployable `apps/client/dist`.
9. ☐ `packages/shared` has zero DOM/Vite imports (verified by `grep` in CI or by hand).
10. ☐ Catalog table in §5 reviewed and signed off by a human in this doc (initial here: ____).

---

## Open decisions for human review

These are flagged here rather than decided unilaterally. Edit this doc, then unblock the agent.

1. **Day-0 cash for multiplayer** — keep at 50 (matches HTML) or rebalance? Affects only Phase 4+; Phase 1 single-player uses 50 either way.
2. **Day-0 seeds** — `{ wheat: 5 }` is a guess for "enough to start trading without help". Confirm or override.
3. **Day-0 feed** — the HTML has no feed mechanic. Do animals consume feed in v1? If yes, that adds a Phase 4 mechanic; recommend **no** for v1, keep declaration at zero.
4. **Settlement floor = HTML sellPrice?** Recommend **yes** (it's the only honest "what's this worth alone" price we have). Confirm.
5. **Save migration** — hard-migrate `farmville_save_v1` silently, or prompt the user? Recommend silent; the player base is just you right now.
6. **Levels in single-player port** — keep (parity) or strip now to avoid carrying dead weight into Phase 4? Recommend **keep** for Phase 1, strip in Phase 4 with a clean cut.
7. **Start screen art** — placeholder text title for now, or block on real art? Recommend placeholder; art is Phase 7.

---

## Done means

- Exit test §7 passes 10/10.
- `endgoal.md` Phase 1 exit test ("plant → harvest → craft → fulfill order") passes against the TS client.
- Catalog in §5 has a human signature line filled in.
- `phase2.md` can begin without touching anything in `apps/client/` or `packages/shared/src/catalog.ts`.
