// Dashboard entry point (dashboard.html): renders both dashboards from the roster and wires all AI features.
// The start page lives in index.html + landing.js.
// v11: the roster, photos, required levels, theme and mock mode live in the database (server.py). No browser storage at all.
// AI results (analysis, roadmaps, cost estimates) are session-only caches in memory.
import { SKILLS, EMPLOYEES, NEXT_GEN_ROLES, MARKET_CATEGORIES, MOCK, matchesGap } from "./data.js";
import { askAI, ai, generateUpskillRoadmap, fetchMarketTrends, normalizeRoadmap, estimateRequiredLevels, estimateCostTime } from "./ai.js";
import { initFX, countUp } from "./fx.js";
import { loadSaved, isCustom, getSavedTargets } from "./roster.js";
import { avg, buildGaps, readiness, skillIndex, belowTarget, estimate, estText, formulaText, money, matchMentors, mentorsFor, ESTIMATE, MENTOR } from "./gaps.js";
import { radar } from "./radar.js";
import { $, $$, esc, toast, withLoading, initTabs, initThemeToggle, renderTrends, renderTrendSkeleton, renderCategoryChips, renderEmpSkills, renderRoadmap, setDemo, isMock, getMockPref, setMockPref, isTopModal, showServerError } from "./ui.js";
import { initDataModal } from "./datamodal.js";

try { await loadSaved(); } // read the roster (employees, photos, levels) from the database before the first render
catch (e) { showServerError(e); throw e; }

// ========= IN-MEMORY AI CACHES (session only) =========
const cache = { insights: null, roadmaps: {}, aiCost: null };

// ========= HR DASHBOARD LOGIC =========
// Derived numbers live in `let`s and are rebuilt by recompute() whenever targets or the roster change
let gaps = [], names = [], targets = [], topGap;
function recompute() {
  gaps = buildGaps();
  names = SKILLS.map((s) => s.name); targets = SKILLS.map((s) => s.target);
  topGap = gaps[0]; // the company's biggest deficit (target minus team average)
}
const sig = () => gaps.map((g) => g.id + g.target + g.avg.toFixed(2)).join("|"); // fingerprint of the numbers an AI analysis was based on
const heat = (v) => `rgba(var(--heat-color),${(0.08 + (v / 5) * 0.7).toFixed(2)})`;

// Avatar helper: shows photo if employee has one, otherwise shows initial letter
function avatarHTML(emp, size = "", id = "") {
  const cls = "avatar" + (size ? " avatar-" + size : "");
  const idAttr = id ? ` id="${id}"` : "";
  const initial = emp.name.charAt(0);
  if (emp.photo) return `<div class="${cls}"${idAttr}><img src="${emp.photo}" alt="${esc(emp.name)}" onerror="var p=this.parentElement,a=this.alt;this.remove();p.textContent=a.charAt(0)"></div>`;
  return `<div class="${cls}"${idAttr}>${esc(initial)}</div>`;
}

// "3 yrs experience · description": the profile details stored in the database, shown wherever one employee is shown
const metaLine = (e) => [e.yoe != null ? `${e.yoe} yr${e.yoe === 1 ? "" : "s"} experience` : "", e.desc || ""].filter(Boolean).join(" · ");

function renderStats() {
  const ready = readiness();
  const crit = gaps.filter((g) => g.gap >= 1.5).length;
  $("#stats").innerHTML = [[ready + "%", "Workforce readiness"], [crit, "Critical skill gaps"], [EMPLOYEES.length, "Employees mapped"], [gaps[0].name, "Biggest gap"]]
    .map(([b, l]) => `<div class="stat"><b>${esc(b)}</b><span>${l}</span></div>`).join("");
  countUp("#stats .stat b"); // replay the count-up after a data change
}

// One heatmap table, used by the card and by the maximized view (so they can never differ)
const heatTable = () => `<thead><tr><th></th>${SKILLS.map((s) => `<th>${esc(s.name)}<br><small>target ${s.target}</small></th>`).join("")}</tr></thead><tbody>`
  + EMPLOYEES.map((e) => `<tr data-emp="${e.id}" class="clickable"><td><b>${esc(e.name)}</b><br><small class="muted">${esc(e.role)}</small></td>${e.s.map((v) => `<td class="cell" style="background:${heat(v)}">${v}</td>`).join("")}</tr>`).join("") + `</tbody>`;

