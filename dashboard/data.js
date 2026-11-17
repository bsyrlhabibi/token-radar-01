// Launch Radar — data.js: the dataset and the arithmetic every other file
// uses. main.ts writes window.RADAR (../data.js) beside this page: the whole
// sealed snapshot, distilled — a Map from slug to row, the category-comps
// index (evidence, not the price), the shipped + sandbox pricing, and the
// farm plan the detail and compare views tell. No other file touches it.

const LR = (() => {
  const R = window.RADAR;
  const bySlug = new Map(R.rows.map((r) => [r.slug, r]));
  const compByCat = new Map(R.categories.map((c) => [c.category, c]));

  function growthMultOf(pct) {
    if (pct === null || pct === undefined) return 1;
    const c = Math.max(-R.constants.growth_clamp_pct, Math.min(R.constants.growth_clamp_pct, pct));
    return 1 + (c / 100) * (c >= 0 ? R.constants.growth_up_weight : R.constants.growth_down_weight);
  }
  function ageMultOf(days) {
    const age = days === null || days === undefined ? R.constants.unknown_age_days : days;
    return R.constants.age_floor + R.constants.age_range * (Math.min(Math.max(age, 0), R.constants.age_cap_days) / R.constants.age_cap_days);
  }

  /* The shipped model's per-row value, or the sandbox's re-pricing of it.
     Sandbox {b, g, a}: the curve's slope, re-anchored at the fit's mean
     point, and weights for the two terms the harness dropped — at 0 (their
     shipped value) the board is the pure curve, numbers untouched. */
  function priced(row, sandbox) {
    if (!sandbox) return { implied: row.implied_value_usd, multiple: row.parts.effective_multiple };
    const F = R.fit;
    const base = Math.exp(F.mean_log_mcap - sandbox.b * F.mean_log_tvl + sandbox.b * Math.log(Math.max(1, row.tvl_usd)));
    const implied = Math.max(1, Math.round(base
      * (1 + (growthMultOf(row.parts.growth_pct) - 1) * sandbox.g)
      * (1 + (ageMultOf(row.age_days) - 1) * sandbox.a)));
    return { implied, multiple: implied / Math.max(1, row.tvl_usd) };
  }

  /* The waterfall: TVL, the curve's price, the bootstrap band around it. */
  function waterfall(row) {
    return [
      ['TVL today', row.tvl_usd],
      [`curve price — exp(${R.fit.intercept.toFixed(2)} + ${R.fit.slope.toFixed(2)} × ln TVL)`, row.implied_value_usd],
      ['band low — p10 of 200 refits', row.band_low_usd],
      ['band high — p90 of 200 refits', row.band_high_usd],
    ];
  }

  /* ---- the farm plan: the board's own steps, carried in the page data.
     The playbook lives in lib/model.ts; here the shipped step strings are
     only split back into text, cost and time for the pane rendering them. */
  function gasOf(chain) {
    if (chain === 'Solana') return 'a few cents of SOL in fees';
    if (chain === 'Bitcoin' || chain === 'Lightning Network') return 'one ordinary on-chain fee';
    if (chain === 'Ethereum') return '$6 to $15 of ETH in gas';
    return 'about $1 of gas';
  }
  function capitalOf(tvl) {
    if (tvl >= 1e9) return 500;
    if (tvl >= 2.5e8) return 250;
    if (tvl >= 5e7) return 150;
    if (tvl >= 1e7) return 100;
    return 50;
  }
  function holdOf(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function farmPlan(row) {
    return row.farm_steps.map((s) => {
      const m = /^(.*) Cost: (.*)\. Time: (.*)\.$/.exec(s);
      return m ? [m[1], m[2], m[3]] : [s, '', ''];
    });
  }
  /* The plan's headline numbers, for compare: capital in, days held, verdict. */
  function planFacts(row) {
    return { steps: row.farm_steps.length, capital: capitalOf(row.tvl_usd), hold: holdOf(row.age_days), gas: gasOf(row.chains[0] ?? ''), verdict: row.verdict, cost: row.plan_cost_usd, breakeven: row.breakeven_pct, hours: row.plan_hours };
  }

  return { R, bySlug, compByCat, priced, waterfall, farmPlan, planFacts, capitalOf, holdOf, gasOf };
})();
