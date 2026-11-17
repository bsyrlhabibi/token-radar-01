// Launch Radar — detail.js: one protocol, opened up, in four tabs.
// Overview: facts, a computed "why this rank" line, the waterfall in
// miniature, the plan in short. Valuation: the full waterfall plus the fit
// in context. Farm plan: the board's steps and their netted verdict.
// Evidence: the comps table, own category lit (shared with the market view).

const DETAIL_TABS = [['overview', 'Overview'], ['valuation', 'Valuation'], ['farm', 'Farm plan'], ['evidence', 'Evidence']];

/* The comps table's rows: every category's live peers and median multiple
   — the evidence the curve was fitted against, not the price. */
function compsRows(ownCat, withBar) {
  const maxMed = Math.max(...LR.R.categories.map((c) => c.median_multiple));
  return LR.R.categories.map((c) => `<tr class="${c.category === ownCat ? 'ownrow' : ''}" style="cursor:default">
    <td>${esc(c.category)}${c.category === ownCat ? ' <span class="tier">THIS PROTOCOL</span>' : ''}</td>
    <td class="num">${c.peers}</td><td class="num">${c.median_multiple.toFixed(2)}×</td>
    ${withBar ? `<td><span class="mom"><span class="bar" style="width:110px"><i class="up" style="width:${(Math.log(c.median_multiple) / Math.log(maxMed)) * 100}%"></i></span></span></td>` : ''}</tr>`).join('');
}

/* The waterfall as a table: log-scale bars, the price row lit. */
function waterfallHtml(row) {
  const steps = LR.waterfall(row);
  const maxLog = Math.log10(Math.max(...steps.map((s) => s[1])));
  const minLog = Math.log10(Math.max(1, Math.min(...steps.map((s) => s[1])))) - 0.4;
  const bar = (v) => Math.max(4, ((Math.log10(Math.max(v, 1)) - minLog) / (maxLog - minLog)) * 100);
  return `<table><tbody>${steps.map(([lab, v], i) => `<tr style="cursor:default"><td>${esc(lab)}</td><td><span class="mom"><span class="bar wide"><i class="up" style="width:${bar(v)}%;${i === 1 ? '' : 'background:var(--signal-dim)'}"></i></span></span></td><td class="num${i === 1 ? ' implied' : ''}">${money(v)}</td></tr>`).join('')}</tbody></table>`;
}

function factsHtml(tiles) {
  return `<div class="facts">${tiles.map(([b, s]) => `<div class="fact"><b>${b}</b><span>${s}</span></div>`).join('')}</div>`;
}

/* Why this rank, computed from the row's own numbers: the size, the
   effective multiple it carries, the refit band, the netted verdict. */
function whyRank(row) {
  const rankBit = row.rank_low === row.rank_high
    ? `its rank held at #${row.rank} in all ${LR.R.bootstrap_refits} bootstrap refits — refits move the value, not the order`
    : `across the ${LR.R.bootstrap_refits} refits its rank moved between #${row.rank_low} and #${row.rank_high}`;
  return `It stands at #${row.rank} on size: ${money(row.tvl_usd)} of TVL priced by the fitted curve at an effective ${row.parts.effective_multiple.toFixed(3)}×, with the refit band running ${money(row.band_low_usd)} to ${money(row.band_high_usd)} and ${rankBit}. Its farm plan nets to ${row.verdict} — $${row.plan_cost_usd} all-in against a break-even launch chance of ${row.breakeven_pct.toFixed(1)}%.`;
}

