// Roster tools: editable skill targets, CSV import/export, persistence. Pure data logic: no DOM, no API calls.
// SKILLS and EMPLOYEES (data.js) are mutated IN PLACE so every module that imported them sees the change.
import { SKILLS, EMPLOYEES, NEXT_GEN_ROLES } from "./data.js";

const KEY = "upskill_roster";
export const MAX_ROWS = 200;
// Pristine demo data, captured once at load (before any saved custom data is applied)
const SEED = { targets: SKILLS.map((s) => s.target), employees: structuredClone(EMPLOYEES) };
let custom = false;

export const isCustom = () => custom;
export const seedCount = () => SEED.employees.length;

// ---------- storage: three layers, so imported data survives a cleared localStorage ----------
// 1. localStorage      sync, read first at boot
// 2. IndexedDB mirror  a separate browser store: survives clearing only "Local storage"
// 3. data/roster.json  written by server.py (cookie `upskill_srv` tells us it is running): survives "Clear site data" too
// Writes go to every layer; boot reads them in that order; Reset wipes all three.
const IDB = { name: "upskill_db", store: "kv", key: "roster" };
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
  del: () => { try { localStorage.removeItem(KEY); } catch {} },
};
// Run one IndexedDB request; resolves to its result, or null when IndexedDB is unavailable
const idbRun = (mode, op) => new Promise((resolve) => {
  try {
    const open = indexedDB.open(IDB.name, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB.store);
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction(IDB.store, mode), req = op(tx.objectStore(IDB.store));
      tx.oncomplete = () => { db.close(); resolve(req.result ?? null); };
      tx.onerror = tx.onabort = () => { db.close(); resolve(null); };
    };
  } catch { resolve(null); }
});
const idb = {
  get: () => idbRun("readonly", (o) => o.get(IDB.key)),
  set: (v) => idbRun("readwrite", (o) => o.put(JSON.parse(JSON.stringify(v)), IDB.key)),
  del: () => idbRun("readwrite", (o) => o.delete(IDB.key)),
};
const diskOn = () => { try { return document.cookie.includes("upskill_srv=1"); } catch { return false; } };
const disk = {
  get: async () => { if (!diskOn()) return null; try { const r = await fetch("api/roster", { cache: "no-store" }); return r.status === 200 ? await r.json() : null; } catch { return null; } },
  set: async (v) => { if (diskOn()) try { await fetch("api/roster", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); } catch {} },
  del: async () => { if (diskOn()) try { await fetch("api/roster", { method: "DELETE" }); } catch {} },
};
// Roadmaps are cached per employee id; when the roster changes those caches would describe the wrong people
function purgeRoadmaps() {
  try { Object.keys(localStorage).filter((k) => k.startsWith("upskill_emp_roadmap_")).forEach((k) => localStorage.removeItem(k)); } catch {}
}
const snapshot = () => ({ targets: SKILLS.map((s) => s.target), employees: EMPLOYEES, savedAt: Date.now() });
const persist = () => { const v = snapshot(); store.set(v); idb.set(v); disk.set(v); };

function apply(targets, employees) {
  SKILLS.forEach((s, i) => { s.target = targets[i]; });
  EMPLOYEES.splice(0, EMPLOYEES.length, ...employees);
}
const validEmp = (e) => e && typeof e.name === "string" && typeof e.role === "string" && Array.isArray(e.s) && e.s.length === SKILLS.length && e.s.every((v) => typeof v === "number" && v >= 0 && v <= 5);
const validData = (d) => !!d && Array.isArray(d.targets) && d.targets.length === SKILLS.length && d.targets.every((t) => Number.isInteger(t) && t >= 1 && t <= 5)
  && Array.isArray(d.employees) && d.employees.length > 0 && d.employees.every(validEmp);

// Call once at boot (await it), before the first render. Tries localStorage, then IndexedDB, then the server file.
// Whichever layer answers, the other layers are refilled so they all agree again.
export async function loadSaved() {
  for (const read of [store.get, idb.get, disk.get]) {
    const d = await read();
    if (validData(d)) { apply(d.targets, d.employees); custom = true; persist(); return true; }
  }
  return false;
}

