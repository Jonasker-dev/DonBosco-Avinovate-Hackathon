// Visual effects only (no data, no API). v12 "S-tier" layer:
//   particle universe (twinkle, cursor repel, click sparks, shooting stars) + cursor glow, card spotlight, 3D tilt,
//   magnetic buttons, click ripples, sliding tab pills, scroll progress, headline word reveal, page-leave curtain,
//   scroll reveal, stat count-up, landing cursor light.
// Everything respects prefers-reduced-motion. Nothing here reads or writes app data.
import { $, $$ } from "./ui.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches; // mouse-only effects (tilt, magnet, cursor glow)

// ---------------------------------------------------------------------------------------------
// 1. PARTICLE UNIVERSE (+ the soft cursor glow that shares its animation loop)
// ---------------------------------------------------------------------------------------------
function particles() {
  const cv = $("#fx"), ctx = cv.getContext("2d");
  const glow = document.createElement("div"); glow.id = "cursorGlow"; document.body.appendChild(glow);
  let w, h, dpr = 1, raf, pts = [], sparks = [], stars = [], t = 0, nextStar = 240;
  const mouse = { x: -999, y: -999, tx: -999, ty: -999, on: false };
  let brand = "244,63,94";
  const TINTS = ["brand", "brand", "brand", "amber", "indigo"];
  const FIXED = { amber: "251,146,60", indigo: "99,102,241" };
  const dark = () => document.body.classList.contains("dark");
  const readBrand = () => {
    const hex = getComputedStyle(document.body).getPropertyValue("--brand").trim().replace("#", "");
    if (hex.length === 6) brand = [0, 2, 4].map((i) => parseInt(hex.substr(i, 2), 16)).join(",");
  };
  const rgbOf = (tint) => (tint === "brand" ? brand : FIXED[tint]);

  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(95, Math.floor((w * h) / 17000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .38, vy: (Math.random() - .5) * .38,
      r: 1 + Math.random() * 1.9, depth: .3 + Math.random() * .9, ph: Math.random() * 6.28, tint: TINTS[(Math.random() * TINTS.length) | 0],
    }));
  };

  // a burst of sparks where the user clicks
  const burst = (x, y) => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * 6.283 + Math.random() * .4, s = 1.4 + Math.random() * 2.6;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, tint: TINTS[(Math.random() * TINTS.length) | 0] });
    }
    sparks.push({ x, y, ring: 0, life: 1, tint: "brand" }); // expanding shock ring
  };

  const shoot = () => {
    const fromLeft = Math.random() > .4, x = fromLeft ? Math.random() * w * .6 : w * (.5 + Math.random() * .5), y = Math.random() * h * .35;
    stars.push({ x, y, vx: 9 + Math.random() * 5, vy: 4 + Math.random() * 3, life: 1 });
  };

  const draw = () => {
    t += 1;
    ctx.clearRect(0, 0, w, h);
    const a = dark() ? .62 : .38, mx = (mouse.x - w / 2) / w, my = (mouse.y - h / 2) / h;
    // cursor glow eases toward the pointer
    mouse.tx += (mouse.x - mouse.tx) * .12; mouse.ty += (mouse.y - mouse.ty) * .12;
    glow.style.transform = `translate3d(${mouse.tx}px,${mouse.ty}px,0)`;

    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      // gentle repel from the cursor
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (mouse.on && d < 140 && d > 0) { p.x += (dx / d) * (140 - d) * .014; p.y += (dy / d) * (140 - d) * .014; }
      p.drawX = p.x + mx * 26 * p.depth; p.drawY = p.y + my * 26 * p.depth; // parallax depth
      const tw = .55 + Math.sin(t * .03 + p.ph) * .45;                       // twinkle
      ctx.fillStyle = `rgba(${rgbOf(p.tint)},${(a * tw * (.5 + p.depth * .5)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.drawX, p.drawY, p.r * (.8 + tw * .4), 0, 6.283); ctx.fill();
    }
    // constellation lines between neighbours, and to the cursor
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const B = pts[j], d = Math.hypot(A.drawX - B.drawX, A.drawY - B.drawY);
        if (d < 125) { ctx.strokeStyle = `rgba(${brand},${((1 - d / 125) * a * .7).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(A.drawX, A.drawY); ctx.lineTo(B.drawX, B.drawY); ctx.stroke(); }
      }
      if (mouse.on) {
        const d = Math.hypot(A.drawX - mouse.x, A.drawY - mouse.y);
        if (d < 170) { ctx.strokeStyle = `rgba(251,146,60,${((1 - d / 170) * a * 1.1).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(A.drawX, A.drawY); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      }
    }
    // click sparks + shock rings
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (s.ring !== undefined) {
        s.ring += 5; s.life -= .035;
        ctx.strokeStyle = `rgba(${brand},${(Math.max(s.life, 0) * .5).toFixed(3)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, s.ring, 0, 6.283); ctx.stroke();
      } else {
        s.x += s.vx; s.y += s.vy; s.vx *= .95; s.vy = s.vy * .95 + .04; s.life -= .022;
        ctx.fillStyle = `rgba(${rgbOf(s.tint)},${Math.max(s.life, 0).toFixed(3)})`; ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 * s.life + .4, 0, 6.283); ctx.fill();
      }
      if (s.life <= 0) sparks.splice(i, 1);
    }
    // shooting stars
    if (--nextStar <= 0) { shoot(); nextStar = 360 + Math.random() * 480; }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i]; s.x += s.vx; s.y += s.vy; s.life -= .014;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
      g.addColorStop(0, `rgba(${brand},${(Math.max(s.life, 0) * (dark() ? .9 : .6)).toFixed(3)})`); g.addColorStop(1, `rgba(${brand},0)`);
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
      if (s.life <= 0 || s.x > w + 60 || s.y > h + 60) stars.splice(i, 1);
    }
    raf = requestAnimationFrame(draw);
  };

  addEventListener("resize", size);
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; if (!mouse.on) { mouse.on = true; mouse.tx = e.clientX; mouse.ty = e.clientY; if (fine) glow.classList.add("on"); } }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { mouse.on = false; mouse.x = mouse.y = -999; glow.classList.remove("on"); });
  addEventListener("pointerdown", (e) => burst(e.clientX, e.clientY), { passive: true });
  document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden) draw(); });
  new MutationObserver(readBrand).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  readBrand(); size(); draw();
}

