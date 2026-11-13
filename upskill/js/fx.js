// Visual effects only (no data, no API): particle network background, scroll reveal, stat count-up, landing cursor light + tilt.
import { $, $$ } from "./ui.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Floating particle network that reacts to the cursor. Uses the current --brand color.
function particles() {
  const cv = $("#fx"), ctx = cv.getContext("2d");
  let w, h, pts = [], mouse = { x: -999, y: -999 }, color = "244,63,94", raf;
  const rgb = () => {
    const hex = getComputedStyle(document.body).getPropertyValue("--brand").trim().replace("#", "");
    if (hex.length === 6) color = [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)).join(",");
  };
  const size = () => {
    w = cv.width = innerWidth; h = cv.height = innerHeight;
    pts = Array.from({ length: Math.min(70, Math.floor((w * h) / 22000)) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35 }));
  };
  const dark = () => document.body.classList.contains("dark");
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    const a = dark() ? 0.5 : 0.3;
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.fillStyle = `rgba(${color},${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.28); ctx.fill();
    }
    // Lines between nearby particles, and to the cursor
    const all = [...pts, mouse];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y), max = all[j] === mouse ? 160 : 120;
      if (d < max) { ctx.strokeStyle = `rgba(${color},${(1 - d / max) * a * .8})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(all[i].x, all[i].y); ctx.lineTo(all[j].x, all[j].y); ctx.stroke(); }
    }
    raf = requestAnimationFrame(draw);
  };
  addEventListener("resize", size);
  addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden) draw(); });
  new MutationObserver(rgb).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  rgb(); size(); draw();
}

// Fade/slide elements in as they scroll into view
function reveal() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
  const watch = () => $$(".card:not(.reveal),.hero:not(.reveal)").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  watch();
  // Tab switches show a different dashboard: re-check so its cards animate too
  $$(".tab").forEach((t) => t.addEventListener("click", () => setTimeout(() => { watch(); $$(".dash.active .reveal").forEach((el) => el.classList.add("in")); }, 30)));
}

// Count up numeric stats (e.g. "62%", "3") inside the elements matched by sel. Re-callable after a re-render.
export function countUp(sel = "#stats .stat b") {
  $$(sel).forEach((el) => {
    const m = el.textContent.match(/^(\d+)(%?)$/); if (!m) return;
    if (reduce) return;
    const end = +m[1], t0 = performance.now();
    const tick = (t) => { const k = Math.min((t - t0) / 1100, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + m[2]; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

// Landing only: a soft light that follows the cursor, and a gentle 3D tilt on the preview card
function landingMotion() {
  const land = $("#landing"), card = $("#landCard"); if (!land) return;
  land.addEventListener("pointermove", (e) => {
    land.style.setProperty("--mx", e.clientX + "px"); land.style.setProperty("--my", e.clientY + "px");
    if (!card) return;
    const r = card.getBoundingClientRect(), dx = (e.clientX - (r.left + r.width / 2)) / innerWidth, dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    card.style.setProperty("--ry", (dx * 14).toFixed(2) + "deg"); card.style.setProperty("--rx", (-dy * 14).toFixed(2) + "deg");
  });
  land.addEventListener("pointerleave", () => { card?.style.setProperty("--rx", "0deg"); card?.style.setProperty("--ry", "0deg"); });
}

export function initFX() {
  if (!reduce) { particles(); landingMotion(); }
  reveal(); countUp();
}