function renderHeatmap() {
  const html = heatTable(), n = EMPLOYEES.length;
  $("#heatmap").innerHTML = html; $("#heatmapMax").innerHTML = html;
  $("#heatCount").textContent = `${n} employee${n === 1 ? "" : "s"} · click one for their AI pathway`;
  $("#heatMaxCount").textContent = `All ${n} employee${n === 1 ? "" : "s"} · click a row for their AI pathway`;
  renderGapBars();
}

// Render gap bars with current cost/time (illustrative or AI-estimated)
function renderGapBars() {
  const useAI = cache.aiCost && !ai.useMock;
  $("#gapBars").innerHTML = gaps.map((g) => {
    const c = g.gap >= 1.5 ? "var(--danger)" : g.gap >= 0.75 ? "var(--warning)" : "var(--success)";
    let estLabel;
    if (useAI && cache.aiCost[g.id]) {
      const ct = cache.aiCost[g.id];
      estLabel = `≈ $${Math.round(ct.cost).toLocaleString("en-US")} · ~${ct.time}`;
    } else {
      estLabel = estText(estimate(skillIndex(g.id)));
    }
    return `<button type="button" class="bar" data-skill="${g.id}" aria-label="${esc(g.name)}: why is this a gap?"><span class="bar-name">${esc(g.name)}</span><span class="track"><span class="fill" style="width:${(g.avg / 5) * 100}%;background:${c}"></span></span><span class="muted bar-val">${g.avg.toFixed(1)} / ${g.target}</span><span class="bar-est">${esc(estLabel)}</span></button>`;
  }).join("");
  const costTag = $("#costTag");
  if (useAI) { costTag.textContent = "AI-ESTIMATED cost & time"; costTag.className = "tag ok"; }
  else { costTag.textContent = "ILLUSTRATIVE cost & time"; costTag.className = "tag warn"; }
  const E = ESTIMATE;
  $("#estNote").innerHTML = useAI
    ? `<b>AI-estimated costs and timelines.</b> Based on workforce analysis. Estimates are advisory, not a quote.`
    : `<b>Illustrative estimate, not a quote.</b> Cost to bring everyone below target up to target = levels missing × ${E.hoursPerLevel} h per level × ${E.currency}${E.costPerHour}/h. Time = the slowest learner's gap × ${E.hoursPerLevel} h ÷ ${E.hoursPerWeek} h per week (people train in parallel). Change the assumptions in <code>js/gaps.js</code>.`;
}