// ---------- editing ----------
export function setTarget(i, v) {
  const t = Math.min(5, Math.max(1, Math.round(Number(v)) || 1));
  SKILLS[i].target = t; custom = true; persist(); return t;
}
export function resetRoster() {
  apply(SEED.targets, structuredClone(SEED.employees));
  custom = false; store.del(); idb.del(); disk.del(); purgeRoadmaps(); // wipe every layer so the imported data cannot come back
}

// ---------- CSV ----------
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60); // short + single line: these go into AI prompts

// Small RFC-4180 parser: quotes, escaped quotes, CRLF, BOM; comma / semicolon / tab auto-detected from the header line
export function parseCSV(text) {
  const src = String(text).replace(/^\uFEFF/, "");
  const head = src.split(/\r?\n/, 1)[0] || "";
  const delim = [",", ";", "\t"].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && src[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Validate + convert CSV text. Returns { employees, warnings } or { error }. Nothing is changed until commitImport().
export function readRoster(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { error: "Need a header row and at least one employee row." };
  const head = rows[0].map(norm);
  const find = (...n) => head.findIndex((h) => n.includes(h));
  const iName = find("name", "employee", "employeename", "fullname");
  const iRole = find("role", "title", "jobtitle", "position");
  const iTarget = find("targetrole", "target", "nextrole");
  if (iName < 0) return { error: 'No "name" column found in the header row.' };
  const cols = SKILLS.map((s) => head.findIndex((h) => h === norm(s.name) || h === s.id));
  if (cols.every((c) => c < 0)) return { error: `No skill columns recognised. Expected headers like: ${SKILLS.map((s) => s.name).join(", ")}.` };

  const warnings = [];
  const missing = SKILLS.filter((_, i) => cols[i] < 0).map((s) => s.name);
  if (missing.length) warnings.push(`No column for ${missing.join(", ")}: scored 0.`);
  let blanks = 0, clamped = 0, skipped = 0;
  const employees = [];
  for (const r of rows.slice(1)) {
    const name = clean(r[iName]);
    if (!name) { skipped++; continue; }
    if (employees.length >= MAX_ROWS) { warnings.push(`Only the first ${MAX_ROWS} employees were read.`); break; }
    const s = cols.map((c) => {
      if (c < 0) return 0;
      const raw = String(r[c] ?? "").trim().replace(",", ".");
      const n = raw === "" ? NaN : Number(raw);
      if (Number.isNaN(n)) { blanks++; return 0; }
      const v = Math.min(5, Math.max(0, Math.round(n * 10) / 10));
      if (v !== n) clamped++;
      return v;
    });
    const emp = { name, role: clean(iRole >= 0 ? r[iRole] : "") || "Team member", s };
    const want = norm(iTarget >= 0 ? r[iTarget] : "");
    const role = NEXT_GEN_ROLES.find((x) => norm(x) === want);
    if (role) emp.target = role; // only known roles, so the dropdown preselect stays valid
    employees.push(emp);
  }
  if (!employees.length) return { error: "No usable employee rows (every row was missing a name)." };
  if (skipped) warnings.push(`${skipped} row(s) without a name were skipped.`);
  if (blanks) warnings.push(`${blanks} blank or non-numeric score(s) set to 0.`);
  if (clamped) warnings.push(`${clamped} score(s) outside 0-5 were clamped.`);
  return { employees, warnings };
}

// Apply a validated import. mode: "replace" | "append". New ids start at 100 so they can never collide
// with the three seeded personas (ids 1, 3, 4 own hand-written mock roadmaps).
export function commitImport(employees, mode = "replace") {
  const base = mode === "append" ? EMPLOYEES.slice() : [];
  let id = Math.max(99, ...base.map((e) => e.id || 0));
  const added = employees.map((e) => ({ ...e, id: ++id }));
  apply(SKILLS.map((s) => s.target), [...base, ...added]);
  custom = true; persist(); purgeRoadmaps();
  return EMPLOYEES.length;
}

// Current roster as CSV. Doubles as the import template.
export function rosterCSV() {
  const q = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["name", "role", ...SKILLS.map((s) => s.name), "target_role"];
  return [head, ...EMPLOYEES.map((e) => [e.name, e.role, ...e.s, e.target || ""])].map((r) => r.map(q).join(",")).join("\n") + "\n";
}
