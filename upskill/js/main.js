// Entry point: renders both dashboards from seed data and wires all AI features.
import { SKILLS, EMPLOYEES, NEXT_GEN_ROLES, MARKET_CATEGORIES, matchesGap } from "./data.js";
import { askAI, ai, generateUpskillRoadmap, fetchMarketTrends, normalizeRoadmap } from "./ai.js";
import { initFX } from "./fx.js";
import { radar } from "./radar.js";
import { $, $$, esc, toast, withLoading, initTabs, initThemeToggle, renderTrends, renderTrendSkeleton, renderCategoryChips, renderEmpSkills, renderRoadmap, setDemo, isMock } from "./ui.js";

// ========= HR DASHBOARD LOGIC =========
const avg = (i) => EMPLOYEES.reduce((a, e) => a + e.s[i], 0) / EMPLOYEES.length;
const gaps = SKILLS.map((s, i) => ({ ...s, avg: avg(i), gap: Math.max(0, s.target - avg(i)) })).sort((a, b) => b.gap - a.gap);
const save = (k, v) => { try { localStorage.setItem("upskill_" + k, JSON.stringify(v)); } catch {} };
const load = (k) => { try { return JSON.parse(localStorage.getItem("upskill_" + k)); } catch { return null; } };
const heat = (v) => `rgba(244,63,94,${(0.08 + (v / 5) * 0.7).toFixed(2)})`;

function renderStats() {
  const ready = Math.round((SKILLS.reduce((a, s, i) => a + Math.min(avg(i) / s.target, 1), 0) / SKILLS.length) * 100);
  const crit = gaps.filter((g) => g.gap >= 1.5).length;
  $("#stats").innerHTML = [[ready + "%", "Workforce readiness"], [crit, "Critical skill gaps"], [EMPLOYEES.length, "Employees mapped"], [gaps[0].name, "Biggest gap"]]
    .map(([b, l]) => `<div class="stat"><b>${esc(b)}</b><span>${l}</span></div>`).join("");
}

function renderHeatmap() {
  $("#heatmap").innerHTML = `<tr><th></th>${SKILLS.map((s) => `<th>${esc(s.name)}<br><small>target ${s.target}</small></th>`).join("")}</tr>` +
    EMPLOYEES.map((e) => `<tr data-emp="${e.id}" class="clickable"><td><b>${esc(e.name)}</b><br><small class="muted">${esc(e.role)}</small></td>${e.s.map((v) => `<td class="cell" style="background:${heat(v)}">${v}</td>`).join("")}</tr>`).join("");
  $("#gapBars").innerHTML = gaps.map((g) => {
    const c = g.gap >= 1.5 ? "var(--danger)" : g.gap >= 0.75 ? "var(--warning)" : "var(--success)";
    return `<div class="bar"><span>${esc(g.name)}</span><div class="track"><div class="fill" style="width:${(g.avg / 5) * 100}%;background:${c}"></div></div><span class="muted">${g.avg.toFixed(1)} / ${g.target}</span></div>`;
  }).join("");
}

