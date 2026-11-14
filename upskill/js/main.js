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
  const ICO = { // small stroke icons (inline SVG, no dependency)
    up: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    warn: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  };
  $("#stats").innerHTML = [[ready + "%", "Workforce readiness", "up"], [crit, "Critical skill gaps", "warn"], [EMPLOYEES.length, "Employees mapped", "users"], [gaps[0].name, "Biggest gap", "target"]]
    .map(([b, l, ic], i) => `<div class="stat" style="--i:${i}"><span class="s-ico${i === 0 ? " ring" : ""}"${i === 0 ? ` style="--p:${ready}"` : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICO[ic]}</svg></span><b>${esc(b)}</b><span>${l}</span></div>`).join("");
  countUp("#stats .stat b"); // replay the count-up after a data change
}

// One heatmap table, used by the card and by the maximized view (so they can never differ)
const lvl = (v) => Math.max(0, Math.min(5, Math.round(v)));
const heatTable = () => `<thead><tr><th></th>${SKILLS.map((s) => `<th>${esc(s.name)}<br><small>target ${s.target}</small></th>`).join("")}</tr></thead><tbody>`
  + EMPLOYEES.map((e, ri) => `<tr data-emp="${e.id}" class="clickable" tabindex="0" aria-label="${esc(e.name)}: open skill pathway"><td><div class="emp-cell">${avatarHTML(e, "xs")}<div class="emp-txt"><b>${esc(e.name)}</b><small class="muted">${esc(e.role)}</small></div></div></td>${e.s.map((v, ci) => { const d = SKILLS[ci].target - v; return `<td class="cell${d > 0 ? " low" + (d >= 2 ? " deep" : "") : ""}" data-v="${lvl(v)}" data-c="${ci}" style="--d:${ri * 45 + ci * 32}ms">${v}</td>`; }).join("")}</tr>`).join("") + `</tbody>`;

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
  radar($("#companyRadar"), names, targets, SKILLS.map((_, i) => +avg(i).toFixed(2)), { sweep: true });
  $("#radarCallout").innerHTML = `<h3>Biggest gaps</h3>` + gaps.slice(0, 3).map((g, i) => `<div class="tile"><span class="tag">#${i + 1}</span><h3>${esc(g.name)}</h3><span class="muted">Average ${g.avg.toFixed(1)} vs required ${g.target}</span><div class="tile-est">${esc(estText(estimate(skillIndex(g.id))))} <small>illustrative</small></div></div>`).join("");
}

// ========= TEAM ROSTER =========
// Share of the required levels this person already meets (each skill capped at its target). Pure arithmetic on the roster.
const empReadiness = (e) => { const need = SKILLS.reduce((a, s) => a + s.target, 0); return need ? Math.round((SKILLS.reduce((a, s, i) => a + Math.min(e.s[i], s.target), 0) / need) * 100) : 0; };
const ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