// ---------------------------------------------------------------------------------------------
// 2. SCROLL REVEAL + COUNT-UP (kept from earlier versions)
// ---------------------------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------------------------
// 3. LANDING: cursor light + 3D tilt on the preview card (kept)
// ---------------------------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------------------------
// 4. INTERACTION POLISH (event delegation, so it also works for anything re-rendered later)
// ---------------------------------------------------------------------------------------------
const SPOT = ".card,.stat,.tile,.roster-card,.week-card,.trend-card";

// Cards: the glow and border light follow the cursor (CSS reads --mx / --my)
function spotlight() {
  let raf = 0, ev = null;
  addEventListener("pointermove", (e) => {
    ev = e; if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const el = ev.target.closest?.(SPOT); if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", ev.clientX - r.left + "px"); el.style.setProperty("--my", ev.clientY - r.top + "px");
    });
  }, { passive: true });
}

// Roster cards lean toward the cursor
function tilt() {
  const MAX = 7;
  addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(".roster-card"); if (!el) return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    el.style.setProperty("--ry", (px * MAX * 2).toFixed(2) + "deg"); el.style.setProperty("--rx", (-py * MAX * 2).toFixed(2) + "deg");
  }, { passive: true });
  addEventListener("pointerout", (e) => { const el = e.target.closest?.(".roster-card"); if (el && !el.contains(e.relatedTarget)) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); } }, { passive: true });
}

// Big call-to-action buttons are gently pulled toward the cursor (uses the separate `translate` property, so hover transforms still work)
function magnetic() {
  const SEL = ".btn-glow,.demand-btn,.theme-btn,.brand", PULL = .28;
  addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(SEL); if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.translate = `${((e.clientX - (r.left + r.width / 2)) * PULL).toFixed(1)}px ${((e.clientY - (r.top + r.height / 2)) * PULL).toFixed(1)}px`;
  }, { passive: true });
  addEventListener("pointerout", (e) => { const el = e.target.closest?.(SEL); if (el && !el.contains(e.relatedTarget)) el.style.translate = ""; }, { passive: true });
}

