// Launch Radar — data.js: the dataset and the arithmetic every other file uses.
// main.ts writes window.RADAR (../data.js) beside this page: the whole sealed
// snapshot, distilled. This file turns it into working structures — a Map from
// slug to row (one lookup per protocol), the category-comps index, the shipped
// pricing and the sandbox's re-pricing of it, and the farm-plan playbook the
// detail and compare views tell from. No other file touches window.RADAR.

const LR = (() => {
  const R = window.RADAR;
  const bySlug = new Map(R.rows.map((r) => [r.slug, r]));
  const compByCat = new Map(R.categories.map((c) => [c.category, c]));

  /* The shipped model's per-row value, or the sandbox's re-pricing of it
     (sandbox is {k, g, a} while the sliders are off their shipped values).
     The shipped path returns the snapshot's own numbers, untouched. */
  function priced(row, sandbox) {
    if (!sandbox) return { implied: row.implied_value_usd, multiple: row.parts.base_multiple };
    const comp = row.category ? compByCat.get(row.category) : undefined;
    let multiple = R.global_multiple;
    if (comp) {
      const blended = Math.exp((comp.peers * Math.log(comp.median_multiple) + sandbox.k * Math.log(R.global_multiple)) / (comp.peers + sandbox.k));
      multiple = Math.min(R.constants.multiple_max, Math.max(R.constants.multiple_min, blended));
    }
    const gp = row.parts.growth_pct;
    const w = (gp >= 0 ? R.constants.growth_up_weight : R.constants.growth_down_weight) * sandbox.g;
    const growthMult = 1 + (gp / 100) * w;
    const age = row.age_days ?? R.constants.unknown_age_days;
    const ageMult = (1 - sandbox.a) + (Math.min(Math.max(age, 0), R.constants.age_cap_days) / R.constants.age_cap_days) * sandbox.a;
    const implied = Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * ageMult * row.parts.chain_multiplier));
    return { implied, multiple };
  }

  /* The waterfall a valuation is built from: TVL, then each multiplier in turn. */
  function waterfall(row) {
    const p = row.parts;
    const steps = [['TVL today', row.tvl_usd]];
    let run = row.tvl_usd;
    for (const [name, m] of [['category multiple', p.base_multiple], ['momentum', p.growth_multiplier], ['maturity', p.age_multiplier], ['reach', p.chain_multiplier]]) {
      run *= m; steps.push([`× ${name} ${m.toFixed(3)}`, run]);
    }
    return steps;
  }

  /* ---- the farm-plan playbook: the page's own telling of the model's logic.
     Same words as the shipped board's plans: category decides the position,
     first chain the gas, TVL the capital tier, age the hold. ---- */
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
  function bookOf(row, chain, capital) {
    const c = (row.category ?? '').toLowerCase();
    const n = row.name;
    if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
      return [`Supply $${capital} of USDC to ${n} on ${chain}, then borrow a small amount against it and repay, so the wallet shows both sides of the market`, 'rebalance the position once a week and keep the health factor comfortably above liquidation', 'a borrow rate spike or an oracle warning on the position\u2019s market page'];
    if (c.includes('dex') || c.includes('leveraged'))
      return [`Add $${capital} of liquidity to ${n}'s deepest pool on ${chain} and route two or three real swaps through it`, 'swap a small amount through the protocol once a week and re-centre the liquidity if the price drifts', 'impermanent loss if the pool\u2019s pair runs apart; the plan\u2019s capital is the most it can cost'];
    if (c.includes('perpetual') || c.includes('derivative') || c.includes('options'))
      return [`Deposit $${capital} of USDC as margin on ${n} and open one small hedged position, spot against perp, so the account trades without directional risk`, 'roll or resize the hedge once a week so the account keeps a live trading history', 'funding flipping against the hedge; keep the position small enough that a bad week is a lesson, not a loss'];
    if (c.includes('curator') || c.includes('allocator') || c.includes('capital'))
      return [`Deposit $${capital} into one of ${n}'s flagship vaults on ${chain} and keep the vault shares in the wallet`, 'check the vault\u2019s allocation once a week and move to its successor vault if the curator rotates', 'the vault\u2019s underlying markets; a curator\u2019s risk sits in what the vault lends to, not in the vault itself'];
    if (c.includes('rwa') || c.includes('treasur') || c.includes('stable'))
      return [`Mint or deposit $${capital} of ${n}'s yield-bearing asset on ${chain} and hold it untouched`, 'make one small top-up or redemption a week so the holding is active, not dust', 'redemption windows and issuer notices; these assets pay slowly and exit slower'];
    if (c.includes('payment'))
      return [`Fund a ${n} wallet or channel with $${capital} and route two real payments through it`, 'send one small payment a week so the account keeps a genuine usage history', 'channel or wallet balances draining in fees; top up little and often'];
    if (c.includes('yield') || c.includes('farm'))
      return [`Deposit $${capital} into ${n}'s main vault on ${chain} and keep the receipt token in the wallet`, 'compound or re-deposit the yield once a week rather than selling it', 'the vault\u2019s strategy changing under you; read its page before each compound'];
    if (c.includes('prediction'))
      return [`Fund $${capital} on ${n} and take small positions on three liquid markets`, 'trade one market a week and settle positions as they resolve', 'thin markets where the exit price is not the screen price'];
    return [`Deposit $${capital} of USDC into ${n} on ${chain} and keep the position open`, 'make one qualifying action a week, a deposit, a swap or a vote, so the wallet reads as a user and not a passer-by', 'the protocol\u2019s own announcements page; terms change quietly and positions should follow'];
  }
  function farmPlan(row) {
    const chain = row.chains[0] ?? 'its main chain';
    const capital = capitalOf(row.tvl_usd);
    const hold = holdOf(row.age_days);
    const gas = gasOf(chain);
    const [open, weekly, watch] = bookOf(row, chain, capital);
    return [
      ['Start from a fresh wallet funded only with the farming budget, its seed phrase written offline; a launch, if it comes, will look for real users, and a clean wallet is one.', gas, '5 minutes'],
      [open, `$${capital} of capital plus ${gas}`, '15 minutes to set up'],
      [`Each week, ${weekly}.`, 'about $2 of fees a week', '10 minutes a week'],
      [`Hold the position for at least ${hold} days, across more than one weekly snapshot of the protocol's numbers.`, `the $${capital} stays in the position`, `${hold} days`],
      [`Watch for ${watch}. Check ${row.name}'s own site and official account before acting on any launch or points news, and follow only links published there.`, 'nothing to check, and never pay anyone to claim an airdrop', '10 minutes'],
      ['Keep a farm log — wallet, dates, amounts, transaction hashes — and unwind when the token launches, when the protocol announces its snapshot, or when its TVL falls by a third from your entry.', 'nothing but the log', '5 minutes'],
    ];
  }
  /* The plan's headline numbers, for compare: capital in, days held. */
  function planFacts(row) {
    return { steps: 6, capital: capitalOf(row.tvl_usd), hold: holdOf(row.age_days), gas: gasOf(row.chains[0] ?? '') };
  }

  return { R, bySlug, compByCat, priced, waterfall, farmPlan, planFacts, capitalOf, holdOf, gasOf };
})();