const tag = (t, cls = "") => `<span class="tag ${cls}">${esc(t)}</span>`;
const EMPTY_INSIGHTS = "Run the analysis to forecast emerging tech demand and a company-wide training pathway.";
function renderInsights(d, via, stale = false) {
  const imp = { high: "", medium: "warn", low: "ok" };
  $("#insights").className = "";
  $("#insights").innerHTML = `<p>${esc(d.summary)} ${tag("via " + via, "ok")}${stale ? " " + tag("data changed since this analysis: re-run", "stale") : ""}</p>
    <div class="grid">${(d.emerging || []).map((x) => `<div class="tile">${tag(x.impact + " impact", imp[x.impact])} ${tag(x.horizon, "warn")}<h3>${esc(x.tech)}</h3><span class="muted">${esc(x.why)}</span></div>`).join("")}</div>
    <h3 style="margin-top:18px">Future-proof training pathway</h3>
    <div class="grid">${(d.pathway || []).map((p) => `<div class="tile"><h3>${esc(p.phase)}</h3><ol class="steps">${(p.actions || []).map((a) => `<li>${esc(a)}</li>`).join("")}</ol></div>`).join("")}</div>`;
}
async function analyze() {
  const prompt = `You are an L&D strategist. Skill gaps (avg level vs target, scale 0-5): ${gaps.map((g) => `${g.name} ${g.avg.toFixed(1)}/${g.target}`).join("; ")}.
Return JSON: {"summary":string,"emerging":[{"tech":string,"horizon":"0-6 months|6-12 months|12-24 months","impact":"high|medium|low","why":string}] (3-4 items),"pathway":[{"phase":string,"actions":[string]}] (3 phases)}. Be concrete and tied to the gaps. The single biggest gap is ${gaps[0].name} (${gaps[0].avg.toFixed(1)}/${gaps[0].target}): at least one emerging item and the first pathway phase must address it directly.`;
  const { data, via } = await askAI(prompt, "insights");
  if (!data.emerging || !data.pathway) throw new Error("Unexpected AI response shape");
  setDemo(isMock(via)); cache.insights = { data, via, sig: sig() }; renderInsights(data, via); toast("Analysis ready via " + via);
}
// Show the cached analysis (flagged stale if targets/roster changed since), or the empty state
function restoreInsights() {
  const si = cache.insights;
  if (si) renderInsights(si.data, si.via, !!si.sig && si.sig !== sig());
  else { $("#insights").className = "empty"; $("#insights").textContent = EMPTY_INSIGHTS; }
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

  // Fill profile info with avatar photo (xl = 100% bigger)
  $("#empAvatar").outerHTML = avatarHTML(loggedInEmployee, "xl", "empAvatar");
  $("#empName").textContent = loggedInEmployee.name;
  $("#empRole").textContent = loggedInEmployee.role;
  $("#empMeta").textContent = metaLine(loggedInEmployee);

  // Render skill bars
  renderEmpSkills(loggedInEmployee, SKILLS);
  radar($("#empRadar"), names, targets, loggedInEmployee.s);
  if (loggedInEmployee.target) $("#empRoadmapRole").value = loggedInEmployee.target;

  toast(`Welcome back, ${loggedInEmployee.name}!`);

  // Restore cached roadmap
  const cached = cache.roadmaps[loggedInEmployee.id];
  if (cached) renderRoadmap(cached.data, cached.via);
}

function empLogout() {
  loggedInEmployee = null;
  $("#empLoginCard").style.display = "";
  $("#empProfile").style.display = "none";
  $("#empRoadmapCard").style.display = "none";
  // Restore avatar div for next login
  const av = document.getElementById("empAvatar") || document.querySelector(".emp-info .avatar");
  if (av) { av.outerHTML = '<div class="avatar avatar-xl" id="empAvatar">A</div>'; }
  $("#empRoadmap").className = "empty";
  $("#empRoadmap").innerHTML = "Select a target role and click the button above to get your personalized 4-week AI roadmap.";
}

async function genRoadmap(emp, role, target) {
  const knownSkills = SKILLS.filter((s, i) => emp.s[i] >= 3).map((s) => s.name).join(", ") || "general software development";
  const { data, via } = await generateUpskillRoadmap(emp.name, emp.role, knownSkills, role, emp);
  const weeks = normalizeRoadmap(data);
  if (!weeks.length) throw new Error("Unexpected AI response shape");
  setDemo(isMock(via));
  cache.roadmaps[emp.id] = { data: weeks, via };
  renderRoadmap(weeks, via, target);
  toast("Your 4-week upskill path is ready via " + via);
}
const empGenerateRoadmap = () => loggedInEmployee && genRoadmap(loggedInEmployee, $("#empRoadmapRole").value, "#empRoadmap");

// ========= RADAR, MODALS, EXPORT =========
function renderCompanyRadar() {
  radar($("#companyRadar"), names, targets, SKILLS.map((_, i) => +avg(i).toFixed(2)));
  $("#radarCallout").innerHTML = `<h3>Biggest gaps</h3>` + gaps.slice(0, 3).map((g, i) => `<div class="tile"><span class="tag">#${i + 1}</span><h3>${esc(g.name)}</h3><span class="muted">Average ${g.avg.toFixed(1)} vs required ${g.target}</span><div class="tile-est">${esc(estText(estimate(skillIndex(g.id))))} <small>illustrative</small></div></div>`).join("");
}

