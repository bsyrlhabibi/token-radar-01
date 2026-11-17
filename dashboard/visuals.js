// Launch Radar — visuals.js: the masthead scope, drawn once.
/* The scope, drawn once: rings, a sweep caught mid-pass, and blips placed
   by hashing the top forty slugs — the picture is the data, identical on
   every load, so a screenshot of it is a true one. */
function drawScope() {
  const cv = $('#sweep');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const cx = 66, cy = 66, rad = 62, t = 2.35;
  ctx.strokeStyle = 'rgba(61,255,143,0.25)';
  for (const rr of [rad, rad * 0.66, rad * 0.33]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); ctx.stroke();
  ctx.strokeStyle = '#3dff8f';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad); ctx.stroke();
  LR.R.rows.slice(0, 40).forEach((r, i) => {
    let h = 0;
    for (const ch of r.slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const a = (h / 997) * Math.PI * 2, d = 12 + ((h * 7) % 44);
    let diff = (t - a) % (Math.PI * 2);
    if (diff < 0) diff += Math.PI * 2;
    const glow = Math.max(0, 1 - diff / 2.2);
    ctx.fillStyle = i < 5 ? `rgba(255,180,84,${0.35 + glow * 0.65})` : `rgba(61,255,143,${0.18 + glow * 0.7})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, i < 5 ? 2.6 : 1.8, 0, Math.PI * 2); ctx.fill();
  });
}
