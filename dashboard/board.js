// Launch Radar — board.js: the board itself, and the state it answers to.
// One state object holds the page's position: view, filters, sort (column +
// direction — header arrows and dropdowns are two faces of one value), pins,
// compare picks, the sandbox re-pricing. app.js turns state into the URL
// hash and back; this file renders it and wires the board's controls.

const state = {
  view: 'board', slug: null, tab: 'overview',
  q: '', cat: '', chain: '', size: 0, tier: 'all', sort: 'implied', dir: 'desc',
  pins: new Set(), cmp: [], sandbox: null, // {k,g,a} while the sliders are off the shipped values
};

const $ = (s) => document.querySelector(s);
const on = (s, ev, fn) => $(s).addEventListener(ev, fn);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function money(v) {
  if (v == null) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`);
function ageLabel(d) {
  if (d == null) return 'unknown';
  if (d >= 730) return `${(d / 365).toFixed(1)}y`;
  if (d >= 60) return `${Math.round(d / 30.4)}mo`;
  return `${d}d`;
}

/* The columns in table order; key is the sort the header click and the Sort
   dropdown share. Pin and Compare are action columns, not sorts. */
const COLS = [
  [null, '#', 1], ['name', 'Protocol'], ['category', 'Category'], [null, 'Chains'], ['tvl', 'TVL', 1],
  ['growth', '7 days'], ['age', 'Age', 1], ['multiple', '× TVL', 1], ['implied', 'Implied value', 1],
  [null, 'Pin'], [null, 'Compare'],
];
const SORTVAL = {
  implied: (r) => r._p.implied, tvl: (r) => r.tvl_usd, growth: (r) => r.change_7d ?? -Infinity,
  age: (r) => r.age_days ?? -1, name: (r) => r.name.toLowerCase(),
  category: (r) => (r.category ?? '').toLowerCase(), multiple: (r) => r._p.multiple,
};

function visibleRows() {
  let rows = LR.R.rows.map((r) => ({ ...r, _p: LR.priced(r, state.sandbox) }));
  if (state.tier !== 'all') rows = rows.filter((r) => r.tier === state.tier);
  if (state.cat) rows = rows.filter((r) => (r.category ?? '') === state.cat);
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  if (state.size > 0) rows = rows.filter((r) => r.tvl_usd >= state.size);
  if (state.q) { const q = state.q.toLowerCase(); rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q)); }
  const get = SORTVAL[state.sort] ?? SORTVAL.implied, sgn = state.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => { const x = get(a), y = get(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sgn; });
  return rows;
}

function setSort(key) {
  if (state.sort === key) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
  else { state.sort = key; state.dir = key === 'name' || key === 'category' ? 'asc' : 'desc'; }
  syncSortControls(); renderBoard(); syncHash();
}
function syncSortControls() {
  $('#f-sort').value = state.sort;
  $('#f-dir').value = state.dir;
  for (const th of document.querySelectorAll('#board-head th[data-sort]')) {
    const on = th.dataset.sort === state.sort;
    th.classList.toggle('sorted', on);
    th.querySelector('.arr').textContent = on ? (state.dir === 'desc' ? '▼' : '▲') : '';
  }
}

function momCell(v) {
  if (v == null) return '<span class="mom">—</span>';
  const cls = v >= 0 ? 'up' : 'dn';
  return `<span class="mom"><span class="${cls}">${pct(v)}</span><span class="bar"><i class="${cls}" style="width:${Math.min(100, (Math.abs(v) / 40) * 100)}%"></i></span></span>`;
}

function rowHtml(r, i) {
  const pinned = state.pins.has(r.slug), inCmp = state.cmp.includes(r.slug);
  const rank = state.sandbox || state.sort !== 'implied' || state.dir !== 'desc' ? i + 1 : r.rank;
  return `<tr data-slug="${esc(r.slug)}" class="${rank <= 3 ? 'top' : ''}${pinned ? ' pinned' : ''}"><td class="rank">${rank}</td><td><span class="pname">${esc(r.name)}</span><span class="tier ${r.tier}">${r.tier === 'watchlist' ? 'WATCHLIST' : 'EARLY'}</span><br><span class="pslug">${esc(r.slug)}</span></td><td>${esc(r.category ?? '—')}</td><td><span class="chips">${r.chains.slice(0, 3).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}${r.chains.length > 3 ? `<span class="chip">+${r.chains.length - 3}</span>` : ''}</span></td><td class="num">${money(r.tvl_usd)}</td><td>${momCell(r.change_7d)}</td><td class="num">${ageLabel(r.age_days)}</td><td class="num">${r._p.multiple.toFixed(2)}×</td><td class="num implied">${money(r._p.implied)}</td><td class="act"><button class="pinbtn${pinned ? ' on' : ''}" data-pin="${esc(r.slug)}" title="${pinned ? 'Unpin' : 'Pin'} ${esc(r.name)}">${pinned ? '★' : '☆'}</button></td><td class="act"><button class="cmpbtn${inCmp ? ' on' : ''}" data-cmp="${esc(r.slug)}" title="Compare ${esc(r.name)} side by side">${inCmp ? '✓' : '+'}</button></td></tr>`;
}

function renderBoard() {
  const rows = visibleRows();
  const pinned = rows.filter((r) => state.pins.has(r.slug));
  const rest = rows.filter((r) => !state.pins.has(r.slug));
  $('#sandbox-note').hidden = !state.sandbox;
  $('#pins-clear').hidden = !state.pins.size;
  let html = '';
  if (!rows.length) {
    html = `<tr class="emptyrow"><td colspan="${COLS.length}"><div style="text-align:center;padding:30px 16px"><p style="margin:0 0 6px;font-size:16px">No protocol matches those filters.</p><p style="color:var(--muted);font-size:13.5px;margin:0 0 14px">The radar swept all ${LR.R.board_size} rows and found nothing in that corner. Loosen a filter — or clear them all.</p><button class="toolbtn" id="empty-reset">Reset all filters</button></div></td></tr>`;
  } else {
    if (pinned.length) html += `<tr class="grouprow"><td colspan="${COLS.length}">★ PINNED — ${pinned.length} protocol${pinned.length === 1 ? '' : 's'} held at the top</td></tr>` + pinned.map((r, i) => rowHtml(r, i)).join('');
    html += rest.map((r, i) => rowHtml(r, pinned.length + i)).join('');
  }
  $('#board-body').innerHTML = html;
  renderChips(rows.length);
  const top = rows[0];
  $('#board-foot').textContent = top ? `Strongest signal: ${top.name} — ${money(top.tvl_usd)} of TVL priced at ${top._p.multiple.toFixed(2)}× for an implied ${money(top._p.implied)} launch. Click any row for its valuation waterfall and farm plan; ★ pins it here, + lines it up in a comparison.` : '';
  const er = $('#empty-reset');
  if (er) er.addEventListener('click', resetFilters);
}

/* Active-filter chips: one per filter now narrowing the board, each with a
   one-click removal; the line always states the count it leaves. */
function renderChips(shown) {
  const chips = [];
  if (state.q) chips.push(['Search', state.q, () => { state.q = ''; $('#f-q').value = ''; }]);
  if (state.cat) chips.push(['Category', state.cat, () => { state.cat = ''; $('#f-cat').value = ''; }]);
  if (state.chain) chips.push(['Chain', state.chain, () => { state.chain = ''; $('#f-chain').value = ''; }]);
  if (state.size > 0) chips.push(['Size', `TVL ≥ ${money(state.size)}`, () => { state.size = 0; $('#f-size').value = '0'; }]);
  if (state.tier !== 'all') chips.push(['Tier', state.tier === 'watchlist' ? 'Watchlist' : 'Early finds', () => setTier('all')]);
  const el = $('#chips');
  el.innerHTML = `<span class="chips-lead">${shown} of ${LR.R.board_size} rows</span>` +
    chips.map(([k, v], i) => `<button class="fchip" data-chip="${i}">${esc(k)}: ${esc(v)} <span class="x">×</span></button>`).join('') +
    (chips.length ? '<button class="fchip clear" id="chips-clear">Clear all</button>' : '');
  chips.forEach(([, , off], i) => el.querySelector(`[data-chip="${i}"]`).addEventListener('click', () => { off(); renderBoard(); syncHash(); }));
  const cc = $('#chips-clear');
  if (cc) cc.addEventListener('click', resetFilters);
}

function setTier(t) {
  state.tier = t;
  for (const x of document.querySelectorAll('#f-tier button')) x.classList.toggle('on', x.dataset.tier === t);
}
function resetFilters() {
  state.q = ''; state.cat = ''; state.chain = ''; state.size = 0;
  $('#f-q').value = ''; $('#f-cat').value = ''; $('#f-chain').value = ''; $('#f-size').value = '0';
  setTier('all'); renderBoard(); syncHash();
}

/* CSV: the board exactly as it stands — filtered, sorted, pinned first —
   from the same priced rows the table shows. */
function exportCsv() {
  const rows = visibleRows();
  const ordered = [...rows.filter((r) => state.pins.has(r.slug)), ...rows.filter((r) => !state.pins.has(r.slug))];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Rank', 'Protocol', 'Slug', 'Category', 'Tier', 'Chains', 'TVL USD', 'Change 7d %', 'Age days', 'Category multiple', 'Momentum x', 'Maturity x', 'Reach x', 'Implied launch value USD', 'Pinned'].join(',')];
  for (const r of ordered) lines.push([r.rank, r.name, r.slug, r.category ?? '', r.tier, r.chains.join(' + '), r.tvl_usd, r.change_7d ?? '', r.age_days ?? '', r._p.multiple.toFixed(4), r.parts.growth_multiplier, r.parts.age_multiplier, r.parts.chain_multiplier, r._p.implied, state.pins.has(r.slug) ? 'yes' : ''].map(cell).join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  a.download = 'launch-radar-board.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Controls: header clicks sort; the tbody delegates — pin and compare act
   in place, any other row click opens the detail. */
function initBoard() {
  $('#board-head').innerHTML = COLS.map(([key, label, num]) => key
    ? `<th class="${num ? 'num ' : ''}sortable" data-sort="${key}">${label} <span class="arr"></span></th>`
    : `<th class="${num ? 'num' : ''}">${label}</th>`).join('');
  for (const th of document.querySelectorAll('#board-head th[data-sort]')) th.addEventListener('click', () => setSort(th.dataset.sort));
  on('#board-body', 'click', (e) => {
    const pin = e.target.closest('[data-pin]');
    if (pin) { const s = pin.dataset.pin; state.pins.has(s) ? state.pins.delete(s) : state.pins.add(s); renderBoard(); syncHash(); return; }
    const cmp = e.target.closest('[data-cmp]');
    if (cmp) { toggleCompare(cmp.dataset.cmp); return; }
    const tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.dataset.slug);
  });
  for (const [sel, ev, key, cast] of [['#f-q', 'input', 'q', (v) => v], ['#f-cat', 'change', 'cat', (v) => v], ['#f-chain', 'change', 'chain', (v) => v], ['#f-size', 'change', 'size', Number]]) {
    on(sel, ev, (e) => { state[key] = cast(e.target.value); renderBoard(); syncHash(); });
  }
  on('#f-sort', 'change', (e) => { state.sort = e.target.value; syncSortControls(); renderBoard(); syncHash(); });
  on('#f-dir', 'change', (e) => { state.dir = e.target.value; syncSortControls(); renderBoard(); syncHash(); });
  for (const b of document.querySelectorAll('#f-tier button')) b.addEventListener('click', () => { setTier(b.dataset.tier); renderBoard(); syncHash(); });
  on('#csv-btn', 'click', exportCsv);
  on('#pins-clear', 'click', () => { state.pins.clear(); renderBoard(); syncHash(); });
  on('#sandbox-reset', 'click', resetSandbox);
  syncSortControls();
}

function fillFilterOptions() {
  const fill = (sel, vals) => { $(sel).innerHTML = `<option value="">All ${sel === '#f-cat' ? 'categories' : 'chains'}</option>` + vals.map((v) => `<option>${esc(v)}</option>`).join(''); };
  fill('#f-cat', [...new Set(LR.R.rows.map((r) => r.category).filter(Boolean))].sort());
  fill('#f-chain', [...new Set(LR.R.rows.flatMap((r) => r.chains))].sort());
  $('#f-size').innerHTML = [[0, 'Any TVL'], [1e9, 'TVL ≥ $1B'], [2.5e8, 'TVL ≥ $250M'], [5e7, 'TVL ≥ $50M'], [1e7, 'TVL ≥ $10M']]
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  $('#f-sort').innerHTML = [['implied', 'Implied value'], ['tvl', 'TVL'], ['growth', '7d momentum'], ['age', 'Age'], ['name', 'Protocol A–Z'], ['category', 'Category'], ['multiple', '× TVL multiple']]
    .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
}
