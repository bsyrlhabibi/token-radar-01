// Launch Radar — palette.js: the command palette.
// Ctrl+K, "/" (when not typing), or the Command button opens it. One list:
// every protocol (jump to its detail), the three views, and the page's
// actions (CSV, pins, filters, comparison). Subsequence-fuzz matching over
// names and slugs; arrows move, Enter opens, Esc closes, rows clickable.

let palItems = [], palAt = 0;

function palActions() {
  return [
    { kind: 'View', label: 'The board — all ranked rows', run: () => show('board') },
    { kind: 'View', label: "The market's evidence", run: () => show('market') },
    { kind: 'View', label: 'The model, open', run: () => show('model') },
    { kind: 'Action', label: 'Export the board as CSV', run: exportCsv },
    { kind: 'Action', label: 'Clear all pins', run: () => { state.pins.clear(); renderBoard(); syncHash(); } },
    { kind: 'Action', label: 'Reset all filters', run: resetFilters },
    { kind: 'Action', label: 'Compare the tray picks', run: renderCompare },
  ];
}

/* Subsequence fuzz: q's characters, in order, somewhere in text; the score
   rewards an early, tight match; -1 is no match. */
function fuzz(q, text) {
  if (!q) return 0;
  let ti = 0, score = 0, streak = 0;
  for (const ch of q) {
    const at = text.indexOf(ch, ti);
    if (at < 0) return -1;
    streak = at === ti ? streak + 1 : 0;
    score += streak * 2 - (at - ti) * 0.1;
    ti = at + 1;
  }
  return score - ti * 0.01;
}

function palQuery(q) {
  q = q.trim().toLowerCase();
  const acts = palActions().map((a) => ({ ...a, score: fuzz(q, a.label.toLowerCase()) + (q ? 0 : 1) })).filter((a) => a.score >= 0);
  const protos = LR.R.rows
    .map((r) => ({ kind: 'Protocol', label: r.name, sub: `${r.slug} · ${money(r.implied_value_usd)} implied · #${r.rank}`, score: Math.max(fuzz(q, r.name.toLowerCase()), fuzz(q, r.slug)), run: () => openDetail(r.slug) }))
    .filter((a) => a.score >= 0).sort((a, b) => b.score - a.score).slice(0, 9);
  return [...protos, ...acts].slice(0, 14);
}

function renderPalette() {
  $('#pal-list').innerHTML = palItems.map((a, i) => `<div class="pal-item${i === palAt ? ' on' : ''}" data-pal="${i}"><span class="tier early kind">${esc(a.kind)}</span><span>${esc(a.label)}${a.sub ? `<br><span class="pslug">${esc(a.sub)}</span>` : ''}</span></div>`).join('') || '<div class="pal-item">No match on the radar.</div>';
  for (const el of document.querySelectorAll('[data-pal]')) {
    el.addEventListener('click', () => { palAt = Number(el.dataset.pal); palRun(); });
    el.addEventListener('mousemove', () => { if (palAt !== Number(el.dataset.pal)) { palAt = Number(el.dataset.pal); renderPalette(); } });
  }
}

function palRun() { const a = palItems[palAt]; closePalette(); if (a) a.run(); }
function openPalette() {
  $('#palette').hidden = false;
  const q = $('#pal-q');
  q.value = ''; palItems = palQuery(''); palAt = 0;
  renderPalette(); q.focus();
}
function closePalette() { $('#palette').hidden = true; }

function initPalette() {
  $('#palette-open').addEventListener('click', openPalette);
  $('#pal-q').addEventListener('input', (e) => { palItems = palQuery(e.target.value); palAt = 0; renderPalette(); });
  $('#pal-q').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palAt = Math.min(palItems.length - 1, palAt + 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palAt = Math.max(0, palAt - 1); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); palRun(); }
    else if (e.key === 'Escape') closePalette();
  });
  $('#palette').addEventListener('click', (e) => { if (e.target.id === 'palette') closePalette(); });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').hidden ? openPalette() : closePalette(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape') { closePalette(); $('#compare-panel').hidden = true; }
    else if (!typing && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') show('board'); else if (k === 'm') show('market'); else if (k === 'p') show('model');
    }
  });
}
