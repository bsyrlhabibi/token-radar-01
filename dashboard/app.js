// Launch Radar — app.js: the router and the wiring that boots the page.
// Two address systems, one state. Query parameters (?view=detail&slug=…,
// ?cat=Lending, ?pin=…, ?cmp=…, ?tab=…) stage the page on first load — the
// screenshots are captured that way — then fold into the hash, the live
// address: #/board, #/detail/<slug>?tab=…, #/market, #/model, with the
// board's filters, sort, pins and compare picks riding along.

function show(view) {
  state.view = view;
  for (const v of ['board', 'detail', 'market', 'model']) $(`#view-${v}`).hidden = v !== view;
  for (const b of document.querySelectorAll('#tabs button[data-view]')) {
    b.classList.toggle('on', b.dataset.view === view || (view === 'detail' && b.dataset.view === 'board'));
  }
  window.scrollTo(0, 0);
  syncHash();
}

function hashFor() {
  if (state.view === 'detail' && state.slug) return `#/detail/${state.slug}` + (state.tab !== 'overview' ? `?tab=${state.tab}` : '');
  if (state.view === 'market' || state.view === 'model') return `#/${state.view}`;
  const p = new URLSearchParams();
  const pairs = [['q', state.q], ['cat', state.cat], ['chain', state.chain], ['size', state.size || ''],
    ['tier', state.tier !== 'all' ? state.tier : ''], ['sort', state.sort !== 'implied' ? state.sort : ''],
    ['dir', state.dir !== 'desc' ? state.dir : ''], ['pin', [...state.pins].join(',')], ['cmp', state.cmp.join(',')]];
  for (const [k, v] of pairs) if (v) p.set(k, String(v));
  const s = p.toString();
  return '#/board' + (s ? `?${s}` : '');
}

let hashGuard = false;
function syncHash() {
  if (hashGuard) return;
  const h = hashFor();
  if (location.hash !== h) { hashGuard = true; history.replaceState(null, '', h); hashGuard = false; }
}

function applyBoardParams(p) {
  for (const [key, sel, cast] of [['q', '#f-q', (v) => v], ['cat', '#f-cat', (v) => v], ['chain', '#f-chain', (v) => v], ['size', '#f-size', (v) => Number(v) || 0]]) {
    if (p.get(key) !== null) { state[key] = cast(p.get(key)); $(sel).value = String(state[key]); }
  }
  if (p.get('tier') !== null) setTier(p.get('tier'));
  if (p.get('sort') !== null && SORTVAL[p.get('sort')]) state.sort = p.get('sort');
  if (p.get('dir') !== null) state.dir = p.get('dir') === 'asc' ? 'asc' : 'desc';
  if (p.get('pin') !== null) state.pins = new Set(p.get('pin').split(',').filter((s) => LR.bySlug.has(s)));
  if (p.get('cmp') !== null) state.cmp = p.get('cmp').split(',').filter((s) => LR.bySlug.has(s)).slice(0, CMP_MAX);
  syncSortControls();
}

function applyHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const p = new URLSearchParams(qs ?? '');
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'detail' && seg[1] && LR.bySlug.has(seg[1])) openDetail(seg[1], p.get('tab') || undefined);
  else if (seg[0] === 'market' || seg[0] === 'model') show(seg[0]);
  else { applyBoardParams(p); renderBoard(); renderTray(); show('board'); }
}

/* First load: query parameters win (they stage the screenshots). */
function applyParams() {
  const q = new URLSearchParams(location.search);
  if ([...q.keys()].length) {
    applyBoardParams(q);
    if (q.get('view') === 'detail' && q.get('slug')) openDetail(q.get('slug'), q.get('tab') || undefined);
    else if (q.get('view') === 'market' || q.get('view') === 'model') show(q.get('view'));
    else { renderBoard(); renderTray(); show('board'); }
    syncHash();
  } else if (location.hash) applyHash();
  else { renderBoard(); renderTray(); show('board'); }
}

