// Dependency-free SVG radar chart (works offline, themeable via CSS vars).
// target = required level (blue, dashed), actual = current level (brand colour).
// v12: gradient fills, glowing dots with hover tooltips, optional rotating "scan" sweep (opts.sweep).
let uid = 0; // unique gradient ids, because several radars can be on one page
export function radar(el, labels, target, actual, opts = {}) {
  const k = ++uid, n = labels.length, cx = 220, cy = 190, R = 120;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + Math.cos(a) * (v / 5) * R, cy + Math.sin(a) * (v / 5) * R]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  const rings = [1, 2, 3, 4, 5].map((r) => `<polygon points="${poly(labels.map(() => r))}" class="r-ring"/>`).join("");
  const axes = labels.map((_, i) => { const [x, y] = pt(i, 5); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="r-ring"/>`; }).join("");
  const txt = labels.map((l, i) => {
    const [x, y] = pt(i, 5.9), dx = x - cx, anchor = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
    return `<text x="${x}" y="${y + 4}" text-anchor="${anchor}" class="r-label">${l.replace(/&/g, "&amp;")}</text>`;
  }).join("");
  const dots = actual.map((v, i) => { const [x, y] = pt(i, v); return `<circle cx="${x}" cy="${y}" r="4" class="r-dot" style="--k:${i}"><title>${labels[i].replace(/&/g, "&amp;")}: ${v} (required ${target[i]})</title></circle>`; }).join("");
  // trailing wedge for the scan sweep: 12 thin sectors that fade out behind the leading edge
  let sweep = "";
  if (opts.sweep) {
    const SEG = 12, STEP = 3.2 * Math.PI / 180;
    const sector = (a0, a1) => `M${cx} ${cy} L${cx + Math.cos(a0) * R} ${cy + Math.sin(a0) * R} A${R} ${R} 0 0 1 ${cx + Math.cos(a1) * R} ${cy + Math.sin(a1) * R}Z`;
    const wedge = Array.from({ length: SEG }, (_, i) => `<path d="${sector(-Math.PI / 2 - (i + 1) * STEP, -Math.PI / 2 - i * STEP)}" style="fill:var(--brand)" opacity="${(0.2 * (1 - i / SEG)).toFixed(3)}"/>`).join("");
    sweep = `<g class="r-sweep">${wedge}<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R}" style="stroke:var(--brand)" stroke-width="1.5" opacity=".7"/></g>`;
  }
  el.innerHTML = `<svg viewBox="-50 0 540 390" class="radar" role="img" aria-label="Skill radar: required vs current level">
    <defs>
      <linearGradient id="rg-a${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--brand);stop-opacity:.5"/><stop offset="1" style="stop-color:#FB923C;stop-opacity:.16"/></linearGradient>
      <linearGradient id="rg-t${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--info);stop-opacity:.28"/><stop offset="1" style="stop-color:#6366F1;stop-opacity:.06"/></linearGradient>
    </defs>${rings}${axes}${sweep}
    <polygon points="${poly(target)}" class="r-target" style="fill:url(#rg-t${k})"/><polygon points="${poly(actual)}" class="r-actual" style="fill:url(#rg-a${k})"/>${dots}${txt}</svg>
    <div class="r-legend"><span><i class="sw sw-t"></i>Required level</span><span><i class="sw sw-a"></i>Current level</span></div>`;
}
