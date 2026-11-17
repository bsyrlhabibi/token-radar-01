// Launch Radar — detail.js: one protocol, opened up, in four tabs.
// Overview: the facts, a computed "why this rank" line, the waterfall in
// miniature, the farm plan in short. Valuation: the full waterfall plus the
// category multiple in context (median, peers, shrinkage). Farm plan: the
// six steps, word for word the playbook in data.js. Evidence: the comps
// table with this protocol's own category lit. compsRows lives here too,
// shared with the market view.

const DETAIL_TABS = [['overview', 'Overview'], ['valuation', 'Valuation'], ['farm', 'Farm plan'], ['evidence', 'Evidence']];

/* The comps table's rows: every category's median and used multiple. With a
   bar, for the market view; with a highlight, for a protocol's Evidence tab. */
function compsRows(ownCat, withBar) {
  const maxUsed = Math.max(...LR.R.categories.map((c) => c.used_multiple));
  return LR.R.categories.map((c) => `<tr class="${c.category === ownCat ? 'ownrow' : ''}" style="cursor:default">
    <td>${esc(c.category)}${c.category === ownCat ? ' <span class="tier">THIS PROTOCOL</span>' : ''}</td>
    <td class="num">${c.peers}</td><td class="num">${c.median_multiple.toFixed(2)}×</td><td class="num">${c.used_multiple.toFixed(2)}×</td>
    ${withBar ? `<td><span class="mom"><span class="bar" style="width:110px"><i class="up" style="width:${(Math.log(c.used_multiple) / Math.log(maxUsed)) * 100}%"></i></span></span></td>` : ''}</tr>`).join('');
}

/* The waterfall as a table: one row per term, bars on a log scale (values
   span orders of magnitude), the final row lit as the implied value. */
function waterfallHtml(row) {
  const steps = LR.waterfall(row);
  const maxLog = Math.log10(Math.max(...steps.map((s) => s[1])));
  const minLog = Math.log10(Math.max(1, Math.min(...steps.map((s) => s[1])))) - 0.4;
  const bar = (v) => Math.max(4, ((Math.log10(Math.max(v, 1)) - minLog) / (maxLog - minLog)) * 100);
  return `<table><tbody>${steps.map(([lab, v], i) => `<tr style="cursor:default"><td>${esc(lab)}</td><td><span class="mom"><span class="bar wide"><i class="up" style="width:${bar(v)}%;${i === steps.length - 1 ? '' : 'background:var(--signal-dim)'}"></i></span></span></td><td class="num${i === steps.length - 1 ? ' implied' : ''}">${money(v)}</td></tr>`).join('')}</tbody></table>`;
}

function factsHtml(tiles) {
  return `<div class="facts">${tiles.map(([b, s]) => `<div class="fact"><b>${b}</b><span>${s}</span></div>`).join('')}</div>`;
}

/* Why this rank, computed from the waterfall's own terms: the multiplier
   that lifts the row most, and the one that drags it most, named with their
   numbers. The multiple is measured against the global median. */
function whyRank(row) {
  const p = row.parts, R = LR.R;
  const terms = [
    [`its ${p.base_multiple.toFixed(2)}× category multiple, ${p.base_multiple >= R.global_multiple ? 'above' : 'below'} the market's ${R.global_multiple.toFixed(2)}× median`, p.base_multiple / R.global_multiple],
    [`momentum of ${pct(row.change_7d)} over the week`, p.growth_multiplier],
    [`${row.age_days === null ? 'an unrecorded age' : `${row.age_days} days of survival`}`, p.age_multiplier],
    [`reach across ${row.chains.length} chain${row.chains.length === 1 ? '' : 's'}`, p.chain_multiplier],
  ];
  const lift = terms.reduce((a, b) => (b[1] > a[1] ? b : a));
  const drag = terms.reduce((a, b) => (b[1] < a[1] ? b : a));
  return `It stands at #${row.rank} chiefly on ${lift[0]}` + (drag[1] < 0.999 ? `, held back by ${drag[0]}.` : ', with no term in its waterfall pulling it down.');
}

function openDetail(slug, tab) {
  const row = LR.bySlug.get(slug);
  if (!row) return;
  state.view = 'detail';
  state.slug = slug;
  if (tab) state.tab = tab;
  if (!DETAIL_TABS.some(([k]) => k === state.tab)) state.tab = 'overview';
  const p = row.parts;
  const comp = row.category ? LR.compByCat.get(row.category) : undefined;
  const plan = LR.farmPlan(row);
  const compNote = comp
    ? `The multiple is the market's, not ours: ${comp.peers} live ${esc(row.category)} protocol${comp.peers === 1 ? '' : 's'} trade${comp.peers === 1 ? 's' : ''} at a median ${comp.median_multiple.toFixed(2)}× their TVL; shrunk toward the global ${LR.R.global_multiple.toFixed(2)}× by their count, the board uses ${comp.used_multiple.toFixed(2)}×.`
    : `No live peer in this category trades in the snapshot, so the board prices ${esc(row.name)} at the market's global median, ${LR.R.global_multiple.toFixed(2)}× TVL.`;

  const panes = {
    overview: factsHtml([
      [money(row.tvl_usd), 'TVL'], [pct(row.change_7d), 'TVL, 7 days'],
      [row.age_days === null ? '—' : `${row.age_days}d`, 'Age on DefiLlama'], [row.chains.length, 'Chains'],
      [`${p.base_multiple.toFixed(3)}×`, 'Category multiple'], [money(row.implied_value_usd), 'Implied launch value'],
    ]) + `<p class="why">${esc(whyRank(row))}</p>
      <h3 class="sect">The valuation, in miniature</h3>${waterfallHtml(row)}
      <h3 class="sect">The farm plan, in short</h3>
      <p class="lede">${esc(plan[1][0])} Hold at least ${LR.holdOf(row.age_days)} days; the full six steps, with costs and timings, are under the Farm plan tab.</p>`,
    valuation: `<h3 class="sect">How the number is built</h3>${waterfallHtml(row)}` +
      factsHtml([
        [comp ? comp.median_multiple.toFixed(2) + '×' : '—', 'Category median'], [comp ? comp.peers : 0, 'Live peers behind it'],
        [`${LR.R.global_multiple.toFixed(2)}×`, 'Global median'], [`${(comp ? comp.used_multiple : p.base_multiple).toFixed(3)}×`, 'Multiple used'],
        [`K = ${LR.R.constants.shrink_k}`, 'Shrinkage weight'], [money(row.implied_value_usd), 'Implied launch value'],
      ]) + `<p class="lede">${compNote} The shrinkage is the honesty in the model: a category with two peers barely moves off the global median; a category with thirty stands on its own evidence. Momentum, maturity and reach then adjust, exactly as the waterfall shows.</p>`,
    farm: `<h3 class="sect">The farm plan — six steps to be in line if it launches</h3>
      <div class="plan">${plan.map(([text, cost, time]) => `<div class="step"><div><p>${esc(text)}</p><p class="meta">COST — ${esc(cost)} · TIME — ${esc(time)}</p></div></div>`).join('')}</div>`,
    evidence: `<h3 class="sect">The evidence under this protocol's multiple</h3>
      <p class="lede">Every category's row in the market's table, with ${esc(row.name)}'s own line of work — ${esc(row.category ?? '—')} — lit. These are the live, tokenised protocols whose market caps set the multiple above.</p>
      <table><thead><tr><th>Category</th><th class="num">Live peers</th><th class="num">Median ×TVL</th><th class="num">Used ×TVL</th></tr></thead>
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