// ========= TEAM ROSTER =========
function renderTeamRoster() {
  const n = EMPLOYEES.length;
  $("#rosterCount").textContent = `${n} employee${n === 1 ? "" : "s"}`;
  $("#teamRoster").innerHTML = EMPLOYEES.map((e) => {
    const miniId = `mini-radar-${e.id}`;
    return `<div class="roster-card">
      <div class="roster-card-top">
        ${avatarHTML(e, "roster")}
        <div class="roster-info">
          <h3>${esc(e.name)}</h3>
          <span class="muted">${esc(e.role)}</span>
          ${e.yoe != null ? `<span class="muted roster-yoe">📅 ${e.yoe} yr${e.yoe === 1 ? "" : "s"} experience</span>` : ""}
        </div>
      </div>
      ${e.desc ? `<p class="roster-desc">${esc(e.desc)}</p>` : ""}
      <div class="roster-radar" id="${miniId}"></div>
    </div>`;
  }).join("");
  // Render mini radars after DOM is ready
  requestAnimationFrame(() => {
    EMPLOYEES.forEach((e) => {
      const el = document.getElementById(`mini-radar-${e.id}`);
      if (el) radar(el, names, targets, e.s);
    });
  });
}

// --- Employee pathway modal (+ "Who can mentor?" for this person's biggest gaps) ---
function renderEmpMentors(emp) {
  const rows = SKILLS.map((s, i) => ({ s, i, def: s.target - emp.s[i] })).filter((r) => r.def > 0).sort((a, b) => b.def - a.def).slice(0, 3);
  const first = esc(emp.name.split(" ")[0]);
  $("#modalMentors").innerHTML = `<h3>Who can mentor ${first}?</h3>` + (rows.length
    ? `<ul>${rows.map(({ s, i }) => { const m = mentorsFor(emp, i);
        return `<li><b>${esc(s.name)}</b> <span class="muted">(${emp.s[i]}/${s.target})</span> → ${m.length ? m.map((x) => `${esc(x.name)} <span class="muted">${x.s[i]}/5</span>`).join(", ") : '<span class="muted">nobody in-house is ahead yet: external training</span>'}</li>`; }).join("")}</ul>`
    : `<p class="muted">${first} meets every required level.</p>`);
}
function openModal(emp) {
  $("#modalName").textContent = emp.name; $("#modalRole").textContent = emp.role; $("#modalMeta").textContent = metaLine(emp);
  $("#modalAvatar").outerHTML = avatarHTML(emp, "sm", "modalAvatar");
  $("#empModal").dataset.emp = emp.id;
  radar($("#modalRadar"), names, targets, emp.s);
  renderEmpMentors(emp);
  if (emp.target) $("#modalTargetRole").value = emp.target;
  const c = cache.roadmaps[emp.id];
  if (c) renderRoadmap(c.data, c.via, "#modalRoadmap");
  else { $("#modalRoadmap").className = "empty"; $("#modalRoadmap").textContent = "Pick a target role to generate this employee's roadmap."; }
  $("#empModal").classList.add("open");
}
const closeModal = () => $("#empModal").classList.remove("open");