const tag = (t, cls = "") => `<span class="tag ${cls}">${esc(t)}</span>`;
function renderInsights(d, via) {
  const imp = { high: "", medium: "warn", low: "ok" };
  $("#insights").className = "";
  $("#insights").innerHTML = `<p>${esc(d.summary)} ${tag("via " + via, "ok")}</p>
    <div class="grid">${(d.emerging || []).map((x) => `<div class="tile">${tag(x.impact + " impact", imp[x.impact])} ${tag(x.horizon, "warn")}<h3>${esc(x.tech)}</h3><span class="muted">${esc(x.why)}</span></div>`).join("")}</div>
    <h3 style="margin-top:18px">Future-proof training pathway</h3>
    <div class="grid">${(d.pathway || []).map((p) => `<div class="tile"><h3>${esc(p.phase)}</h3><ol class="steps">${(p.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ol></div>`).join("")}</div>`;
}
async function analyze() {
  const prompt = `You are an L&D strategist. Skill gaps (avg level vs target, scale 0-5): ${gaps.map((g) => `${g.name} ${g.avg.toFixed(1)}/${g.target}`).join("; ")}.
Return JSON: {"summary":string,"emerging":[{"tech":string,"horizon":"0-6 months|6-12 months|12-24 months","impact":"high|medium|low","why":string}] (3-4 items),"pathway":[{"phase":string,"actions":[string]}] (3 phases)}. Be concrete and tied to the gaps. The single biggest gap is ${gaps[0].name} (${gaps[0].avg.toFixed(1)}/${gaps[0].target}): at least one emerging item and the first pathway phase must address it directly.`;
  const { data, via } = await askAI(prompt, "insights");
  if (!data.emerging || !data.pathway) throw new Error("Unexpected AI response shape");
  setDemo(isMock(via)); save("insights", { data, via }); renderInsights(data, via); toast("Analysis ready via " + via);
}
// ========= EMPLOYEE DASHBOARD LOGIC =========
let loggedInEmployee = null;

function empLogin() {
  const empId = parseInt($("#empLoginSelect").value);
  loggedInEmployee = EMPLOYEES.find((e) => e.id === empId);
  if (!loggedInEmployee) return;

  // Show profile
  $("#empLoginCard").style.display = "none";
  $("#empProfile").style.display = "";
  $("#empRoadmapCard").style.display = "";

  // Fill profile info
  $("#empAvatar").textContent = loggedInEmployee.name.charAt(0);
  $("#empName").textContent = loggedInEmployee.name;
  $("#empRole").textContent = loggedInEmployee.role;

  // Render skill bars
  renderEmpSkills(loggedInEmployee, SKILLS);
  radar($("#empRadar"), names, targets, loggedInEmployee.s);
  if (loggedInEmployee.target) $("#empRoadmapRole").value = loggedInEmployee.target;

  toast(`Welcome back, ${loggedInEmployee.name}!`);

  // Restore cached roadmap
  const cached = load("emp_roadmap_" + loggedInEmployee.id);
  if (cached) renderRoadmap(cached.data, cached.via);
}

function empLogout() {
  loggedInEmployee = null;
  $("#empLoginCard").style.display = "";
  $("#empProfile").style.display = "none";
  $("#empRoadmapCard").style.display = "none";
  $("#empRoadmap").className = "empty";
  $("#empRoadmap").innerHTML = "Select a target role and click the button above to get your personalized 4-week AI roadmap.";
}

async function genRoadmap(emp, role, target) {
  const knownSkills = SKILLS.filter((s, i) => emp.s[i] >= 3).map((s) => s.name).join(", ") || "general software development";
  const { data, via } = await generateUpskillRoadmap(emp.name, emp.role, knownSkills, role, emp);
  const weeks = normalizeRoadmap(data);
  if (!weeks.length) throw new Error("Unexpected AI response shape");
  setDemo(isMock(via));
  save("emp_roadmap_" + emp.id, { data: weeks, via });
  renderRoadmap(weeks, via, target);
  toast("Your 4-week upskill path is ready via " + via);
}
const empGenerateRoadmap = () => loggedInEmployee && genRoadmap(loggedInEmployee, $("#empRoadmapRole").value, "#empRoadmap");

// ========= RADARS, MODAL, LANDING, EXPORT =========
const names = SKILLS.map((s) => s.name), targets = SKILLS.map((s) => s.target);
function renderCompanyRadar() {
  radar($("#companyRadar"), names, targets, SKILLS.map((_, i) => +avg(i).toFixed(2)));
  $("#radarCallout").innerHTML = `<h3>Biggest gaps</h3>` + gaps.slice(0, 3).map((g, i) => `<div class="tile"><span class="tag">#${i + 1}</span><h3>${esc(g.name)}</h3><span class="muted">Average ${g.avg.toFixed(1)} vs required ${g.target}</span></div>`).join("");
}
function openModal(emp) {
  $("#modalName").textContent = emp.name; $("#modalRole").textContent = emp.role;
  $("#empModal").dataset.emp = emp.id;
  radar($("#modalRadar"), names, targets, emp.s);
  if (emp.target) $("#modalTargetRole").value = emp.target;
  const c = load("emp_roadmap_" + emp.id);
  if (c) renderRoadmap(c.data, c.via, "#modalRoadmap");
  else { $("#modalRoadmap").className = "empty"; $("#modalRoadmap").textContent = "Pick a target role to generate this employee's roadmap."; }
  $("#empModal").classList.add("open");
}
const closeModal = () => $("#empModal").classList.remove("open");
function initScreens() {
  $("#modalTargetRole").innerHTML = NEXT_GEN_ROLES.map((r) => `<option>${esc(r)}</option>`).join("");
  $("#heatmap").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-emp]"); if (tr) openModal(EMPLOYEES.find((x) => x.id == tr.dataset.emp)); });
  $("#modalClose").addEventListener("click", closeModal);
  $("#empModal").addEventListener("click", (e) => { if (e.target.id === "empModal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  run("#modalGenBtn", "Generating...", () => genRoadmap(EMPLOYEES.find((x) => x.id == $("#empModal").dataset.emp), $("#modalTargetRole").value, "#modalRoadmap"));
  $("#exportBtn").addEventListener("click", () => window.print());
  // Landing: skip if already launched this session; brand click returns to it
  const go = (on) => { document.body.classList.toggle("landing", on); try { sessionStorage.setItem("upskill_launched", on ? "" : "1"); } catch {} scrollTo(0, 0); };
  if (sessionStorage.getItem("upskill_launched")) document.body.classList.remove("landing");
  $("#launchBtn").addEventListener("click", () => go(false));
  $("#brandHome").addEventListener("click", () => go(true));
}

// ========= MARKET TRENDS DRAWER =========
// One category at a time (chips). Live results are cached per category so re-clicking a chip is free.
const TREND_TTL = 6 * 3600000; // 6 h: market demand does not change hourly, and this protects free-tier quota
let trendCat = MARKET_CATEGORIES[0], trendsLoaded = false;
const topGap = gaps[0]; // the company's biggest deficit (target minus team average), computed above from the heatmap data
const SURGE = new Set(["Critical", "High", "Hot", "Rising"]);
// Mark market skills that address the top company gap AND show strong demand
const flagGap = (trends) => trends.map((t) => ({ ...t, gapHit: matchesGap(t, topGap.id) && SURGE.has(t.urgency || t.demand || t.level || "") }));

async function loadMarketTrends(force = false) {
  const cat = trendCat, key = "market_" + cat;
  const cached = load(key);
  // Cache applies to LIVE results only; mock is free and always re-rendered
  if (!force && !ai.useMock && cached && Date.now() - cached.ts < TREND_TTL) {
    renderTrends(flagGap(cached.data), cached.via, cat); trendsLoaded = true; return;
  }
  renderTrendSkeleton();
  try {
    const { data, via } = await fetchMarketTrends(cat, topGap);
    const feed = Array.isArray(data) ? { skills: data } : data;
    const trends = feed.skills || feed.trends || [];
    if (!trends.length) throw new Error("Unexpected AI response shape");
    if (!isMock(via)) save(key, { data: trends, via, ts: Date.now() });
    if (cat !== trendCat) return; // user switched chip while this was loading
    renderTrends(flagGap(trends), via, cat);
    setDemo(isMock(via));
    trendsLoaded = true;
  } catch (e) {
    console.warn("Market trends failed:", e.message);
    if (cat !== trendCat) return;
    if (cached) { renderTrends(flagGap(cached.data), cached.via, cat); trendsLoaded = true; }
    else { $("#marketTrends").innerHTML = `<div class="empty">Could not load ${esc(cat)} trends. Try Refresh.</div>`; toast(e.message, true); }
  }
}

function initTrendsToggle() {
  const drawer = $("#sidebar"), btn = $("#trendsBtn"), scrim = $("#scrim");
  renderCategoryChips(MARKET_CATEGORIES, trendCat);
  $("#gapNote").innerHTML = `Biggest company gap: <b>${esc(topGap.name)}</b> (${topGap.avg.toFixed(1)} avg vs ${topGap.target} required). Matching in-demand skills are flagged.`;
  const setOpen = (open) => {
    drawer.classList.toggle("open", open);
    scrim.classList.toggle("show", open);
    btn.setAttribute("aria-expanded", String(open));
    // Fetch only when the user opens the drawer (never on page load)
    if (open && !trendsLoaded) loadMarketTrends();
  };
  btn.addEventListener("click", () => setOpen(!drawer.classList.contains("open")));
  $("#trendsClose").addEventListener("click", () => setOpen(false));
  scrim.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  // Category selector: one delegated listener on the chip row
  $("#trendCats").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip"); if (!chip || chip.dataset.cat === trendCat) return;
    trendCat = chip.dataset.cat;
    renderCategoryChips(MARKET_CATEGORIES, trendCat);
    loadMarketTrends();
  });
}

// ========= WIRING =========
function run(btnSel, label, fn) {
  $(btnSel).addEventListener("click", () => withLoading($(btnSel), label, fn).catch((err) => toast(err.message, true)));
}

// Boot
initTabs();
initThemeToggle();
renderStats();
renderHeatmap();
renderCompanyRadar();
setDemo(ai.useMock);
initFX(); // after stats render so the count-up can run

initScreens();

// Employee login select
$("#empLoginSelect").innerHTML = EMPLOYEES.map((e) => `<option value="${e.id}">${esc(e.name)} — ${esc(e.role)}</option>`).join("");
$("#empRoadmapRole").innerHTML = NEXT_GEN_ROLES.map((r) => `<option>${esc(r)}</option>`).join("");

// Mock toggle — checked (on) by default in HTML, ai.useMock is true by default in ai.js
$("#mockToggle").addEventListener("change", (e) => {
  ai.useMock = e.target.checked;
  setDemo(ai.useMock);
  trendsLoaded = false; // drawer re-fetches on next open so mock/live data never get mixed up
  toast(ai.useMock ? "Mock mode on — no API calls" : "⚡ Live AI on — will use API quota");
});

// HR buttons
run("#analyzeBtn", "Analyzing with AI...", analyze);

// Employee buttons
$("#empLoginBtn").addEventListener("click", empLogin);
$("#empLogoutBtn").addEventListener("click", empLogout);
run("#empRoadmapBtn", "Generating roadmap...", empGenerateRoadmap);

// Drawer: Live Market Demand (closed by default, no auto-load)
initTrendsToggle();

// Drawer refresh button: force a new fetch for the selected category (live = 1 API call)
$("#refreshTrends").addEventListener("click", () =>
  withLoading($("#refreshTrends"), "Loading...", () => loadMarketTrends(true)).catch((err) => toast(err.message, true))
);

// Restore cached data
const si = load("insights"); if (si) renderInsights(si.data, si.via);
