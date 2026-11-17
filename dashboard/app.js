// Launch Radar — the page's working half. Everything renders from window.RADAR,
// the dataset main.ts wrote beside this page: no fetch, no framework, no network.
//
// Three views share one dataset: the board (ranked, filterable, clickable into a
// detail view with the valuation waterfall and the farm plan), the market's
// evidence (the category multiples and the live set they were read from), and the
// model itself, with a sandbox that re-prices the board live so a reader can see
// which conclusions hang on which constant. Deep links work: ?view=detail&slug=…
// or ?cat=Lending opens the page in that state.

const R = window.RADAR;
const $ = (sel) => document.querySelector(sel);

/* ---------------- formatting ---------------- */
function money(v) {
  if (v === null || v === undefined) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}
function pct(v) {
  if (v === null || v === undefined) return '—';
  return `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`;
}
function ageLabel(days) {
  if (days === null || days === undefined) return 'unknown';
  if (days >= 730) return `${(days / 365).toFixed(1)}y`;
  if (days >= 60) return `${Math.round(days / 30.4)}mo`;
  return `${days}d`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* ---------------- state ---------------- */
const state = {
  view: 'board',
  slug: null,
  q: '', cat: '', chain: '', size: 0, tier: 'all', sort: 'implied',
  sandbox: null, // {k, g, a} while the sandbox sliders are off their shipped values
};
const compByCat = new Map(R.categories.map((c) => [c.category, c]));

/* The shipped model's per-row value, or the sandbox's re-pricing of it. */
function priced(row) {
  if (!state.sandbox) return { implied: row.implied_value_usd, multiple: row.parts.base_multiple };
  const sb = state.sandbox;
  const comp = row.category ? compByCat.get(row.category) : undefined;
  let multiple = R.global_multiple;
  if (comp) {
    const blended = Math.exp((comp.peers * Math.log(comp.median_multiple) + sb.k * Math.log(R.global_multiple)) / (comp.peers + sb.k));
    multiple = Math.min(R.constants.multiple_max, Math.max(R.constants.multiple_min, blended));
  }
  const gp = row.parts.growth_pct;
  const w = (gp >= 0 ? R.constants.growth_up_weight : R.constants.growth_down_weight) * sb.g;
  const growthMult = 1 + (gp / 100) * w;
  const age = row.age_days ?? R.constants.unknown_age_days;
  const ageMult = (1 - sb.a) + (Math.min(Math.max(age, 0), R.constants.age_cap_days) / R.constants.age_cap_days) * sb.a;
  const implied = Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * ageMult * row.parts.chain_multiplier));
  return { implied, multiple };
}

function visibleRows() {
  let rows = R.rows.map((r) => ({ ...r, _p: priced(r) }));
  if (state.tier !== 'all') rows = rows.filter((r) => r.tier === state.tier);
  if (state.cat) rows = rows.filter((r) => (r.category ?? '') === state.cat);
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  if (state.size > 0) rows = rows.filter((r) => r.tvl_usd >= state.size);
  if (state.q) {
    const q = state.q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.slug.includes(q));
  }
  const by = {
    implied: (a, b) => b._p.implied - a._p.implied,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
  }[state.sort];
  rows.sort(by || ((a, b) => b._p.implied - a._p.implied));
  return rows;
}