function openDetail(slug, tab) {
  const row = LR.bySlug.get(slug);
  if (!row) return;
  state.view = 'detail';
  state.slug = slug;
  if (tab) state.tab = tab;
  if (!DETAIL_TABS.some(([k]) => k === state.tab)) state.tab = 'overview';
  const F = LR.R.fit;
  const plan = LR.farmPlan(row);
  const curveNote = `The price is one fitted line, not a category opinion: across the ${F.n} cleaned traded protocols, market cap grows with TVL at slope ${F.slope.toFixed(2)} (intercept ${F.intercept.toFixed(2)}, natural logs, dollars). At ${money(row.tvl_usd)} of TVL the line's effective multiple is ${row.parts.effective_multiple.toFixed(3)}× — smaller protocols carry richer multiples, giants thinner ones, as the traded set does. The band is not decoration: ${LR.R.bootstrap_refits} bootstrap refits move this row's price between ${money(row.band_low_usd)} and ${money(row.band_high_usd)}. How the line was tested — leave-one-out and a time split, against the flat constant and the category model of rounds 1–2 — is stated whole under The model, open.`;

  const panes = {
    overview: factsHtml([
      [money(row.tvl_usd), 'TVL'], [pct(row.change_7d), 'TVL, 7 days'],
      [row.age_days === null ? '—' : `${row.age_days}d`, 'Age on DefiLlama'], [row.chains.length, 'Chains'],
      [money(row.implied_value_usd), 'Implied launch value'], [`${money(row.band_low_usd)} – ${money(row.band_high_usd)}`, 'Band, p10–p90 of the refits'],
      [`${row.verdict} · $${row.plan_cost_usd} all-in`, 'Farm verdict · plan cost'],
    ]) + `<p class="why">${esc(whyRank(row))}</p>
      <h3 class="sect">The valuation, in miniature</h3>${waterfallHtml(row)}
      <h3 class="sect">The farm plan, in short</h3>
      <p class="lede">${esc(plan[1][0])} Hold at least ${LR.holdOf(row.age_days)} days; the full plan — six steps and the verdict they net to — is under the Farm plan tab.</p>`,
    valuation: `<h3 class="sect">How the number is built</h3>${waterfallHtml(row)}` +
      factsHtml([
        [F.intercept.toFixed(2), 'Curve intercept a'], [F.slope.toFixed(3), 'Curve slope b'],
        [F.n, 'Protocols in the fit'], [`${row.parts.effective_multiple.toFixed(3)}×`, 'Effective multiple at this TVL'],
        [row.rank_low === row.rank_high ? `#${row.rank} in every refit` : `#${row.rank_low} – #${row.rank_high}`, 'Rank across the refits'], [money(row.implied_value_usd), 'Implied launch value'],
      ]) + `<p class="lede">${curveNote}</p>`,
    farm: `<h3 class="sect">The farm plan — six steps, then the verdict they net to</h3>
      <div class="plan">${plan.map(([text, cost, time], i) => `<div class="step${i === plan.length - 1 ? ' verdict' : ''}"><div><p>${esc(text)}</p><p class="meta">COST — ${esc(cost)} · TIME — ${esc(time)}</p></div></div>`).join('')}</div>`,
    evidence: `<h3 class="sect">The evidence the curve was fitted against</h3>
      <p class="lede">Every category's row in the market's table, with ${esc(row.name)}'s own line of work — ${esc(row.category ?? '—')} — lit. These medians are the evidence, not the price: comps-2 fits one size curve across the traded set, and the round 1–2 board priced from this table — the test under The model, open shows what that cost.</p>
      <table><thead><tr><th>Category</th><th class="num">Live peers</th><th class="num">Median ×TVL</th></tr></thead>
      <tbody>${compsRows(row.category, false)}</tbody></table>
      <p class="lede">The live peers behind the lit row — their names, caps and multiples — are listed in full under The market's evidence.</p>`,
  };

  $('#view-detail').innerHTML = `
    <button class="backbtn" id="back">← Back to the board</button>
    <div class="detail-head"><h2>${esc(row.name)}</h2>
      <span class="rankbadge">#${row.rank} ON THE BOARD</span>
      <span class="tier ${row.tier}">${row.tier === 'watchlist' ? 'HOUSE WATCHLIST' : 'EARLY FIND — BELOW THE FLOOR'}</span>
      <button class="toolbtn" id="d-pin">${state.pins.has(row.slug) ? '★ Pinned' : '☆ Pin'}</button>
      <button class="toolbtn" id="d-cmp">${state.cmp.includes(row.slug) ? '✓ In compare' : '+ Compare'}</button>
    </div>
    <p class="lede">${esc(row.category ?? 'Uncategorised')} · first chain ${esc(row.chains[0] ?? '—')} · tracked by DefiLlama since ${esc(row.listed_at ?? 'an unrecorded date')} · still no token: that is the whole opportunity.</p>
    <div class="tabs dtabs" role="tablist">${DETAIL_TABS.map(([k, lab]) => `<button data-tab="${k}" class="${state.tab === k ? 'on' : ''}" role="tab">${lab}</button>`).join('')}</div>
    <div class="dpane">${panes[state.tab]}</div>`;
  $('#back').addEventListener('click', () => show('board'));
  $('#d-pin').addEventListener('click', () => { state.pins.has(row.slug) ? state.pins.delete(row.slug) : state.pins.add(row.slug); openDetail(row.slug); renderBoard(); syncHash(); });
  $('#d-cmp').addEventListener('click', () => { toggleCompare(row.slug); openDetail(row.slug); });
  for (const b of document.querySelectorAll('.dtabs button')) b.addEventListener('click', () => { state.tab = b.dataset.tab; openDetail(row.slug); syncHash(); });
  show('detail');
  syncHash();
}
