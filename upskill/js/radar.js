// Dependency-free SVG radar chart (works offline, themeable via CSS vars).
// target = required level (blue, shaded), actual = current level (brand color line).
export function radar(el, labels, target, actual) {
  const n = labels.length, cx = 220, cy = 190, R = 120;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + Math.cos(a) * (v / 5) * R, cy + Math.sin(a) * (v / 5) * R]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  const rings = [1, 2, 3, 4, 5].map((r) => `<polygon points="${poly(labels.map(() => r))}" class="r-ring"/>`).join("");
  const axes = labels.map((_, i) => { const [x, y] = pt(i, 5); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="r-ring"/>`; }).join("");
  const txt = labels.map((l, i) => {
    const [x, y] = pt(i, 5.9), dx = x - cx, anchor = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
    return `<text x="${x}" y="${y + 4}" text-anchor="${anchor}" class="r-label">${l.replace(/&/g, "&amp;")}</text>`;
  }).join("");
  const dots = actual.map((v, i) => { const [x, y] = pt(i, v); return `<circle cx="${x}" cy="${y}" r="3.5" class="r-dot"/>`; }).join("");
  el.innerHTML = `<svg viewBox="-50 0 540 390" class="radar" role="img" aria-label="Skill radar: required vs current level">${rings}${axes}
    <polygon points="${poly(target)}" class="r-target"/><polygon points="${poly(actual)}" class="r-actual"/>${dots}${txt}</svg>
    <div class="r-legend"><span><i class="sw sw-t"></i>Required level</span><span><i class="sw sw-a"></i>Current level</span></div>`;
}