/* ---------------- masthead + scope ---------------- */
function renderMast() {
  $('#as-of').textContent = R.as_of;
  $('#model-version').textContent = R.model_version.toUpperCase();
  const totalImplied = R.rows.reduce((s, r) => s + r.implied_value_usd, 0);
  $('#mast-stats').innerHTML = [
    [String(R.scanned_size), 'protocols scanned'],
    [String(R.board_size), 'pre-token, ranked'],
    [`${R.watchlist_size}/${R.watchlist_size}`, 'watchlist covered'],
    [money(totalImplied), 'implied launch value'],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  $('#foot-line').innerHTML =
    `Source: ${esc(R.source)}. The board prices ${R.board_size} pre-token protocols (${R.early_size} of them early finds below the house's $${(R.floor_usd / 1e6).toFixed(0)}M floor) ` +
    `against ${R.live_peers} live peers whose tokens already trade. Model ${esc(R.model_version)}, stated in full under “The model, open”. ` +
    `Built for make.fun's “Build the best token launch radar” bounty.`;
}

function drawScope() {
  const cv = $('#sweep');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const cx = 66, cy = 66, rad = 62;
  const blips = R.rows.slice(0, 40).map((r, i) => {
    let h = 0;
    for (const ch of r.slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const a = (h / 997) * Math.PI * 2;
    const d = 12 + ((h * 7) % 44);
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, hot: i < 5 };
  });
  let t = 0;
  (function frame() {
    t += 0.011;
    ctx.clearRect(0, 0, 132, 132);
    ctx.strokeStyle = 'rgba(61,255,143,0.25)';
    for (const rr of [rad, rad * 0.66, rad * 0.33]) {
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy);
    ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); ctx.stroke();
    const grad = ctx.createConicGradient ? ctx.createConicGradient(t, cx, cy) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(61,255,143,0.30)');
      grad.addColorStop(0.12, 'rgba(61,255,143,0)');
      grad.addColorStop(1, 'rgba(61,255,143,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#3dff8f';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad); ctx.stroke();
    for (const b of blips) {
      const da = Math.atan2(b.y - cy, b.x - cx);
      let diff = (t - da) % (Math.PI * 2);
      if (diff < 0) diff += Math.PI * 2;
      const glow = Math.max(0, 1 - diff / 2.2);
      ctx.fillStyle = b.hot ? `rgba(255,180,84,${0.35 + glow * 0.65})` : `rgba(61,255,143,${0.18 + glow * 0.7})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.hot ? 2.6 : 1.8, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(frame);
  })();
}

/* ---------------- board ---------------- */
function momCell(v) {
  if (v === null || v === undefined) return '<span class="mom">—</span>';
  const w = Math.min(100, (Math.abs(v) / 40) * 100);
  const cls = v >= 0 ? 'up' : 'dn';
  return `<span class="mom"><span class="${cls}">${pct(v)}</span><span class="bar"><i class="${cls}" style="width:${w}%"></i></span></span>`;
}

function renderBoard() {
  const rows = visibleRows();
  $('#f-count').textContent = `${rows.length} of ${R.board_size} rows`;
  $('#sandbox-note').hidden = !state.sandbox;
  $('#board-body').innerHTML = rows.map((r, i) => `
    <tr data-slug="${esc(r.slug)}" class="${(state.sort === 'implied' ? i : r.rank - 1) < 3 ? 'top' : ''}">
      <td class="rank">${state.sandbox || state.sort !== 'implied' ? i + 1 : r.rank}</td>
      <td><span class="pname">${esc(r.name)}</span><span class="tier ${r.tier}">${r.tier === 'watchlist' ? 'WATCHLIST' : 'EARLY'}</span><br><span class="pslug">${esc(r.slug)}</span></td>
      <td>${esc(r.category ?? '—')}</td>
      <td><span class="chips">${r.chains.slice(0, 3).map((c) => `<span class="chip">${esc(c)}</span>`).join('')}${r.chains.length > 3 ? `<span class="chip">+${r.chains.length - 3}</span>` : ''}</span></td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td>${momCell(r.change_7d)}</td>
      <td class="num">${ageLabel(r.age_days)}</td>
      <td class="num">${r._p.multiple.toFixed(2)}×</td>
      <td class="num implied">${money(r._p.implied)}</td>
    </tr>`).join('');
  for (const tr of document.querySelectorAll('#board-body tr')) {
    tr.addEventListener('click', () => openDetail(tr.dataset.slug));
  }
  const top = rows[0];
  $('#board-foot').textContent = top
    ? `Strongest signal: ${top.name} — ${money(top.tvl_usd)} of TVL priced at ${top._p.multiple.toFixed(2)}× for an implied ${money(top._p.implied)} launch. Click any row for its valuation waterfall and farm plan.`
    : 'No protocol matches those filters. Loosen one and the radar sweeps again.';
}

/* ---------------- farm plan (the page's own telling of the model's playbook) ---------------- */
function ecoOf(chain) {
  if (chain === 'Solana') return 'solana';
  if (chain === 'Bitcoin' || chain === 'Lightning Network') return 'bitcoin';
  return 'evm';
}
function gasOf(chain) {
  const eco = ecoOf(chain);
  if (eco === 'solana') return 'a few cents of SOL in fees';
  if (eco === 'bitcoin') return 'one ordinary on-chain fee';
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

/* ---------------- detail ---------------- */
function openDetail(slug) {
  const row = R.rows.find((r) => r.slug === slug);
  if (!row) return;
  state.view = 'detail';
  state.slug = slug;
  const p = row.parts;
  const comp = row.category ? compByCat.get(row.category) : undefined;
  const steps = [];
  let run = row.tvl_usd;
  steps.push(['TVL today', run]);
  run *= p.base_multiple; steps.push([`× category multiple ${p.base_multiple.toFixed(3)}`, run]);
  run *= p.growth_multiplier; steps.push([`× momentum ${p.growth_multiplier.toFixed(3)}`, run]);
  run *= p.age_multiplier; steps.push([`× maturity ${p.age_multiplier.toFixed(3)}`, run]);
  run *= p.chain_multiplier; steps.push([`× reach ${p.chain_multiplier.toFixed(3)}`, run]);
  const maxLog = Math.log10(Math.max(...steps.map((s) => s[1])));
  const minLog = Math.log10(Math.max(1, Math.min(...steps.map((s) => s[1])))) - 0.4;
  const wf = steps.map(([lab, v], i) => `
    <div class="wf ${i === steps.length - 1 ? 'final' : ''}">
      <span class="lab">${esc(lab)}</span>
      <span class="track"><i style="width:${Math.max(4, ((Math.log10(Math.max(v, 1)) - minLog) / (maxLog - minLog)) * 100)}%"></i></span>
      <span class="val">${money(v)}</span>
    </div>`).join('');
  const peers = R.live.filter((l) => l.category === row.category).slice(0, 5);
  $('#view-detail').innerHTML = `
    <button class="backbtn" id="back">← Back to the board</button>
    <div class="detail-head">
      <h2>${esc(row.name)}</h2>
      <span class="rankbadge">#${row.rank} ON THE BOARD</span>
      <span class="tier ${row.tier}">${row.tier === 'watchlist' ? 'HOUSE WATCHLIST' : 'EARLY FIND — BELOW THE FLOOR'}</span>
    </div>
    <p class="lede">${esc(row.category ?? 'Uncategorised')} · first chain ${esc(row.chains[0] ?? '—')} · tracked by DefiLlama since ${esc(row.listed_at ?? 'an unrecorded date')} · still no token: that is the whole opportunity.</p>
    <div class="facts">
      <div class="fact"><b>${money(row.tvl_usd)}</b><span>TVL</span></div>
      <div class="fact"><b>${pct(row.change_7d)}</b><span>TVL, 7 days</span></div>
      <div class="fact"><b>${row.age_days === null ? '—' : `${row.age_days}d`}</b><span>Age on DefiLlama</span></div>
      <div class="fact"><b>${row.chains.length}</b><span>Chains</span></div>
      <div class="fact"><b>${p.base_multiple.toFixed(3)}×</b><span>Category multiple</span></div>
      <div class="fact"><b>${money(row.implied_value_usd)}</b><span>Implied launch value</span></div>
    </div>
    <h3 class="sect">How the number is built</h3>
    <div class="waterfall">${wf}</div>
    <p class="lede">${comp
      ? `The multiple is the market's, not ours: ${comp.peers} live ${esc(row.category)} protocol${comp.peers === 1 ? '' : 's'} trade${comp.peers === 1 ? 's' : ''} at a median ${comp.median_multiple.toFixed(2)}× their TVL; shrunk toward the global ${R.global_multiple.toFixed(2)}× by their count, the board uses ${comp.used_multiple.toFixed(2)}×.`
      : `No live peer in this category trades in the snapshot, so the board prices ${esc(row.name)} at the market's global median, ${R.global_multiple.toFixed(2)}× TVL.`}
    ${peers.length ? ` Live peers on the board's evidence table: ${peers.map((l) => `${esc(l.name)} (${l.mcap_usd && l.tvl_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) : '—'}×)`).join(' · ')}.` : ''}</p>
    <h3 class="sect">The farm plan — six steps to be in line if it launches</h3>
    <div class="plan">${farmPlan(row).map(([text, cost, time]) => `
      <div class="step"><div><p>${esc(text)}</p><p class="meta">COST — ${esc(cost)} · TIME — ${esc(time)}</p></div></div>`).join('')}
    </div>`;
  $('#back').addEventListener('click', () => show('board'));
  show('detail');
}

/* ---------------- market + model views ---------------- */
function renderMarket() {
  const maxUsed = Math.max(...R.categories.map((c) => c.used_multiple));
  $('#comps-body').innerHTML = R.categories.map((c) => `
    <tr style="cursor:default">
      <td>${esc(c.category)}</td><td class="num">${c.peers}</td>
      <td class="num">${c.median_multiple.toFixed(2)}×</td><td class="num">${c.used_multiple.toFixed(2)}×</td>
      <td><span class="mom"><span class="bar" style="width:110px"><i class="up" style="width:${(Math.log(c.used_multiple) / Math.log(maxUsed)) * 100}%"></i></span></span></td>
    </tr>`).join('');
  $('#live-body').innerHTML = R.live.map((l) => `
    <tr style="cursor:default">
      <td><span class="pname">${esc(l.name)}</span><br><span class="pslug">${esc(l.slug)}</span></td>
      <td>${esc(l.category ?? '—')}</td>
      <td class="num">${money(l.mcap_usd)}</td><td class="num">${money(l.tvl_usd)}</td>
      <td class="num">${l.mcap_usd && l.tvl_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) : '—'}×</td>
    </tr>`).join('');
}

function renderModel() {
  for (const el of document.querySelectorAll('[data-c]')) {
    el.textContent = R.constants[el.dataset.c];
  }
  const k = $('#s-k'), g = $('#s-g'), a = $('#s-a');
  k.value = R.constants.shrink_k; g.value = 1; a.value = R.constants.age_range;
  const sync = () => {
    $('#s-k-v').textContent = `K = ${k.value}`;
    $('#s-g-v').textContent = `× ${Number(g.value).toFixed(1)}`;
    $('#s-a-v').textContent = `range ${Number(a.value).toFixed(2)}`;
    const off = Number(k.value) !== R.constants.shrink_k || Number(g.value) !== 1 || Number(a.value) !== R.constants.age_range;
    state.sandbox = off ? { k: Number(k.value), g: Number(g.value), a: Number(a.value) } : null;
    const top = R.rows.map((r) => ({ r, p: priced(r) })).sort((x, y) => y.p.implied - x.p.implied).slice(0, 5);
    $('#sandbox-top').innerHTML = '<div><span>SANDBOX TOP 5</span><span></span></div>' +
      top.map(({ r, p }, i) => `<div><span>${i + 1}. ${esc(r.name)}</span><b>${money(p.implied)}</b></div>`).join('');
    renderBoard();
  };
  k.addEventListener('input', sync);
  g.addEventListener('input', sync);
  a.addEventListener('input', sync);
  $('#s-reset').addEventListener('click', () => { k.value = R.constants.shrink_k; g.value = 1; a.value = R.constants.age_range; sync(); });
  sync();
}

/* ---------------- view switching + filters ---------------- */
function show(view) {
  state.view = view;
  for (const v of ['board', 'detail', 'market', 'model']) {
    $(`#view-${v}`).hidden = v !== view;
  }
  for (const b of document.querySelectorAll('#tabs button')) {
    b.classList.toggle('on', b.dataset.view === view || (view === 'detail' && b.dataset.view === 'board'));
  }
  window.scrollTo(0, 0);
}

