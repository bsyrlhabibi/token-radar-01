// Launch Radar — views.js: the masthead (snapshot, split line) and the
// market's evidence — compsRows (detail.js) and the live set.

function renderMast() {
  const R = LR.R;
  $('#as-of').textContent = R.as_of;
  $('#model-version').textContent = R.model_version.toUpperCase();
  const totalImplied = R.rows.reduce((s, r) => s + r.implied_value_usd, 0);
  $('#mast-stats').innerHTML = [
    [String(R.scanned_size), 'protocols scanned'], [String(R.board_size), 'pre-token, ranked'],
    [`${R.watchlist_size}/${R.watchlist_size}`, 'watchlist covered'], [money(totalImplied), 'implied launch value'],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  $('#split-line').textContent = `${R.board_size} pre-token protocols ranked · ${R.live_peers} live peers priced in the market's evidence`;
}

function renderMarket() {
  $('#comps-body').innerHTML = compsRows(null, true);
  $('#live-body').innerHTML = LR.R.live.map((l) => `<tr style="cursor:default">
    <td><span class="pname">${esc(l.name)}</span><br><span class="pslug">${esc(l.slug)}</span></td>
    <td>${esc(l.category ?? '—')}</td><td class="num">${money(l.mcap_usd)}</td><td class="num">${money(l.tvl_usd)}</td>
    <td class="num">${l.mcap_usd && l.tvl_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) : '—'}×</td></tr>`).join('');
}
