// Manage data modal: editable required levels + CSV import + reset. Shared by the landing page and the dashboard.
// It injects its own markup, so each page only needs <div id="toasts"> and the stylesheet.
// All roster changes go through roster.js; the page passes onChange() to re-render itself afterwards.
import { SKILLS, EMPLOYEES } from "./data.js";
import { setTarget, readRoster, commitImport, resetRoster, rosterCSV, isCustom } from "./roster.js";
import { avg } from "./gaps.js";
import { $, esc, toast, isTopModal } from "./ui.js";

const MARKUP = `
<div class="modal" id="dataModal" role="dialog" aria-modal="true" aria-labelledby="dataTitle">
  <div class="modal-box data-box">
    <div class="card-head">
      <div><h2 id="dataTitle">Manage data</h2><span class="muted">Set the skill levels your business requires and import your own employees.</span></div>
      <button class="btn btn-ghost btn-sm" id="dataClose" aria-label="Close">✕</button>
    </div>

    <section class="data-sec">
      <h3>1 · Required skill levels</h3>
      <p class="muted">The level the business needs per skill (1-5). Gaps, readiness, radar and AI prompts update instantly.</p>
      <div id="targetEditor" class="target-editor"></div>
    </section>

    <section class="data-sec">
      <h3>2 · Import employees from CSV</h3>
      <p class="muted">Columns: <code>name</code>, <code>role</code>, then one column per skill scored 0-5 (headers as in the template). Optional: <code>target_role</code>. Imported data is kept in this browser (and in <code>data/roster.json</code> when you run <code>server.py</code>).</p>
      <div class="row">
        <label class="btn btn-ghost btn-sm file-btn">📄 Choose CSV file<input type="file" id="csvFile" accept=".csv,.tsv,.txt,text/csv" class="sr"></label>
        <button class="btn btn-ghost btn-sm" id="csvTemplate" type="button">⬇ Download template</button>
      </div>
      <textarea id="csvText" rows="6" spellcheck="false" aria-label="CSV text" placeholder="Paste CSV here, or drop a .csv file onto this box"></textarea>
      <div id="csvPreview" class="csv-preview" aria-live="polite"></div>
      <div class="row">
        <select id="csvMode" aria-label="Import mode"><option value="append">Add to current roster</option><option value="replace">Replace current roster</option></select>
        <button class="btn" id="csvImportBtn" disabled>Import employees</button>
      </div>
    </section>

    <div class="card-head data-foot">
      <span class="muted" id="dataSource"></span>
      <button class="btn btn-ghost btn-sm" id="resetData">↺ Reset to demo data</button>
    </div>
  </div>
</div>`;

// onChange({ rosterChanged }) runs after every edit. Returns { open }.
export function initDataModal({ onChange = () => {} } = {}) {
  document.body.insertAdjacentHTML("beforeend", MARKUP);
  const modal = $("#dataModal"), ed = $("#targetEditor"), txt = $("#csvText"), importBtn = $("#csvImportBtn"), prev = $("#csvPreview");
  let parsed = null, opener = null, timer;
  const names = () => SKILLS.map((s) => s.name);

  const targetRows = () => SKILLS.map((s, i) => `<div class="t-row"><div>${esc(s.name)}<small>team average ${avg(i).toFixed(1)}</small></div>
    <div class="stepper"><button type="button" data-i="${i}" data-d="-1" aria-label="Lower ${esc(s.name)} requirement">−</button>
    <input type="number" min="1" max="5" step="1" value="${s.target}" data-i="${i}" aria-label="${esc(s.name)} required level (1 to 5)">
    <button type="button" data-i="${i}" data-d="1" aria-label="Raise ${esc(s.name)} requirement">+</button></div></div>`).join("");
  const syncRow = (i, t) => {
    const row = ed.children[i], [minus, plus] = row.querySelectorAll("button");
    row.querySelector("input").value = t; minus.disabled = t <= 1; plus.disabled = t >= 5;
  };
  // "Reset to demo data" is shown by CSS in Mock mode only (body.mock); it is disabled while the demo data is active
  const syncSource = () => {
    $("#dataSource").textContent = isCustom() ? `Using your data (${EMPLOYEES.length} employees). Saved in this browser.` : `Using the built-in demo dataset (${EMPLOYEES.length} employees).`;
    $("#resetData").disabled = !isCustom();
  };
  const setT = (i, v) => { const t = setTarget(i, v); syncRow(i, t); onChange({}); syncSource(); };
  const syncModal = () => { ed.innerHTML = targetRows(); SKILLS.forEach((s, i) => syncRow(i, s.target)); syncSource(); };
  ed.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b && !b.disabled) setT(+b.dataset.i, SKILLS[+b.dataset.i].target + +b.dataset.d); });
  ed.addEventListener("change", (e) => { const inp = e.target.closest("input[data-i]"); if (inp) setT(+inp.dataset.i, inp.value); });

  // CSV: validate while typing; nothing is applied until "Import employees"
  const preview = () => {
    const text = txt.value.trim(); parsed = null; importBtn.disabled = true;
    if (!text) { prev.innerHTML = ""; return; }
    const r = readRoster(text);
    if (r.error) { prev.innerHTML = `<div class="err-line">✕ ${esc(r.error)}</div>`; return; }
    parsed = r.employees; importBtn.disabled = false;
    const n = r.employees.length;
    prev.innerHTML = `<div class="ok-line">✓ ${n} employee${n === 1 ? "" : "s"} ready to import</div>`
      + (r.warnings.length ? `<ul>${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : "")
      + `<div class="scroll"><table><tr><th>Name</th><th>Role</th>${names().map((x) => `<th>${esc(x)}</th>`).join("")}</tr>`
      + r.employees.slice(0, 5).map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td>${e.s.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("") + `</table></div>`
      + (n > 5 ? `<small class="muted">…and ${n - 5} more</small>` : "");
  };
  txt.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(preview, 200); });
  const readFile = async (file) => {
    if (!file) return;
    if (file.size > 1e6) return toast("File too large (max 1 MB)", true);
    txt.value = await file.text(); preview();
  };
  $("#csvFile").addEventListener("change", (e) => { readFile(e.target.files[0]); e.target.value = ""; });
  txt.addEventListener("dragover", (e) => { e.preventDefault(); txt.classList.add("drag"); });
  txt.addEventListener("dragleave", () => txt.classList.remove("drag"));
  txt.addEventListener("drop", (e) => { e.preventDefault(); txt.classList.remove("drag"); readFile(e.dataTransfer.files[0]); });
  $("#csvTemplate").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rosterCSV()], { type: "text/csv" })); a.download = "upskill-roster-template.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  importBtn.addEventListener("click", () => {
    if (!parsed) return;
    const added = parsed.length, total = commitImport(parsed, $("#csvMode").value);
    txt.value = ""; preview(); onChange({ rosterChanged: true }); syncModal();
    toast(`Imported ${added} employee${added === 1 ? "" : "s"} · ${total} in roster`);
  });
  // Reset wipes the imported data from every storage layer (see roster.js) and restores the seed
  $("#resetData").addEventListener("click", () => { resetRoster(); onChange({ rosterChanged: true }); syncModal(); toast("Demo data restored"); });

  const close = () => { if (!modal.classList.contains("open")) return; modal.classList.remove("open"); opener?.focus?.(); };
  const open = () => { opener = document.activeElement; syncModal(); modal.classList.add("open"); $("#dataClose").focus(); };
  $("#dataClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isTopModal(modal)) close(); });
  return { open };
}