function initFilters() {
  const cats = [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort();
  $('#f-cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  const chains = [...new Set(R.rows.flatMap((r) => r.chains))].sort();
  $('#f-chain').innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option>${esc(c)}</option>`).join('');
  $('#f-q').addEventListener('input', (e) => { state.q = e.target.value; renderBoard(); });
  $('#f-cat').addEventListener('change', (e) => { state.cat = e.target.value; renderBoard(); });
  $('#f-chain').addEventListener('change', (e) => { state.chain = e.target.value; renderBoard(); });
  $('#f-size').addEventListener('change', (e) => { state.size = Number(e.target.value); renderBoard(); });
  $('#f-sort').addEventListener('change', (e) => { state.sort = e.target.value; renderBoard(); });
  for (const b of document.querySelectorAll('#f-tier button')) {
    b.addEventListener('click', () => {
      state.tier = b.dataset.tier;
      for (const x of document.querySelectorAll('#f-tier button')) x.classList.toggle('on', x === b);
      renderBoard();
    });
  }
  $('#sandbox-reset').addEventListener('click', () => {
    state.sandbox = null;
    $('#s-k').value = R.constants.shrink_k; $('#s-g').value = 1; $('#s-a').value = R.constants.age_range;
    $('#s-k').dispatchEvent(new Event('input'));
  });
  for (const b of document.querySelectorAll('#tabs button')) {
    b.addEventListener('click', () => show(b.dataset.view));
  }
}

/* ---------------- staging: deep links open the page in a chosen state ---------------- */
function applyParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('q')) { state.q = q.get('q'); $('#f-q').value = state.q; }
  if (q.get('cat')) { state.cat = q.get('cat'); $('#f-cat').value = state.cat; }
  if (q.get('chain')) { state.chain = q.get('chain'); $('#f-chain').value = state.chain; }
  if (q.get('size')) { state.size = Number(q.get('size')); $('#f-size').value = q.get('size'); }
  if (q.get('sort')) { state.sort = q.get('sort'); $('#f-sort').value = state.sort; }
  if (q.get('tier')) {
    state.tier = q.get('tier');
    for (const x of document.querySelectorAll('#f-tier button')) x.classList.toggle('on', x.dataset.tier === state.tier);
  }
  const view = q.get('view');
  if (view === 'detail' && q.get('slug')) openDetail(q.get('slug'));
  else if (view === 'market' || view === 'model') show(view);
  else { renderBoard(); show('board'); }
}

renderMast();
initFilters();
renderMarket();
renderModel();
renderBoard();
applyParams();
drawScope();
