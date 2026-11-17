// Launch Radar — app.js: the router and the wiring that boots the page.
// Two address systems, one state. Query parameters (?view=detail&slug=…,
// ?cat=Lending, ?pin=…, ?cmp=…, ?tab=…) stage the page on first load — the
// entry's screenshots are captured that way — then fold into the hash. The
// hash is the live address: #/board, #/detail/<slug>?tab=…, #/market,
// #/model; on the board, filters, sort, pins and compare picks ride along,
// so any state reachable by clicking can be linked and reloaded as-is.

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

/* First load: query parameters win (they stage the screenshots), then the
   hash takes over as the live address. */
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
  const R = LR.R;
  for (const el of document.querySelectorAll('[data-c]')) el.textContent = R.constants[el.dataset.c];
  const k = $('#s-k'), g = $('#s-g'), a = $('#s-a');
  k.value = R.constants.shrink_k; g.value = 1; a.value = R.constants.age_range;
  const sync = () => {
    $('#s-k-v').textContent = `K = ${k.value}`;
    $('#s-g-v').textContent = `× ${Number(g.value).toFixed(1)}`;
    $('#s-a-v').textContent = `range ${Number(a.value).toFixed(2)}`;
    const off = Number(k.value) !== R.constants.shrink_k || Number(g.value) !== 1 || Number(a.value) !== R.constants.age_range;
    state.sandbox = off ? { k: Number(k.value), g: Number(g.value), a: Number(a.value) } : null;
    const top = R.rows.map((r) => ({ r, p: LR.priced(r, state.sandbox) })).sort((x, y) => y.p.implied - x.p.implied).slice(0, 5);
    $('#sandbox-top').innerHTML = '<div><span>SANDBOX TOP 5</span><span></span></div>' +
      top.map(({ r, p }, i) => `<div><span>${i + 1}. ${esc(r.name)}</span><b>${money(p.implied)}</b></div>`).join('');
    renderBoard();
  };
  for (const el of [k, g, a]) el.addEventListener('input', sync);
  $('#s-reset').addEventListener('click', () => { k.value = R.constants.shrink_k; g.value = 1; a.value = R.constants.age_range; sync(); });
  sync();
}

/* Back to the shipped model, from the board's sandbox note too. */
function resetSandbox() {
  $('#s-k').value = LR.R.constants.shrink_k; $('#s-g').value = 1; $('#s-a').value = LR.R.constants.age_range;
  $('#s-k').dispatchEvent(new Event('input'));
}

function renderFoot() {
  const R = LR.R;
  $('#foot-line').innerHTML =
    `Source: ${esc(R.source)}. The board prices ${R.board_size} pre-token protocols (${R.early_size} of them early finds below the house's $${(R.floor_usd / 1e6).toFixed(0)}M floor) ` +
    `against ${R.live_peers} live peers whose tokens already trade. Model ${esc(R.model_version)}, stated in full under “The model, open”. ` +
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
drawScope();
