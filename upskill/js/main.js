// Entry point: renders both dashboards from seed data and wires all AI features.
import { SKILLS, EMPLOYEES, NEXT_GEN_ROLES } from "./data.js";
import { askAI, ai, generateUpskillRoadmap, fetchMarketTrends } from "./ai.js";
import { $, $$, esc, toast, withLoading, initTabs, renderTrends, renderEmpSkills, renderRoadmap } from "./ui.js";

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
    EMPLOYEES.map((e) => `<tr><td><b>${esc(e.name)}</b><br><small class="muted">${esc(e.role)}</small></td>${e.s.map((v) => `<td class="cell" style="background:${heat(v)}">${v}</td>`).join("")}</tr>`).join("");
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
function renderTrack(d, via, name, role) {
  $("#track").className = "";
  $("#track").innerHTML = `<p><b>${esc(name)} → ${esc(role)}</b> ${tag("via " + via, "ok")}<br><span class="muted">${esc(d.headline)}</span></p>
    <p>${(d.strengths || []).map((s) => tag(s, "ok")).join(" ")}</p>
    <div class="grid">${(d.steps || []).map((s) => `<div class="tile">${tag(s.week)}<h3>${esc(s.title)}</h3><ol class="steps">${(s.resources || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ol><p class="muted">Outcome: ${esc(s.outcome)}</p></div>`).join("")}</div>`;
}

async function analyze() {
  const prompt = `You are an L&D strategist. Skill gaps (avg level vs target, scale 0-5): ${gaps.map((g) => `${g.name} ${g.avg.toFixed(1)}/${g.target}`).join("; ")}.
Return JSON: {"summary":string,"emerging":[{"tech":string,"horizon":"0-6 months|6-12 months|12-24 months","impact":"high|medium|low","why":string}] (3-4 items),"pathway":[{"phase":string,"actions":[string]}] (3 phases)}. Be concrete and tied to the gaps.`;
  const { data, via } = await askAI(prompt, "insights");
  if (!data.emerging || !data.pathway) throw new Error("Unexpected AI response shape");
  save("insights", { data, via }); renderInsights(data, via); toast("Analysis ready via " + via);
}
async function buildTrack() {
  const e = EMPLOYEES.find((x) => x.id == $("#empSelect").value), role = $("#roleSelect").value;
  const prompt = `Create a 12-week learning track for ${e.name}, currently ${e.role}, moving to ${role}. Skill levels (0-5): ${SKILLS.map((s, i) => `${s.name} ${e.s[i]}`).join("; ")}.
Return JSON: {"headline":string,"strengths":[string],"steps":[{"week":string,"title":string,"resources":[string],"outcome":string}] (3-4 steps)}. Prioritize their weakest skills relevant to the role.`;
  const { data, via } = await askAI(prompt, "track");
  if (!data.steps) throw new Error("Unexpected AI response shape");
  save("track", { data, via, name: e.name, role }); renderTrack(data, via, e.name, role); toast("Learning track ready via " + via);
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

async function empGenerateRoadmap() {
  if (!loggedInEmployee) return;
  const role = $("#empRoadmapRole").value;
  const knownSkills = SKILLS.filter((s, i) => loggedInEmployee.s[i] >= 3).map((s) => s.name).join(", ") || "general software development";

  const { data, via } = await generateUpskillRoadmap(loggedInEmployee.name, loggedInEmployee.role, knownSkills, role);

  // Handle both array and object responses
  const weeks = Array.isArray(data) ? data : data.roadmap || data.weeks || data.steps || [];
  if (!weeks.length) throw new Error("Unexpected AI response shape");

  save("emp_roadmap_" + loggedInEmployee.id, { data: weeks, via });
  renderRoadmap(weeks, via);
  toast("Your 4-week upskill path is ready via " + via);
}

// ========= MARKET TRENDS SIDEBAR =========
async function loadMarketTrends() {
  const cached = load("market_trends");
  if (cached && Date.now() - cached.ts < 3600000) { renderTrends(cached.data, cached.via); return; }

  try {
    const { data, via } = await fetchMarketTrends();
    const trends = Array.isArray(data) ? data : data.trends || data.skills || [];
    if (trends.length) {
      renderTrends(trends, via);
      save("market_trends", { data: trends, via, ts: Date.now() });
    }
  } catch (e) {
    console.warn("Market trends failed:", e.message);
    if (cached) renderTrends(cached.data, cached.via);
  }
}

// ========= WIRING =========
function run(btnSel, label, fn) {
  $(btnSel).addEventListener("click", () => withLoading($(btnSel), label, fn).catch((err) => toast(err.message, true)));
}

// Boot
initTabs();
renderStats();
renderHeatmap();

// HR selects
$("#empSelect").innerHTML = EMPLOYEES.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
$("#roleSelect").innerHTML = NEXT_GEN_ROLES.map((r) => `<option>${esc(r)}</option>`).join("");

// Employee login select
$("#empLoginSelect").innerHTML = EMPLOYEES.map((e) => `<option value="${e.id}">${esc(e.name)} — ${esc(e.role)}</option>`).join("");
$("#empRoadmapRole").innerHTML = NEXT_GEN_ROLES.map((r) => `<option>${esc(r)}</option>`).join("");

// Mock toggle
$("#mockToggle").addEventListener("change", (e) => { ai.useMock = e.target.checked; toast(ai.useMock ? "Mock mode on" : "Live AI on"); });

// HR buttons
run("#analyzeBtn", "Analyzing with AI...", analyze);
run("#trackBtn", "Building track...", buildTrack);

// Employee buttons
$("#empLoginBtn").addEventListener("click", empLogin);
$("#empLogoutBtn").addEventListener("click", empLogout);
run("#empRoadmapBtn", "Generating roadmap...", empGenerateRoadmap);

// Sidebar refresh
$("#refreshTrends").addEventListener("click", () =>
  withLoading($("#refreshTrends"), "Loading...", () => { localStorage.removeItem("upskill_market_trends"); return loadMarketTrends(); }).catch((err) => toast(err.message, true))
);

// Restore cached data
const si = load("insights"); if (si) renderInsights(si.data, si.via);
const st = load("track"); if (st) renderTrack(st.data, st.via, st.name, st.role);

// Load market trends on page load
loadMarketTrends();
