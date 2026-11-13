// Manage data modal: editable required levels + CSV import + reset. Shared by the landing page and the dashboard.
// It injects its own markup, so each page only needs <div id="toasts"> and the stylesheet.
// All roster changes go through roster.js; the page passes onChange() to re-render itself afterwards.
// Every change is saved in the database by roster.js (server.py + SQLite) before the screen updates: no browser storage.
import { SKILLS, EMPLOYEES } from "./data.js";
import { setTarget, readRoster, commitImport, resetRoster, isCustom, ROSTER_CSV_URL, DEMO_CSV_URL } from "./roster.js";
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
      <p class="muted">Columns: <code>name</code>, <code>role</code>, then one column per skill scored 0-5 (headers as in the template). Optional: <code>target_role</code>, <code>description</code>, <code>yoe</code> (years of experience), <code>stack</code>, <code>notes</code>, <code>photo</code> (image file name or link). Employees, photos and levels are stored in the database, so they are still here after a refresh or on another computer.</p>
      <div class="row">
        <label class="btn btn-ghost btn-sm file-btn">📄 Choose CSV file<input type="file" id="csvFile" accept=".csv,.tsv,.txt,text/csv" class="sr"></label>
        <label class="btn btn-ghost btn-sm file-btn">🖼 Add photos<input type="file" id="photoFiles" accept="image/*" multiple class="sr"></label>
        <button class="btn btn-ghost btn-sm" id="csvTemplate" type="button" title="Every employee currently in the database, in import format">⬇ Current roster CSV</button>
        <button class="btn btn-ghost btn-sm" id="csvDemo" type="button" title="The built-in demo employees, in import format">⬇ Demo CSV</button>
      </div>
      <div id="photoPreview" class="photo-preview"></div>
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