function renderModel() {
  const R = LR.R, F = R.fit, V = R.validation;
  $('#fit-a').textContent = F.intercept.toFixed(2);
  $('#fit-b').textContent = F.slope.toFixed(3);
  $('#fit-n').textContent = F.n;
  $('#fit-traded').textContent = F.traded;
  $('#fit-cex').textContent = F.dropped_cex;
  $('#fit-fam').textContent = F.dropped_family;
  $('#net-community').textContent = (R.netting.community_pct * 100).toFixed(0);
  $('#net-capture').textContent = (R.netting.capture_pct * 100).toFixed(1);
  $('#net-farm').textContent = R.netting.farm_max_pct;
  $('#net-thin').textContent = R.netting.thin_max_pct;
  const counts = { FARM: 0, THIN: 0, SKIP: 0 };
  for (const r of R.rows) counts[r.verdict]++;
  $('#netting-line').textContent = `On this board that nets out at ${counts.FARM} FARM, ${counts.THIN} THIN and ${counts.SKIP} SKIP${counts.FARM === 0 ? ' — no row clears the FARM bar at these assumptions, and the bar is stated, not fitted' : ''}.`;
  const miss = (x) => `×${x.toFixed(2)}`;
  $('#validation-body').innerHTML = [
    ['Flat 0.25× TVL — the starter\u2019s constant', V.loo.flat, V.split.flat],
    ['Category median — comps-1 (rounds 1\u20132)', V.loo.comps1, V.split.comps1],
    ['Size curve — comps-2, shipped', V.loo.comps2, V.split.comps2],
  ].map(([n, l, s]) => `<tr style="cursor:default"><td>${n}</td><td class="num">${miss(l)}</td><td class="num">${miss(s)}</td></tr>`).join('');
  const termLabel = { momentum: 'Momentum (7-day TVL change)', maturity: 'Maturity (listing age)', reach: 'Reach (chain count)', category: 'Category intercept' };
  $('#terms-body').innerHTML = V.terms.map((t) => `<tr style="cursor:default"><td>${termLabel[t.name] ?? t.name}</td><td class="num">${miss(t.loo_with)}</td><td class="num">${miss(t.split_with)}</td><td>${t.kept ? 'KEPT' : 'dropped'}</td></tr>`).join('');
  const k = $('#s-k'), g = $('#s-g'), a = $('#s-a');
  k.value = F.slope; g.value = 0; a.value = 0;
  const sync = () => {
    $('#s-k-v').textContent = `b = ${Number(k.value).toFixed(2)}`;
    $('#s-g-v').textContent = `× ${Number(g.value).toFixed(1)}`;
    $('#s-a-v').textContent = `× ${Number(a.value).toFixed(2)}`;
    const off = Math.abs(Number(k.value) - F.slope) > 0.006 || Number(g.value) !== 0 || Number(a.value) !== 0;
    state.sandbox = off ? { b: Number(k.value), g: Number(g.value), a: Number(a.value) } : null;
    const top = R.rows.map((r) => ({ r, p: LR.priced(r, state.sandbox) })).sort((x, y) => y.p.implied - x.p.implied).slice(0, 5);
    $('#sandbox-top').innerHTML = '<div><span>SANDBOX TOP 5</span><span></span></div>' +
      top.map(({ r, p }, i) => `<div><span>${i + 1}. ${esc(r.name)}</span><b>${money(p.implied)}</b></div>`).join('');
    renderBoard();
  };
  for (const el of [k, g, a]) el.addEventListener('input', sync);
  $('#s-reset').addEventListener('click', () => { k.value = F.slope; g.value = 0; a.value = 0; sync(); });
  sync();
}

/* Back to the shipped model, from the board's sandbox note too. */
function resetSandbox() {
  $('#s-k').value = LR.R.fit.slope; $('#s-g').value = 0; $('#s-a').value = 0;
  $('#s-k').dispatchEvent(new Event('input'));
}

function renderFoot() {
  const R = LR.R;
  $('#foot-line').innerHTML =
    `Source: ${esc(R.source)}. The board ranks ${R.board_size} of the snapshot's ${R.pre_token_size} pre-token protocols (${R.early_size} of them early finds below the house's $${(R.floor_usd / 1e6).toFixed(0)}M floor; the rest of the pre-token set is centralised exchanges and versioned pools) ` +
    `priced by one curve fitted on ${R.fit.n} cleaned traded protocols of the ${R.live_peers} whose tokens already trade. Model ${esc(R.model_version)}, stated in full under “The model, open”. ` +
    `Built for make.fun's “Build the best token launch radar” bounty.`;
}

renderMast();
renderFoot();
fillFilterOptions();
initBoard();
initPalette();
renderMarket();
renderModel();
for (const b of document.querySelectorAll('#tabs button[data-view]')) b.addEventListener('click', () => show(b.dataset.view));
window.addEventListener('hashchange', () => { if (!hashGuard) applyHash(); });
applyParams();
