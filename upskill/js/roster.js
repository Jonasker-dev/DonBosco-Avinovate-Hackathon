// Roster tools: editable skill targets, CSV import, and the link to the database. No DOM, no AI calls.
// SKILLS and EMPLOYEES (data.js) are mutated IN PLACE so every module that imported them sees the change.
// Persistence: ONE place only, the SQLite database behind server.py (/api/...). Nothing is kept in localStorage,
// sessionStorage, IndexedDB or cookies, so data survives refreshes, other browsers and copying the folder to another computer.
import { SKILLS, EMPLOYEES, NEXT_GEN_ROLES } from "./data.js";

export const MAX_ROWS = 200;
let custom = false;
let savedTargets = SKILLS.map((s) => s.target); // required levels as stored in the database

export const isCustom = () => custom;
export const getSavedTargets = () => savedTargets.slice(); // used to undo AI-estimated levels (those are never saved)

// Every request goes through here: readable errors for the toast, and a clear message when server.py is not running.
async function api(path, opts = {}) {
  let r;
  try {
    r = await fetch(path, { ...opts, headers: opts.body ? { "Content-Type": "application/json" } : undefined, cache: "no-store" });
  } catch { throw new Error("Cannot reach the database. Start it with: python3 server.py"); }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data?.error || `Database error (${r.status}). Is server.py running?`);
  return data;
}
const send = (method, path, body) => api(path, { method, body: JSON.stringify(body) });

// Copy a roster from the database into the in-memory arrays every screen reads
function apply(d) {
  SKILLS.forEach((s, i) => { s.target = d.targets[i]; });
  savedTargets = d.targets.slice();
  EMPLOYEES.splice(0, EMPLOYEES.length, ...d.employees);
  custom = !!d.custom;
}

// Called once at the top of each page, before the first render
export async function loadSaved() {
  const d = await api("/api/roster");
  if (!d || !Array.isArray(d.targets) || d.targets.length !== SKILLS.length || !Array.isArray(d.employees)) throw new Error("The database returned an unexpected answer.");
  apply(d);
  return custom;
}

// ---------- editing (all async: each change is saved in the database before the screen updates) ----------
export async function setTarget(i, v) {
  const t = Math.min(5, Math.max(1, Math.round(Number(v)) || 1));
  apply(await send("PUT", "/api/targets", { id: SKILLS[i].id, value: t }));
  return t;
}
export async function resetRoster() { apply(await send("POST", "/api/reset", {})); }

// Theme and Mock mode are saved in the database too (settings table). Fire-and-forget: a failure never blocks the UI.
export const saveSettings = (patch) => send("PUT", "/api/settings", patch).catch(() => {});

// ---------- CSV ----------
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s, n = 60) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n); // single line + capped: these go into AI prompts

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
  const iStack = find("stack", "techstack", "keyskills");
  const iNotes = find("notes", "managernotes", "comments");
  const iPhoto = find("photo", "photourl", "image", "avatar", "photofile");
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
    if (iDesc >= 0) { const d = clean(r[iDesc], 300); if (d) emp.desc = d; }
    if (iStack >= 0) { const t = clean(r[iStack], 120); if (t) emp.stack = t; }
    if (iNotes >= 0) { const t = clean(r[iNotes], 600); if (t) emp.notes = t; }
    if (iYoe >= 0) { const y = Number(String(r[iYoe] ?? "").trim()); if (!isNaN(y) && y >= 0) emp.yoe = Math.round(y); }
    if (iPhoto >= 0) { const p = String(r[iPhoto] ?? "").trim().slice(0, 500); if (p) emp.photo = p; } // a file name (uploaded or in Assets/), or an image link
    employees.push(emp);
  }
  if (!employees.length) return { error: "No usable employee rows (every row was missing a name)." };
  if (skipped) warnings.push(`${skipped} row(s) without a name were skipped.`);
  if (blanks) warnings.push(`${blanks} blank or non-numeric score(s) set to 0.`);
  if (clamped) warnings.push(`${clamped} score(s) outside 0-5 were clamped.`);
  return { employees, warnings };
}

// Save a validated import in the database. mode: "replace" | "append". The server assigns ids (from 100 up, so they can never
// collide with the demo personas 1, 3, 4 that own hand-written mock roadmaps), stores photos, and returns the whole roster.
export async function commitImport(employees, mode = "replace") {
  apply(await send("POST", "/api/import", { mode, employees }));
  return EMPLOYEES.length;
}

// The CSV files (current roster / demo employees) are built by the server from the database, so they always match what is stored.
export const ROSTER_CSV_URL = "/api/roster.csv";
export const DEMO_CSV_URL = "/api/demo.csv";
