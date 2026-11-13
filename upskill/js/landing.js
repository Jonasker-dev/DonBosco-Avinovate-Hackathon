// Landing page (index.html). A page of its own: importing a CSV here updates the numbers but never leaves this page.
// "Launch Dashboard" is a plain link to dashboard.html.
import { SKILLS, EMPLOYEES, MARKET_CATEGORIES } from "./data.js";
import { loadSaved, isCustom } from "./roster.js";
import { avg, buildGaps, readiness } from "./gaps.js";
import { initFX, countUp } from "./fx.js";
import { radar } from "./radar.js";
import { $, esc, initThemeToggle, getMockPref, setMockPref, showServerError } from "./ui.js";
import { initDataModal } from "./datamodal.js";

try { await loadSaved(); } // read the roster (employees, photos, levels) from the database before the first render
catch (e) { showServerError(e); throw e; }

// Everything on this page is computed from the live data, nothing is hardcoded
function render() {
  const gaps = buildGaps(), top = gaps[0], names = SKILLS.map((s) => s.name), targets = SKILLS.map((s) => s.target);
  $("#landStats").innerHTML = [[EMPLOYEES.length, "Employees mapped"], [SKILLS.length, "Skills tracked"], [readiness() + "%", "Workforce readiness"]].map(([b, l]) => `<div><b>${b}</b><span>${l}</span></div>`).join("");
  radar($("#landRadar"), names, targets, SKILLS.map((_, i) => +avg(i).toFixed(2)));
  $("#chipGap").innerHTML = `<small>⚠ Biggest gap</small><b>${esc(top.name)}</b><small>${top.avg.toFixed(1)} avg vs ${top.target} required</small>`;
  $("#chipMarket").innerHTML = `<small>● Live Market Demand</small><b>${MARKET_CATEGORIES.length} skill categories</b><small>Web-grounded in live mode</small>`;
  $("#chipAI").innerHTML = `<small>🚀 Per-employee AI roadmap</small><b>4 weeks, personalised</b><small>Gemini → Groq → Meta fallback</small>`;
  const t = $("#landDataTag"), custom = isCustom();
  t.className = "tag " + (custom ? "warn" : "ok");
  t.textContent = `${custom ? "Custom data" : "Demo dataset"} · ${EMPLOYEES.length} employees`;
  countUp("#landStats b");
}

initThemeToggle();
setMockPref(getMockPref()); // sets body.mock, which shows "Reset to demo data" (Mock mode only)
render();
initFX();
const data = initDataModal({ onChange: render });
$("#launchImportBtn").addEventListener("click", data.open); // opens the modal right here; the page stays put