// Photos picked in this window wait here (filename -> data URL) until "Import"; the server then stores them in the database
const photoStore = new Map();
// Normalize a string for photo-employee matching: lowercase, strip non-alphanumeric
const photoNorm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

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
    $("#dataSource").textContent = isCustom() ? `Using your data (${EMPLOYEES.length} employees).` : `Using the built-in demo dataset (${EMPLOYEES.length} employees).`;
    $("#resetData").disabled = !isCustom();
    $("#resetData").title = "Delete the imported employees and photos from the database and restore the built-in demo employees and levels";
  };
  const setT = async (i, v) => {
    try { const t = await setTarget(i, v); syncRow(i, t); onChange({}); syncSource(); }
    catch (err) { toast(err.message, true); syncRow(i, SKILLS[i].target); }
  };
  const syncModal = () => { ed.innerHTML = targetRows(); SKILLS.forEach((s, i) => syncRow(i, s.target)); syncSource(); };
  ed.addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b && !b.disabled) setT(+b.dataset.i, SKILLS[+b.dataset.i].target + +b.dataset.d); });
  ed.addEventListener("change", (e) => { const inp = e.target.closest("input[data-i]"); if (inp) setT(+inp.dataset.i, inp.value); });

  // Photo upload: store photos as data URLs keyed by filename
  $("#photoFiles").addEventListener("change", (e) => {
    const files = e.target.files;
    if (!files.length) return;
    let count = 0;
    for (const f of files) {
      if (f.size > 2e6) { toast(`${f.name} too large (max 2 MB)`, true); continue; }
      const reader = new FileReader();
      reader.onload = () => { photoStore.set(f.name.toLowerCase(), reader.result); count++; updatePhotoPreview(); };
      reader.readAsDataURL(f);
    }
    e.target.value = "";
  });
  function updatePhotoPreview() {
    const pp = $("#photoPreview");
    if (!photoStore.size) { pp.innerHTML = ""; return; }
    pp.innerHTML = `<span class="muted">${photoStore.size} photo${photoStore.size === 1 ? "" : "s"} ready to link:</span>` +
      [...photoStore.entries()].map(([k, url]) =>
        `<span class="photo-thumb"><img src="${url}" alt="${esc(k)}" title="${esc(k)}"><small>${esc(k)}</small></span>`
      ).join("");
  }

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
      + `<div class="scroll"><table><tr><th>Name</th><th>Role</th>${names().map((x) => `<th>${esc(x)}</th>`).join("")}<th>Desc</th><th>YoE</th></tr>`
      + r.employees.slice(0, 5).map((e) => `<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td>${e.s.map((v) => `<td>${v}</td>`).join("")}<td>${esc(e.desc || "—")}</td><td>${e.yoe ?? "—"}</td></tr>`).join("") + `</table></div>`
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
  // Both CSVs are generated by the server from the database / the demo seed, so they always match what is stored
  const download = (url, name) => { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); };
  $("#csvTemplate").addEventListener("click", () => download(ROSTER_CSV_URL, "upskill-roster.csv"));
  $("#csvDemo").addEventListener("click", () => download(DEMO_CSV_URL, "upskill-demo-employees.csv"));
  importBtn.addEventListener("click", async () => {
    if (!parsed) return;
    // Match uploaded photos to employees by normalized name (strips spaces, hyphens, case)
    if (photoStore.size) {
      // Build a lookup of normalized filename base -> data URL
      const photoLookup = [];
      for (const [fname, dataUrl] of photoStore) {
        const base = photoNorm(fname.replace(/\.(jpe?g|png|gif|webp|bmp)$/i, ""));
        photoLookup.push({ base, dataUrl });
      }
      let matched = 0;
      parsed.forEach((emp) => {
        if (emp.photo) { // the CSV names a photo: use the matching uploaded file; otherwise the server looks in Assets/ or keeps an image link
          const up = !/^(https?:|data:)/i.test(emp.photo) && photoStore.get(emp.photo.split(/[\\/]/).pop().toLowerCase());
          if (up) { emp.photo = up; matched++; }
          return;
        }
        const nameNorm = photoNorm(emp.name);
        // Try: exact match, then name contains filename, then filename contains name, then first-name match
        const firstName = photoNorm(emp.name.split(/\s+/)[0]);
        const hit = photoLookup.find((p) => p.base === nameNorm)
          || photoLookup.find((p) => nameNorm.includes(p.base) && p.base.length >= 3)
          || photoLookup.find((p) => p.base.includes(nameNorm) && nameNorm.length >= 3)
          || photoLookup.find((p) => p.base === firstName && firstName.length >= 3);
        if (hit) { emp.photo = hit.dataUrl; matched++; }
      });
      if (matched) toast(`📷 Matched ${matched} photo${matched === 1 ? "" : "s"} to employees`);
      else if (photoStore.size) toast("⚠ No photos matched employee names. Name your photos to match employee names (e.g., john.jpg for John Smith).", true);
    }
    importBtn.disabled = true;
    try {
      const added = parsed.length, total = await commitImport(parsed, $("#csvMode").value); // saved in the database first
      txt.value = ""; preview(); photoStore.clear(); updatePhotoPreview();
      onChange({ rosterChanged: true }); syncModal();
      toast(`Imported ${added} employee${added === 1 ? "" : "s"} · ${total} saved in the database`);
    } catch (err) { importBtn.disabled = false; toast(err.message, true); }
  });
  // Reset: the database is emptied of imported employees + photos and refilled with the demo employees, photos and default levels
  $("#resetData").addEventListener("click", async () => {
    try { await resetRoster(); photoStore.clear(); updatePhotoPreview(); onChange({ rosterChanged: true }); syncModal(); toast("Database reset to the demo employees"); }
    catch (err) { toast(err.message, true); }
  });

  const close = () => { if (!modal.classList.contains("open")) return; modal.classList.remove("open"); opener?.focus?.(); };
  const open = () => { opener = document.activeElement; syncModal(); modal.classList.add("open"); $("#dataClose").focus(); };
  $("#dataClose").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isTopModal(modal)) close(); });
  return { open };
}
