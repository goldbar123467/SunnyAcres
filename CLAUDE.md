# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Sunny Acres is a competitive multiplayer farming-and-trading game in TypeScript. The end goal (`endgoal.md`) is an 8-player UTC-synced 2-week season game with a server-authoritative limit-order book. The current `sunny-acres.html` (root) is the single-player prototype whose production rules become the supply side of the multiplayer economy. **Read `endgoal.md` and the relevant `phaseN.md` before making non-trivial changes.**

## Repo state (current)

Pre-scaffold. The repo holds only:
- `endgoal.md` — full v1 spec.
- `phase1.md` — active phase doc (single-player TS port + frozen catalog + start screen).
- `sunny-acres.html` — single-file vanilla-JS prototype (~2100 lines). Source of truth for catalog data and visual parity.
- No npm workspaces, no client, no server, no shared package yet. Phase 0 (the scaffold) is a prerequisite for Phase 1 and has not been done.

## Phased roadmap (from `endgoal.md`)

0. Repo scaffold (npm workspaces, TS, ESLint, Prettier, Vitest, Vite, tsx, tsup).
1. **Active.** Single-player TS port + freeze v1 tradable item catalog + start screen + intro popups.
2. Pure-TS `OrderBook` engine in `packages/shared`.
3. Server skeleton + Supabase auth/persistence (Colyseus).
4. Order book live in a Colyseus room + scripted tutorial.
5. Seasons / matchmaking / AFK / leaderboard.
6. Global events.
7. Chat / polish / balance.

Each phase has a binary exit test in its phase doc — do not declare done until every box passes.

## Target workspace layout

```
apps/client/        # Vite + TS web client (Phase 1+)
apps/server/        # Node + TS + Colyseus (Phase 3+; do not touch in Phase 1)
packages/shared/    # Pure TS — catalog, types, pure functions, order book.
                    # MUST have zero DOM/Vite imports (CI-checked or grep-checked).
```

## Phase 1 ground rules

- **Catalog is frozen in `packages/shared/src/catalog.ts`.** Numbers come from the `phase1.md` §"v1 frozen catalog" tables, which were lifted from `sunny-acres.html`. No item data anywhere else; no magic numbers in business code.
- **HTML's `sellPrice` is renamed `settlementFloor`** in TS — same value, semantic role for Phase 5 settlement.
- **String-literal union types** for every ID (`CropId`, `AnimalId`, `BuildingId`, `ItemId`, `RecipeId`). No bare `string` ids in business code.
- **Pure functions** in `crops.ts` / `animals.ts` / `buildings.ts` take `(state, now: number)`, return derived data, no DOM, no side effects.
- **Visual parity.** Port the HTML `<style>` block verbatim into `apps/client/src/styles/main.css`; keep DOM IDs and class names identical so styles still apply. No canvas rewrite, no CSS refactor.
- **Truck orders** — port verbatim from HTML for the Phase 1 exit test ("fulfill an order"). Replaced wholesale by the order book in Phase 4.
- **Levels/XP** — kept verbatim for Phase 1 single-player parity. Stripped in Phase 4.
- **Animal feed** — declare allowance constant; do not consume in v1 (HTML has no feed mechanic).

## Persistence keys (localStorage)

- `sunny_acres_v1` — main save, JSON, schema = `SaveV1`.
- `sunny_acres_intro_dismissed` — `"true"` after first-run intro completion or Skip. Use this exact key; do not abbreviate.
- `farmville_save_v1` — legacy. Read once, migrate, delete (silent; no UI prompt).

No other keys.

## Open decisions in `phase1.md`

`phase1.md` §"Open decisions for human review" contains items the agent must NOT decide unilaterally — most importantly the intro-popup copy choice (a/b/c). When unsure, ask; do not pick.

## Common commands (after Phase 0 scaffold lands)

Phase 0 will define these; expected shape:
- `npm install` at repo root (workspaces).
- `npm run dev` — runs client (and later server).
- `npm test` — Vitest across packages.
- `npm run lint` — ESLint clean.
- `npm run build` — produces deployable `apps/client/dist`.

Until Phase 0 is in place, none of the above exist.

## Branching

Develop on `claude/init-phase-one-tQaUR`. Never push elsewhere without explicit permission. Push with `git push -u origin <branch>`; retry network failures with exponential backoff (2s/4s/8s/16s).

## Don't

- Don't modify `sunny-acres.html` — it stays as the parity reference until Phase 1 exits.
- Don't create `apps/server/` in Phase 1.
- Don't introduce magic numbers — they belong in `catalog.ts`.
- Don't import DOM or Vite from `packages/shared`.
- Don't pick the open decision on intro-popup copy without human input.