// Material-style ripple from the click point
function ripples() {
  addEventListener("pointerdown", (e) => {
    const el = e.target.closest?.(".btn,.tab,.subtab,.chip,.theme-btn,.demand-btn"); if (!el || el.disabled) return;
    const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement("span");
    s.className = "ripple"; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.appendChild(s); setTimeout(() => s.remove(), 700);
  }, { passive: true });
}

// ---------------------------------------------------------------------------------------------
// 5. CHROME: scroll progress, nav shadow, sliding tab pills
// ---------------------------------------------------------------------------------------------
function scrollUI() {
  const bar = document.createElement("div"); bar.id = "scrollBar"; document.body.appendChild(bar);
  const nav = $(".nav"), scroller = () => document.scrollingElement || document.documentElement;
  const tick = () => {
    const s = scroller(), max = s.scrollHeight - innerHeight;
    bar.style.setProperty("--sp", max > 0 ? (s.scrollTop / max).toFixed(4) : 0);
    nav?.classList.toggle("scrolled", s.scrollTop > 8);
  };
  addEventListener("scroll", tick, { passive: true }); addEventListener("resize", tick); tick();
}

// One pill slides behind whichever .tab/.subtab is active (the active class is still set by ui.js / main.js, so this only listens)
function pills() {
  [[".tabs", ".tab"], [".subtabs", ".subtab"]].forEach(([wrapSel, itemSel]) => {
    const wrap = $(wrapSel); if (!wrap) return;
    const pill = document.createElement("i"); pill.className = "tab-pill no-anim"; wrap.prepend(pill);
    const place = () => {
      const on = wrap.querySelector(itemSel + ".active"); if (!on || !on.offsetWidth) return;
      pill.style.width = on.offsetWidth + "px"; pill.style.height = on.offsetHeight + "px";
      pill.style.transform = `translate(${on.offsetLeft}px,${on.offsetTop}px)`;
    };
    place(); requestAnimationFrame(() => { place(); requestAnimationFrame(() => pill.classList.remove("no-anim")); });
    new MutationObserver(place).observe(wrap, { subtree: true, attributes: true, attributeFilter: ["class"] });
    new ResizeObserver(place).observe(wrap);
    addEventListener("resize", place);
    document.fonts?.ready.then(place);
  });
}

// ---------------------------------------------------------------------------------------------
// 6. HEADLINES + PAGE TRANSITIONS
// ---------------------------------------------------------------------------------------------
// Wrap every word of the main headline so the words rise in one after another (<em> stays one unit, keeping its gradient)
function splitHeadlines() {
  $$(".landing-copy h1,.hero h1").forEach((h) => {
    if (h.dataset.split) return; h.dataset.split = "1"; let n = 0;
    const walk = (node) => [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
          const w = document.createElement("span"); w.className = "w"; w.innerHTML = `<i style="--i:${n++}"></i>`; w.firstChild.textContent = tok; frag.appendChild(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeName === "EM") { const w = document.createElement("span"); w.className = "w"; c.classList.add("w-em"); c.style.setProperty("--i", n++); c.replaceWith(w); w.appendChild(c); }
    });
    walk(h);
  });
}

// Navigating between index.html and dashboard.html: a circular wipe from the click point, then the new page fades in
function pageTransitions() {
  const cur = document.createElement("div"); cur.id = "curtain"; document.body.appendChild(cur);
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]"); if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || !/\.html$|\/$/.test(u.pathname) || u.pathname === location.pathname) return;
    e.preventDefault();
    cur.style.setProperty("--cx", e.clientX + "px"); cur.style.setProperty("--cy", e.clientY + "px");
    cur.classList.add("go"); document.body.classList.add("leaving");
    setTimeout(() => { location.href = a.href; }, reduce ? 0 : 480);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) { cur.classList.remove("go"); document.body.classList.remove("leaving"); } }); // back button
}

export function initFX() {
  splitHeadlines();
  if (!reduce) {
    particles(); landingMotion(); spotlight(); ripples(); pageTransitions();
    if (fine) { tilt(); magnetic(); }
  }
  scrollUI(); pills(); reveal(); countUp();
}
