// Roster tools: editable skill targets, CSV import/export. Pure data logic: no DOM, no API calls.
// SKILLS and EMPLOYEES (data.js) are mutated IN PLACE so every module that imported them sees the change.
// v9: NO persistence (no localStorage, no IndexedDB, no disk). Everything lives in memory and resets with the button.
import { SKILLS, EMPLOYEES, NEXT_GEN_ROLES } from "./data.js";

export const MAX_ROWS = 200;
// Pristine demo data, captured once at load (before any custom data is applied)
const SEED = { targets: SKILLS.map((s) => s.target), employees: structuredClone(EMPLOYEES) };
let custom = false;

export const isCustom = () => custom;
export const seedCount = () => SEED.employees.length;
export const getSeedTargets = () => SEED.targets.slice();

// v9: loadSaved is now a no-op (kept for API compatibility with main.js)
export async function loadSaved() { return false; }

function apply(targets, employees) {
  SKILLS.forEach((s, i) => { s.target = targets[i]; });
  EMPLOYEES.splice(0, EMPLOYEES.length, ...employees);
}

const validEmp = (e) => e && typeof e.name === "string" && typeof e.role === "string" && Array.isArray(e.s) && e.s.length === SKILLS.length && e.s.every((v) => typeof v === "number" && v >= 0 && v <= 5);

// ---------- editing ----------
export function setTarget(i, v) {
  const t = Math.min(5, Math.max(1, Math.round(Number(v)) || 1));
  SKILLS[i].target = t; custom = true; return t;
}
export function resetRoster() {
  apply(SEED.targets, structuredClone(SEED.employees));
  custom = false;
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
  const iDesc = find("description", "desc", "skillset", "about");
  const iYoe = find("yoe", "experience", "years", "yearsofexperience");
  const iPhoto = find("photo", "photourl", "image", "avatar");
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
    // Optional fields: description, years of experience, photo
    if (iDesc >= 0) { const d = clean(r[iDesc]); if (d) emp.desc = d; }
    if (iYoe >= 0) { const y = Number(String(r[iYoe] ?? "").trim()); if (!isNaN(y) && y >= 0) emp.yoe = Math.round(y); }
    if (iPhoto >= 0) { const p = String(r[iPhoto] ?? "").trim(); if (p) emp.photo = p; }
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
  custom = true;
  return EMPLOYEES.length;
}

// Current roster as CSV. Doubles as the import template.
export function rosterCSV() {
  const q = (v) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["name", "role", ...SKILLS.map((s) => s.name), "target_role", "description", "yoe", "photo"];
  return [head, ...EMPLOYEES.map((e) => [e.name, e.role, ...e.s, e.target || "", e.desc || "", e.yoe ?? "", e.photo || ""])].map((r) => r.map(q).join(",")).join("\n") + "\n";
}
