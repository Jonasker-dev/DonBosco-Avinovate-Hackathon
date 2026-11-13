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

// Tab switching between HR and Employee dashboards
export function initTabs() {
  const tabs = $$(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      const target = tab.dataset.tab;
      $$(".dash").forEach((d) => d.classList.remove("active"));
      $(`#${target === "hr" ? "hrDash" : "empDash"}`).classList.add("active");
    });
  });
}

// Light / Dark theme toggle
export function initThemeToggle() {
  const btn = $("#themeToggle");
  // Restore saved preference (default: light)
  const saved = localStorage.getItem("upskill_theme");
  if (saved === "dark") {
    document.body.classList.add("dark");
    btn.innerHTML = "☀️ Light";
  }
  btn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    btn.innerHTML = isDark ? "☀️ Light" : "🌙 Dark";
    try { localStorage.setItem("upskill_theme", isDark ? "dark" : "light"); } catch {}
  });
}

// Render market trend cards in the sidebar
export function renderTrends(trends, via) {
  const demandClass = { "Hot": "hot", "Rising": "rising", "Emerging": "emerging", "hot": "hot", "rising": "rising", "emerging": "emerging" };
  $("#marketTrends").innerHTML = trends.map((t) => `
    <div class="trend-card">
      <h4>${esc(t.skill || t.name)}</h4>
      <p>${esc(t.reason || t.description || t.why)}</p>
      <span class="trend-demand ${demandClass[t.demand] || demandClass[t.level] || 'hot'}">${esc(t.demand || t.level || "Trending")}</span>
    </div>
  `).join("");
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
export function renderRoadmap(weeks, via) {
  $("#empRoadmap").className = "";
  $("#empRoadmap").innerHTML = `
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