// --- "Why this gap?" drill-down: who is below target, illustrative cost/time, who can mentor ---
function mentorBlock(i, rows) {
  if (!rows.length) return "";
  const s = SKILLS[i], m = matchMentors(i), names_ = (list) => list.map((l) => esc(l.name)).join(", ");
  if (!m.hasPool) return `<h3>Who can mentor?</h3><p class="muted">Nobody in-house scores ${MENTOR.minScore}+ in ${esc(s.name)} (best is ${m.best}/5), so peer mentoring cannot close this gap. Plan an external course or a hire.</p>`;
  const lines = m.mentors.map((x) => `<li><b>${esc(x.mentor.name)}</b> <span class="tag ${x.meetsTarget ? "ok" : "warn"}">${x.score}/5${x.meetsTarget ? " · meets target" : " · near target"}</span> → ${x.mentees.map((l) => `${esc(l.name)} <span class="muted">${l.s[i]}</span>`).join(", ")}</li>`);
  if (m.full.length) lines.push(`<li class="muted">Mentors are at capacity (${MENTOR.maxMentees} learners each). Not covered yet: ${names_(m.full)}.</li>`);
  if (m.none.length) lines.push(`<li class="muted">Nobody in-house is ahead of ${names_(m.none)}: external help needed.</li>`);
  return `<h3>Who can mentor?</h3><ul class="mentor-list">${lines.join("")}</ul><p class="muted fine">Rule-based match, no AI: a mentor scores ${MENTOR.minScore}+ and is at least one level ahead; worst gaps are matched first.</p>`;
}
function openGap(id) {
  const i = skillIndex(id); if (i < 0) return;
  const s = SKILLS[i], rows = belowTarget(i), est = estimate(i), n = EMPLOYEES.length;
  // Use AI cost/time if available
  const useAI = cache.aiCost && !ai.useMock && cache.aiCost[id];
  const costLabel = useAI ? `≈ $${Math.round(cache.aiCost[id].cost).toLocaleString("en-US")} · ~${cache.aiCost[id].time}` : estText(est);
  const costTag = useAI ? "AI-ESTIMATED" : "ILLUSTRATIVE";
  const costCls = useAI ? "ok" : "warn";
  $("#gapTitle").textContent = s.name;
  $("#gapBody").innerHTML = `<div class="gap-tiles">
      <div class="tile"><b>${avg(i).toFixed(1)} / ${s.target}</b><span class="muted">team average vs required</span></div>
      <div class="tile"><b>${rows.length} of ${n}</b><span class="muted">below target</span></div>
      <div class="tile est-tile"><b>${esc(costLabel)}</b><span class="muted">to close it <span class="tag ${costCls}">${costTag}</span></span></div>
    </div>
    ${useAI && cache.aiCost[id].reasoning ? `<p class="muted fine"><b>AI reasoning:</b> ${esc(cache.aiCost[id].reasoning)}</p>` : ""}
    ${rows.length ? `${!useAI ? `<p class="muted fine">${esc(formulaText(est))} Assumptions, not a quote.</p>` : ""}
    <h3>Employees below target</h3>
    <ul class="gap-emps">${rows.map((r) => `<li><button type="button" data-emp="${r.emp.id}"><span class="ge-name"><b>${esc(r.emp.name)}</b><small class="muted">${esc(r.emp.role)}</small></span><span class="track"><span class="fill" style="width:${(r.score / 5) * 100}%;background:var(--${r.deficit >= 2 ? "danger" : "warning"})"></span></span><span class="muted ge-val">${r.score} / ${s.target}</span><span class="tag ${r.deficit >= 2 ? "" : "warn"}">−${r.deficit}</span></button></li>`).join("")}</ul>`
    : `<p class="empty">Everyone meets the required level of ${s.target} for ${esc(s.name)}.</p>`}
    ${mentorBlock(i, rows)}`;
  $("#gapModal").classList.add("open");
}

function initScreens() {
  $("#modalTargetRole").innerHTML = NEXT_GEN_ROLES.map((r) => `<option>${esc(r)}</option>`).join("");
  const openEmp = (e) => { const tr = e.target.closest("tr[data-emp]"); if (tr) openModal(EMPLOYEES.find((x) => x.id == tr.dataset.emp)); };
  $("#heatmap").addEventListener("click", openEmp);
  $("#heatmapMax").addEventListener("click", openEmp);
  // Maximize: the same table with every employee, no height cap
  const heatModal = $("#heatModal"), gapModal = $("#gapModal"), empModal = $("#empModal");
  $("#heatMaxBtn").addEventListener("click", () => heatModal.classList.add("open"));
  // Gap bars -> drill-down; employee rows inside it -> pathway modal (opens on top, closing it returns here)
  $("#gapBars").addEventListener("click", (e) => { const b = e.target.closest("button[data-skill]"); if (b) openGap(b.dataset.skill); });
  $("#gapBody").addEventListener("click", (e) => { const b = e.target.closest("button[data-emp]"); if (b) openModal(EMPLOYEES.find((x) => x.id == b.dataset.emp)); });
  // Close buttons, backdrop clicks, and Esc (one modal at a time: the front-most)
  [[heatModal, "#heatClose"], [gapModal, "#gapClose"], [empModal, "#modalClose"]].forEach(([m, btn]) => {
    const close = () => m.classList.remove("open");
    $(btn).addEventListener("click", close);
    m.addEventListener("click", (e) => { if (e.target === m) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isTopModal(m)) close(); });
  });
  run("#modalGenBtn", "Generating...", () => genRoadmap(EMPLOYEES.find((x) => x.id == $("#empModal").dataset.emp), $("#modalTargetRole").value, "#modalRoadmap"));
  // Export PDF = the browser's print dialog ("Save as PDF"); print CSS shows all HR sections and the full heatmap
  $("#exportBtn").addEventListener("click", () => window.print());
  $("#empExportBtn").addEventListener("click", () => window.print());
  addEventListener("beforeprint", fillPrintHead);
}

