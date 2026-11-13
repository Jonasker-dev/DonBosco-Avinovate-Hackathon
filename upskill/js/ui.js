// UI helpers: toasts, button loading state, render helpers, tab switching, theme toggle. No API calls here.
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);
export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function toast(msg, isErr = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isErr ? " err" : "");
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// Disable a button + show spinner while fn runs.
export async function withLoading(btn, label, fn) {
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>${label}`;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}

// Tab switching between HR and Employee dashboards. Returns select(name) so other code (URL hash) can switch tabs too.
export function initTabs(onSelect) {
  const tabs = $$(".tab");
  const select = (name) => {
    tabs.forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle("active", on); t.setAttribute("aria-selected", String(on)); });
    $$(".dash").forEach((d) => d.classList.remove("active"));
    $(`#${name === "hr" ? "hrDash" : "empDash"}`).classList.add("active");
    onSelect?.(name);
  };
  tabs.forEach((t) => t.addEventListener("click", () => select(t.dataset.tab)));
  return select;
}

// Mock mode is remembered for the browser tab (sessionStorage), so the landing page and the dashboard agree.
// Default ON (saves API quota). The body class `mock` lets CSS show mock-only controls, e.g. "Reset to demo data".
export const getMockPref = () => { try { return sessionStorage.getItem("upskill_mock") !== "0"; } catch { return true; } };
export function setMockPref(on) {
  try { sessionStorage.setItem("upskill_mock", on ? "1" : "0"); } catch {}
  document.body.classList.toggle("mock", !!on);
}

// True when `el` is the front-most open modal (modals share one z-index, so the last one in the DOM is on top). Used so Esc closes one at a time.
export const isTopModal = (el) => { const open = $$(".modal.open"); return open[open.length - 1] === el; };

// Light / Dark theme toggle. Default is light; the choice is remembered. Works for every .theme-btn (navbar + landing).
// (An inline script in index.html applies the saved theme before first paint, so there is no flash.)
export function initThemeToggle() {
  const btns = $$(".theme-btn");
  const paint = (dark) => btns.forEach((b) => { b.innerHTML = dark ? "☀️ Light" : "🌙 Dark"; b.title = dark ? "Switch to light mode" : "Switch to dark mode"; });
  let saved = null; try { saved = localStorage.getItem("upskill_theme"); } catch {}
  document.body.classList.toggle("dark", saved === "dark");
  paint(saved === "dark");
  btns.forEach((b) => b.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark");
    paint(dark);
    try { localStorage.setItem("upskill_theme", dark ? "dark" : "light"); } catch {}
  }));
}

// Category selector chips in the Live Market Demand drawer (active one is aria-pressed)
export function renderCategoryChips(cats, active) {
  $("#trendCats").innerHTML = cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === active}">${esc(c)}</button>`).join("");
}

// Placeholder cards while a category loads
export function renderTrendSkeleton() {
  $("#marketTrends").innerHTML = '<div class="trend-skeleton"><div class="skel-line"></div><div class="skel-line short"></div></div>'.repeat(3);
}

// Render market trend cards in the drawer: name + demand pill, optional growth figure, description
export function renderTrends(trends, via, category) {
  const cls = { Hot: "hot", Rising: "rising", Emerging: "emerging", Critical: "hot", High: "rising", Moderate: "emerging" };
  const sample = String(via).startsWith("mock");
  const head = `<div class="trend-meta">${category ? `<b>${esc(category)}</b>` : "<b>Top skills</b>"}<span class="tag ${sample ? "warn" : "ok"}">${sample ? "SAMPLE FEED" : "via " + esc(via)}</span></div>`;
  $("#marketTrends").innerHTML = head + trends.map((t) => {
    const level = t.urgency || t.demand || t.level || "Hot";
    const note = t.desc || t.reason || t.description || t.why || "";
    return `<div class="trend-card${t.gapHit ? " gap" : ""}">
      ${t.gapHit ? '<div class="gap-flag">⚠ Critical Company Gap &amp; Market Surge</div>' : ""}
      <div class="trend-top"><h4>${esc(t.skill || t.name)}</h4><span class="trend-demand ${cls[level] || "hot"}">${esc(level)}</span></div>
      ${t.surge ? `<div class="surge">▲ ${esc(t.surge)} <small>demand growth</small></div>` : ""}
      ${note ? `<p>${esc(note)}</p>` : ""}
    </div>`;
  }).join("");
}

// Render employee skill bars
export function renderEmpSkills(employee, skills) {
  const colors = (v, target) => v >= target ? "var(--success)" : v >= target * 0.6 ? "var(--warning)" : "var(--danger)";
  $("#empSkillBars").innerHTML = skills.map((s, i) => {
    const v = employee.s[i];
    return `<div class="emp-skill-bar">
      <span>${esc(s.name)}</span>
      <div class="track"><div class="fill" style="width:${(v / 5) * 100}%;background:${colors(v, s.target)}"></div></div>
      <span class="muted">${v}/${s.target}</span>
    </div>`;
  }).join("");
}

// Render the 4-week roadmap as beautiful week cards
export function renderRoadmap(weeks, via, target = "#empRoadmap") {
  $(target).className = "";
  $(target).innerHTML = `
    <p class="muted" style="margin:0 0 4px">Your personalized 4-week upskill roadmap <span class="tag ok">via ${esc(via)}</span></p>
    <div class="roadmap-grid">
      ${weeks.map((w) => `
        <div class="week-card">
          <div class="week-num">Week ${esc(w.week)}</div>
          <h4>${esc(w.topic)}</h4>
          <p class="action-item">${esc(w.action_item)}</p>
        </div>
      `).join("")}
    </div>`;
}

// Honest fallback: show a corner badge whenever output is mock/sample data
export function setDemo(on) { $("#demoBadge").classList.toggle("show", !!on); }
export const isMock = (via) => String(via).startsWith("mock");