function renderTeamRoster() {
  forceCloseStage(); // the cards are about to be rebuilt
  const n = EMPLOYEES.length;
  $("#rosterCount").textContent = `${n} employee${n === 1 ? "" : "s"} · click a card to enlarge it`;
  $("#teamRoster").innerHTML = EMPLOYEES.map((e, i) => {
    const miniId = `mini-radar-${e.id}`;
    return `<div class="roster-card" data-emp="${e.id}" style="--i:${i}" tabindex="0" role="button" aria-label="Enlarge ${esc(e.name)}">
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
      <span class="rc-ready"><b>${empReadiness(e)}%</b> ready</span>
      <span class="rc-hint">${ICON_EXPAND} Enlarge</span>
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

// --- The enlarged employee card: grows out of the clicked card and lands in the centre of the screen (FLIP animation) ---
const stage = $("#rxStage"), rxCard = stage.querySelector(".rx-card");
let rxSrc = null, rxBusy = false;
const rxIsOpen = () => stage.classList.contains("open");
function stageHTML(e) {
  const rows = SKILLS.map((s, i) => ({ s, v: e.s[i], d: s.target - e.s[i] }));
  const best = [...rows].sort((a, b) => b.v - a.v || a.d - b.d).slice(0, 3);
  const gapsTop = rows.filter((r) => r.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const col = (r) => (r.v >= r.s.target ? "var(--success)" : r.v >= r.s.target * 0.6 ? "var(--warning)" : "var(--danger)");
  const k = (() => { let n = 0; return () => `style="--k:${n++}"`; })(); // stagger index for the entrance animation
  return `<button type="button" class="btn btn-ghost rx-close" aria-label="Close"><svg viewBox="0 0 24 24"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg></button>
  <div class="rx-body">
    <div class="rx-left">
      <div class="rx-head">
        ${avatarHTML(e, "hero")}
        <div class="rx-anim" ${k()}>
          <h2 id="rxName">${esc(e.name)}</h2>
          <div class="rx-role">${esc(e.role)}</div>
          <div class="rx-tags">${e.yoe != null ? `<span class="tag">📅 ${e.yoe} yr${e.yoe === 1 ? "" : "s"} experience</span>` : ""}${e.target ? `<span class="tag ok">🎯 ${esc(e.target)}</span>` : ""}</div>
        </div>
      </div>
      ${e.desc ? `<p class="rx-desc rx-anim" ${k()}>${esc(e.desc)}</p>` : ""}
      ${e.notes ? `<p class="rx-note rx-anim" ${k()}>${esc(e.notes)}</p>` : ""}
      ${e.stack ? `<div class="rx-anim" ${k()}><p class="rx-sub">Current stack</p><div class="rx-chips">${String(e.stack).split(/[,;]\s*/).filter(Boolean).map((t) => `<span class="rx-chip">${esc(t)}</span>`).join("")}</div></div>` : ""}
      <div class="rx-two rx-anim" ${k()}>
        <div><p class="rx-sub">Strongest skills</p><div class="rx-chips">${best.map((r) => `<span class="rx-chip good">${esc(r.s.name)} <small>${r.v}/${r.s.target}</small></span>`).join("")}</div></div>
        <div><p class="rx-sub">Biggest gaps</p><div class="rx-chips">${gapsTop.length ? gapsTop.map((r) => `<span class="rx-chip bad">${esc(r.s.name)} <small>−${r.d}</small></span>`).join("") : '<span class="rx-chip good">Meets every target</span>'}</div></div>
      </div>
      <div class="rx-actions rx-anim" ${k()}><button type="button" class="btn rx-path">🚀 Open AI pathway</button><button type="button" class="btn btn-ghost rx-dismiss">Close</button></div>
    </div>
    <div class="rx-right">
      <div class="rx-ring rx-anim" style="--p:${empReadiness(e)};--k:2"><div><b>${empReadiness(e)}%</b><small>ready</small></div></div>
      <div id="rxRadar" class="radar-wrap rx-anim" style="--k:3"></div>
      <div class="rx-bars rx-anim" style="--k:4">${rows.map((r) => `<div class="emp-skill-bar"><span>${esc(r.s.name)}</span><div class="track"><div class="fill" style="width:${(r.v / 5) * 100}%;background:${col(r)}"></div></div><span class="muted">${r.v}/${r.s.target}</span></div>`).join("")}</div>
    </div>
  </div>`;
}
// transform that makes the centred card look exactly like the source card (or the reverse)
const flipFrom = (src) => { const f = src.getBoundingClientRect(), t = rxCard.getBoundingClientRect(); return `translate(${f.left + f.width / 2 - (t.left + t.width / 2)}px,${f.top + f.height / 2 - (t.top + t.height / 2)}px) scale(${f.width / t.width},${f.height / t.height})`; };
function openStage(src) {
  const emp = EMPLOYEES.find((x) => x.id == src.dataset.emp);
  if (!emp || rxBusy || rxIsOpen()) return;
  rxSrc = src; rxBusy = true;
  rxCard.innerHTML = stageHTML(emp);
  rxCard.setAttribute("aria-labelledby", "rxName");
  radar(rxCard.querySelector("#rxRadar"), names, targets, emp.s, { sweep: true });
  stage.classList.remove("closing"); stage.classList.add("show", "open"); stage.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("rx-lock");
  const from = flipFrom(src);
  src.classList.add("is-source");
  const anim = rxCard.animate([{ transform: from, opacity: 0.35, borderRadius: "22px" }, { transform: "none", opacity: 1, borderRadius: "28px" }], { duration: 620, easing: "cubic-bezier(.2,.9,.25,1.04)" });
  anim.finished.catch(() => {}).then(() => { rxBusy = false; });
  rxCard.querySelector(".rx-close").focus({ preventScroll: true });
}
async function closeStage() {
  if (!rxIsOpen() || rxBusy) return;
  rxBusy = true; stage.classList.add("closing"); stage.classList.remove("open");
  const src = rxSrc && document.body.contains(rxSrc) ? rxSrc : null;
  const frames = src ? [{ transform: "none", opacity: 1 }, { transform: flipFrom(src), opacity: 0.2 }] : [{ transform: "none", opacity: 1 }, { transform: "scale(.92)", opacity: 0 }];
  if (src) setTimeout(() => src.classList.remove("is-source"), 300);
  await rxCard.animate(frames, { duration: 460, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" }).finished.catch(() => {});
  src?.classList.remove("is-source"); src?.focus({ preventScroll: true });
  stage.classList.remove("show", "closing"); stage.setAttribute("aria-hidden", "true"); document.documentElement.classList.remove("rx-lock");
  rxCard.getAnimations().forEach((a) => a.cancel()); rxCard.innerHTML = ""; rxSrc = null; rxBusy = false;
}
function forceCloseStage() { // instant, used when the roster is re-rendered underneath it
  if (!rxIsOpen() && !stage.classList.contains("show")) return;
  rxCard.getAnimations().forEach((a) => a.cancel());
  stage.classList.remove("show", "open", "closing"); stage.setAttribute("aria-hidden", "true"); document.documentElement.classList.remove("rx-lock");
  rxCard.innerHTML = ""; rxSrc = null; rxBusy = false;
}
function initRosterStage() {
  const grid = $("#teamRoster");
  grid.addEventListener("click", (e) => { const c = e.target.closest(".roster-card"); if (c) openStage(c); });
  grid.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".roster-card")) { e.preventDefault(); openStage(e.target); } });
  stage.addEventListener("click", (e) => {
    if (e.target.closest(".rx-close,.rx-dismiss") || e.target.classList.contains("rx-backdrop") || e.target === stage) closeStage();
    else if (e.target.closest(".rx-path")) { const emp = EMPLOYEES.find((x) => x.id == rxSrc?.dataset.emp); closeStage(); if (emp) setTimeout(() => openModal(emp), 280); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && rxIsOpen() && !$$(".modal.open").length) closeStage(); });
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
  $("#modalAvatar").outerHTML = avatarHTML(emp, "modal", "modalAvatar"); // 150% bigger than the old 40px picture (see --pfp-zoom in styles.css)
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

// --- Heatmap hover: highlights the whole column and shows a tooltip with the score against the required level ---
function initHeatFX(table) {
  const tip = $("#hmTip");
  let col = -1;
  const clearCol = () => { table.querySelectorAll(".col-hl").forEach((x) => x.classList.remove("col-hl")); col = -1; };
  const place = (e) => {
    const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 18, y = e.clientY + 18;
    if (x + w > innerWidth - 10) x = e.clientX - w - 18; if (y + h > innerHeight - 10) y = e.clientY - h - 18;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  };
  table.addEventListener("pointermove", (e) => {
    const cell = e.target.closest("td.cell");
    if (!cell) { tip.classList.remove("show"); clearCol(); return; }
    const c = +cell.dataset.c, emp = EMPLOYEES.find((x) => x.id == cell.closest("tr").dataset.emp), sk = SKILLS[c];
    if (c !== col) { clearCol(); table.querySelectorAll(`td.cell[data-c="${c}"]`).forEach((x) => x.classList.add("col-hl")); table.querySelectorAll("thead th")[c + 1]?.classList.add("col-hl"); col = c; }
    const v = emp.s[c], d = sk.target - v;
    tip.innerHTML = `<div class="tt-top"><b>${esc(emp.name)}</b><span>${esc(sk.name)}</span></div>
      <div class="tt-main"><strong>${v}</strong><span>/ 5 · required ${sk.target}</span></div>
      <div class="tt-meter">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= v ? "on" : ""}${n === sk.target ? " goal" : ""}"></i>`).join("")}</div>
      <span class="tag ${d > 0 ? (d >= 2 ? "" : "warn") : "ok"}">${d > 0 ? `${d} level${d > 1 ? "s" : ""} below target` : d < 0 ? `${-d} above target` : "Meets target"}</span>`;
    tip.classList.add("show"); place(e);
  });
  table.addEventListener("pointerleave", () => { tip.classList.remove("show"); clearCol(); });
}

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
  const openEmp = (e) => {
    const tr = e.target.closest("tr[data-emp]"); if (!tr) return;
    $$("tr.picked").forEach((r) => r.classList.remove("picked"));
    $$(`tr[data-emp="${tr.dataset.emp}"]`).forEach((r) => r.classList.add("picked")); // this person's picture jumps to 150%
    openModal(EMPLOYEES.find((x) => x.id == tr.dataset.emp));
  };
  for (const id of ["#heatmap", "#heatmapMax"]) {
    $(id).addEventListener("click", openEmp);
    $(id).addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-emp]")) { e.preventDefault(); openEmp(e); } });
    initHeatFX($(id));
  }
  initRosterStage();
  // Maximize: the same table with every employee, no height cap
  const heatModal = $("#heatModal"), gapModal = $("#gapModal"), empModal = $("#empModal");
  $("#heatMaxBtn").addEventListener("click", () => heatModal.classList.add("open"));
  // Gap bars -> drill-down; employee rows inside it -> pathway modal (opens on top, closing it returns here)
  $("#gapBars").addEventListener("click", (e) => { const b = e.target.closest("button[data-skill]"); if (b) openGap(b.dataset.skill); });
  $("#gapBody").addEventListener("click", (e) => { const b = e.target.closest("button[data-emp]"); if (b) openModal(EMPLOYEES.find((x) => x.id == b.dataset.emp)); });
  // Close buttons, backdrop clicks, and Esc (one modal at a time: the front-most)
  [[heatModal, "#heatClose"], [gapModal, "#gapClose"], [empModal, "#modalClose"]].forEach(([m, btn]) => {
    const close = () => { m.classList.remove("open"); if (m === empModal) $$("tr.picked").forEach((r) => r.classList.remove("picked")); };
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
