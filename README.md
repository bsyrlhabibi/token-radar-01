# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bsyrlhabibi/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bsyrlhabibi/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Launch Radar** — a token launch radar built on one sealed DefiLlama snapshot. It reads every protocol in the snapshot, keeps the ones that still record no token of their own (not a versioned pool, not a wrapped, staked or bridged product, not an exchange front), and ranks them by what their launch could be worth.

Where a flat TVL multiple prices a lending market like a prediction market, this radar prices each protocol against the market's own evidence: the 128 protocols in the same snapshot whose tokens already trade. Grouped by category, their market-cap-to-TVL ratios are the comparables; a category's median, shrunk toward the global median in log space by how many peers back it, becomes the base multiple. Seven-day TVL momentum (losses weighted heavier than gains), maturity (age on DefiLlama) and reach (chain count) adjust the base. The product is an expected launch value, stated openly enough to re-run by hand.

The board covers the house watchlist in full — all 40 protocols at or above the $50M floor — and then keeps going, to 198 ranked rows down at the snapshot's $5M edge, because the early finds are the point of a radar. Every row carries a six-step farm plan written from its own category, first chain, size and age: the position to open, the weekly action that keeps the wallet reading as a real user, how long to hold, what to watch, and when to unwind.

The dashboard is a static page with no network calls. Version 2 keeps the model — and therefore `board.json` — exactly as round 1 shipped it, and rebuilds the page around it: a working board you can sort by any column, pin rows to, compare protocols side by side on, jump around with a command palette, export, and link to in any state.

## What's new in v2

- **Column sorting** — click any board header (Protocol, Category, TVL, 7 days, Age, × TVL, Implied value) to sort; the arrow shows the direction, and the Sort and Dir dropdowns stay in sync with the headers both ways.
- **Pin** — the ☆/★ button on every row pins it into a PINNED group at the top of the board, across sorts and filters, with the count stated; Unpin all clears them.
- **Compare** — the + button on every row adds it to the compare tray (COMPARE — n of 3). "Compare side by side" opens the full panel: TVL, 7-day change, age, chains, the category multiple, every waterfall term, each protocol's share of compared value as a bar, its farm plan's steps, capital and hold — and a verdict row computed from the selected rows: Highest implied value, Strongest 7d momentum, Richest category multiple, Cheapest farm entry.
- **Command palette** — the "⌘ Command Ctrl K" button, Ctrl K, or / opens it: fuzzy-jump to any protocol's detail, to the three views, or to actions (Export the board as CSV, Clear all pins, Reset all filters, Compare the tray picks). Fully keyboard navigable (↑↓, Enter, Esc) and clickable.
- **Tabbed detail** — every protocol opens in four tabs: Overview (the facts, a computed "why this rank" line, the waterfall in miniature, the farm plan in short), Valuation (the full waterfall plus the category multiple in context — median, live peers, shrinkage weight), Farm plan (the six steps with costs and timings), Evidence (the comps table with this protocol's own category lit).
- **CSV export** — the ⇩ CSV button downloads the board exactly as it stands — filtered, sorted, pinned first — as `launch-radar-board.csv`.
- **Deep links** — `#/board`, `#/detail/<slug>`, `#/market`, `#/model`; the board's filters, sort, pins and compare picks ride along in the address, so any state can be linked, reloaded and screenshotted identically. The `?view=&slug=&cat=&tab=&pin=&cmp=` query parameters stage the same states on first load.
- **Filter chips and polish** — a summary line always states "N of 198 rows", each active filter appears as a chip removable with one click, a dead filter gets an empty state with a reset, and the board's footer lists the keys: Ctrl K or / for the palette, B / M / P for the views, Esc closes overlays.

## Dashboard architecture

The page is plain HTML, CSS and JS — no framework, no build step, no network. One job per file under `dashboard/`:

- `index.html` — the page itself: masthead, the three views' markup, the overlays' shells.
- `app.css` — the phosphor-scope styling, in commented sections.
- `data.js` — the dataset as working structures (a Map from slug to row), the shipped pricing and the sandbox's re-pricing, the waterfall builder, the farm-plan playbook.
- `board.js` — the page state, the board table, header sorting, pins, filter chips, CSV export.
- `detail.js` — the tabbed detail and the why-this-rank line; also `compsRows`, the comps-table builder shared with the market view.
- `compare.js` — the compare tray and the side-by-side panel with its computed verdicts.
- `palette.js` — the command palette: subsequence fuzzy matching, keyboard and mouse.
- `views.js` — the masthead stats and the market's evidence tables.
- `visuals.js` — the masthead scope, drawn once from the top forty slugs.
- `app.js` — the router (query staging, then hash deep links), the model sandbox, the boot wiring.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` reads the sealed snapshot, refuses a board the gate would refuse, and writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Open `out/dashboard/index.html` in a browser to use the radar.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hazel-beacon-85&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