// Title block that only appears on paper. Also runs for Ctrl+P, not just the Export buttons.
function fillPrintHead() {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const onEmp = $("#empDash").classList.contains("active");
  $("#printHead").innerHTML = onEmp && loggedInEmployee
    ? `<p class="eyebrow">UpskillAI · Personal skill profile</p><h1>${esc(loggedInEmployee.name)}</h1><p>${esc(loggedInEmployee.role)} · target role: ${esc($("#empRoadmapRole").value)} · ${date}</p>`
    : `<p class="eyebrow">UpskillAI · Workforce report</p><h1>Skill-gap analysis</h1><p>${EMPLOYEES.length} employees · ${isCustom() ? "custom" : "demo"} dataset · ${date}</p>`;
}

// ========= HR SUB-NAVIGATION (radar | heatmap | foresight | roster) + URL hash =========
const SUBS = ["radar", "heatmap", "foresight", "roster"];
let currentSub = "radar";
const revealIn = (root) => requestAnimationFrame(() => $$(`${root} .reveal`).forEach((el) => el.classList.add("in")));
function showSub(id) {
  currentSub = SUBS.includes(id) ? id : "radar";
  $$(".subtab").forEach((b) => { const on = b.dataset.sub === currentSub; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
  $$(".hr-pane").forEach((p) => p.classList.toggle("active", p.dataset.pane === currentSub));
  revealIn("#pane-" + currentSub);
  if (currentSub === "roster") renderTeamRoster();
}
let selectTab = () => {};
function route() { // dashboard.html#heatmap, #radar, #foresight, #roster or #employee
  const h = location.hash.slice(1);
  showSub(h);
  selectTab(h === "employee" ? "emp" : "hr");
  revealIn(".dash.active");
}

// ========= MARKET TRENDS DRAWER =========
// One category at a time (chips). Live results are cached per category so re-clicking a chip is free.
const TREND_TTL = 6 * 3600000; // 6 h: market demand does not change hourly, and this protects free-tier quota
let trendCat = MARKET_CATEGORIES[0], trendsLoaded = false;
const trendCache = {}; // in-memory only
const SURGE = new Set(["Critical", "High", "Hot", "Rising"]);
// Mark market skills that address the top company gap AND show strong demand
const flagGap = (trends) => trends.map((t) => ({ ...t, gapHit: matchesGap(t, topGap.id) && SURGE.has(t.urgency || t.demand || t.level || "") }));

async function loadMarketTrends(force = false) {
  const cat = trendCat, key = "market_" + cat;
  const cached = trendCache[key];
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
    if (!isMock(via)) trendCache[key] = { data: trends, via, ts: Date.now() };
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

const renderGapNote = () => { $("#gapNote").innerHTML = `Biggest company gap: <b>${esc(topGap.name)}</b> (${topGap.avg.toFixed(1)} avg vs ${topGap.target} required). Matching in-demand skills are flagged.`; };
function initTrendsToggle() {
  const drawer = $("#sidebar"), btn = $("#trendsBtn"), scrim = $("#scrim");
  renderCategoryChips(MARKET_CATEGORIES, trendCat);
  renderGapNote();
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

// ========= AI BUTTONS =========

// AI: Estimate Required Levels (Company Skill Radar)
async function aiEstimateTargets() {
  const { data, via } = await estimateRequiredLevels(SKILLS, EMPLOYEES);
  const newTargets = Array.isArray(data) ? data : data?.targets;
  if (!Array.isArray(newTargets) || newTargets.length !== SKILLS.length) throw new Error("Unexpected AI response shape");
  newTargets.forEach((t, i) => { SKILLS[i].target = Math.min(5, Math.max(1, Math.round(t))); });
  setDemo(isMock(via));
  refreshAll({});
  toast("Required levels updated via " + via + " — toggle mock mode to revert");
}

// AI: Estimate Cost & Time (Competency Heatmap)
async function aiEstimateCost() {
  const { data, via } = await estimateCostTime(SKILLS, EMPLOYEES, gaps);
  const estimates = data?.estimates || data;
  if (!estimates || typeof estimates !== "object") throw new Error("Unexpected AI response shape");
  cache.aiCost = estimates;
  setDemo(isMock(via));
  renderGapBars();
  toast("Cost & time estimates updated via " + via);
}

// ========= HERO META =========
function renderHeroMeta() {
  const c = isCustom(), t = $("#dataTag");
  t.className = "tag " + (c ? "warn" : "ok");
  t.textContent = `${c ? "Custom data" : "Demo dataset"} · ${EMPLOYEES.length} employees`;
}
function renderEmpSelect() {
  $("#empLoginSelect").innerHTML = EMPLOYEES.map((e) => `<option value="${e.id}">${esc(e.name)} — ${esc(e.role)}</option>`).join("");
}

// Re-render everything that depends on targets or the roster. rosterChanged = employees were replaced/added/reset.
function refreshAll({ rosterChanged = false } = {}) {
  recompute();
  renderStats(); renderHeatmap(); renderCompanyRadar(); renderHeroMeta(); renderGapNote(); restoreInsights();
  if (rosterChanged) { renderEmpSelect(); if (loggedInEmployee) empLogout(); cache.roadmaps = {}; cache.aiCost = null; }
  else if (loggedInEmployee) { renderEmpSkills(loggedInEmployee, SKILLS); radar($("#empRadar"), names, targets, loggedInEmployee.s); }
  trendsLoaded = false; // the drawer re-flags skills against the new biggest gap on next open (live results come from cache, no API call)
  if (currentSub === "roster") renderTeamRoster();
}

// ========= WIRING =========
function run(btnSel, label, fn) {
  $(btnSel).addEventListener("click", () => withLoading($(btnSel), label, fn).catch((err) => toast(err.message, true)));
}

// Boot
ai.useMock = getMockPref();
$("#mockToggle").checked = ai.useMock;
setMockPref(ai.useMock); // body.mock shows "Reset to demo data" (Mock mode only)
recompute();
selectTab = initTabs((t) => { history.replaceState(null, "", t === "emp" ? "#employee" : "#" + currentSub); }); // keep the URL hash in step with the tab
initThemeToggle();
renderStats();
renderHeatmap();
renderCompanyRadar();
renderHeroMeta();
setDemo(ai.useMock);
initFX(); // after stats render so the count-up can run

initScreens();
const dataModal = initDataModal({ onChange: refreshAll });
$("#manageBtn").addEventListener("click", dataModal.open);
// Sub-navigation under the main tabs
$$(".subtab").forEach((b) => b.addEventListener("click", () => { showSub(b.dataset.sub); history.replaceState(null, "", "#" + currentSub); }));
addEventListener("hashchange", route);
route();

// Employee login select
renderEmpSelect();
$("#empRoadmapRole").innerHTML = NEXT_GEN_ROLES.map((r) => `<option>${esc(r)}</option>`).join("");

// Mock toggle: on by default (ai.js), saved in the database (ui.js -> roster.js)
$("#mockToggle").addEventListener("change", (e) => {
  ai.useMock = e.target.checked;
  setMockPref(ai.useMock); // saved in the database, so the start page agrees; also toggles "Reset to demo data"
  setDemo(ai.useMock);
  // When toggling to mock mode, revert AI-estimated targets to seed defaults
  if (ai.useMock) {
    const saved = getSavedTargets(); // AI-estimated levels are never saved: go back to what the database holds
    SKILLS.forEach((s, i) => { s.target = saved[i]; });
    cache.aiCost = null; // clear AI cost estimates
    refreshAll({});
  }
  trendsLoaded = false; // drawer re-fetches on next open so mock/live data never get mixed up
  toast(ai.useMock ? "Mock mode on — no API calls" : "⚡ Live AI on — will use API quota");
});

// HR buttons
run("#analyzeBtn", "Analyzing with AI...", analyze);
run("#aiTargetsBtn", "Estimating…", aiEstimateTargets);
run("#aiCostBtn", "Estimating…", aiEstimateCost);

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
restoreInsights();
