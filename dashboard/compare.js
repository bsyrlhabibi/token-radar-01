// Launch Radar — compare.js: up to three protocols, side by side.
// The + on any row (or a detail page's button) adds the protocol to
// state.cmp; the tray at the bottom shows the picks and opens the panel.
// Every line is read off the rows themselves — including the verdicts,
// computed from the selected numbers: highest implied value, strongest
// momentum, richest multiple, cheapest farm entry, and each pick's share
// of the compared total implied value, drawn as a bar.

const CMP_MAX = 3;

function toggleCompare(slug) {
  const at = state.cmp.indexOf(slug);
  if (at >= 0) state.cmp.splice(at, 1);
  else { if (state.cmp.length >= CMP_MAX) state.cmp.shift(); state.cmp.push(slug); }
  renderBoard(); renderTray(); syncHash();
}

function renderTray() {
  const tray = $('#compare-tray');
  const picks = state.cmp.map((s) => LR.bySlug.get(s)).filter(Boolean);
  tray.hidden = !picks.length;
  if (!picks.length) { $('#compare-panel').hidden = true; return; }
  tray.innerHTML = `<span class="tray-lead">COMPARE — ${picks.length} of ${CMP_MAX}</span>` +
    picks.map((r) => `<span class="fchip">${esc(r.name)} <button data-uncmp="${esc(r.slug)}">×</button></span>`).join('') +
    `<button class="toolbtn" id="tray-open" ${picks.length < 2 ? 'disabled' : ''}>Compare side by side →</button><button class="toolbtn" id="tray-clear">Clear</button>`;
  for (const b of tray.querySelectorAll('[data-uncmp]')) b.addEventListener('click', () => toggleCompare(b.dataset.uncmp));
  $('#tray-clear').addEventListener('click', () => { state.cmp = []; renderBoard(); renderTray(); syncHash(); });
  const open = $('#tray-open');
  if (open) open.addEventListener('click', renderCompare);
}

function renderCompare() {
  const picks = state.cmp.map((s) => LR.bySlug.get(s)).filter(Boolean);
  if (picks.length < 2) return;
  const panel = $('#compare-panel');
  const xs = picks.map((r) => ({ r, p: LR.priced(r, state.sandbox), plan: LR.planFacts(r) }));
  const total = xs.reduce((s, x) => s + x.p.implied, 0);
  const best = (fn) => xs.reduce((a, b) => (fn(b) > fn(a) ? b : a));
  const line = (label, fn, raw) => `<tr><td class="clab">${label}</td>${xs.map((x) => `<td class="num">${raw ? fn(x) : esc(fn(x))}</td>`).join('')}</tr>`;
  panel.innerHTML = `<div class="cmp-box">
    <div class="cmp-head"><h2>Side by side</h2><button class="toolbtn" id="cmp-close">Close ×</button></div>
    <table id="cmp-table"><thead><tr><th></th>${xs.map((x) => `<th><span class="pname">${esc(x.r.name)}</span><br><span class="pslug">${esc(x.r.slug)}</span></th>`).join('')}</tr></thead>
    <tbody>
      ${line('Board rank', (x) => `#${x.r.rank}`)}${line('Category', (x) => x.r.category ?? '—')}
      ${line('Tier', (x) => (x.r.tier === 'watchlist' ? 'Watchlist' : 'Early find'))}${line('TVL', (x) => money(x.r.tvl_usd))}
      ${line('7-day change', (x) => pct(x.r.change_7d))}${line('Age', (x) => (x.r.age_days === null ? 'unknown' : `${x.r.age_days}d`))}
      ${line('Chains', (x) => x.r.chains.length)}${line('Category multiple', (x) => `${x.p.multiple.toFixed(3)}×`)}
      ${line('× momentum', (x) => x.r.parts.growth_multiplier.toFixed(3))}${line('× maturity', (x) => x.r.parts.age_multiplier.toFixed(3))}
      ${line('× reach', (x) => x.r.parts.chain_multiplier.toFixed(3))}${line('Implied launch value', (x) => money(x.p.implied))}
      <tr><td class="clab">Share of compared value</td>${xs.map((x) => { const sh = total ? (x.p.implied / total) * 100 : 0; return `<td><span class="mom"><span>${sh.toFixed(1)}%</span><span class="bar" style="width:90px"><i class="up" style="width:${sh}%"></i></span></span></td>`; }).join('')}</tr>
      ${line('Farm plan', (x) => `${x.plan.steps} steps`)}${line('Farm capital', (x) => `$${x.plan.capital}`)}
      ${line('Farm hold', (x) => `${x.plan.hold} days`)}${line('Farm gas (first chain)', (x) => x.plan.gas)}
    </tbody></table>
    <div class="verdicts">${[
      ['Highest implied value', best((x) => x.p.implied)], ['Strongest 7d momentum', best((x) => x.r.change_7d ?? -Infinity)],
      ['Richest category multiple', best((x) => x.p.multiple)], ['Cheapest farm entry', xs.reduce((a, b) => (b.plan.capital < a.plan.capital ? b : a))],
    ].map(([lab, x]) => `<div class="fact"><span>${lab}</span><b>${esc(x.r.name)}</b></div>`).join('')}</div>
    <p class="pal-hint">Verdicts are computed from the rows above, on the ${state.sandbox ? 'sandbox' : 'shipped'} pricing. Esc closes.</p></div>`;
  panel.hidden = false;
  $('#cmp-close').addEventListener('click', () => { panel.hidden = true; });
}
