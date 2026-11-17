# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/bsyrlhabibi/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/bsyrlhabibi/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

**Launch Radar** — a token launch radar built on one sealed DefiLlama snapshot. It reads every protocol in the snapshot, keeps the ones that still record no token of their own (not a versioned pool, not a wrapped, staked or bridged product, not an exchange front), and ranks them by what their launch could be worth.

Where a flat TVL multiple prices a lending market like a prediction market, this radar prices each protocol against the market's own evidence: the 128 protocols in the same snapshot whose tokens already trade. Grouped by category, their market-cap-to-TVL ratios are the comparables; a category's median, shrunk toward the global median in log space by how many peers back it, becomes the base multiple. Seven-day TVL momentum (losses weighted heavier than gains), maturity (age on DefiLlama) and reach (chain count) adjust the base. The product is an expected launch value, stated openly enough to re-run by hand.

The board covers the house watchlist in full — all 40 protocols at or above the $50M floor — and then keeps going, to 198 ranked rows down at the snapshot's $5M edge, because the early finds are the point of a radar. Every row carries a six-step farm plan written from its own category, first chain, size and age: the position to open, the weekly action that keeps the wallet reading as a real user, how long to hold, what to watch, and when to unwind.

The dashboard is a static page with no network calls: the ranked board with search, category, chain, size and tier filters; a detail view for every protocol with its valuation waterfall and farm plan; the market's evidence table the multiples were read from; and the model stated in full, with a sandbox whose sliders re-price and re-rank the board in place.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

`main.ts` reads the sealed snapshot, refuses a board the gate would refuse, and writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Open `out/dashboard/index.html` in a browser to use the radar.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hazel-beacon-85&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
