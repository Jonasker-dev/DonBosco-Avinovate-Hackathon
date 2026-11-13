// Gap math shared by the landing page and the dashboard. Pure logic: no DOM, no API, no AI.
// SKILLS / EMPLOYEES are the live arrays from data.js (roster.js mutates them in place).
import { SKILLS, EMPLOYEES } from "./data.js";

// ---------- ILLUSTRATIVE cost / time assumptions (one place to change them; the UI always labels the result "illustrative") ----------
export const ESTIMATE = {
  hoursPerLevel: 24, // learning hours to raise one person by one skill level (0-5 scale)
  costPerHour: 40,   // blended cost of one learner-hour (course fees + mentor time)
  hoursPerWeek: 4,   // hours per week a person can spend on upskilling
  currency: "$",
};
// Mentor rules: scoring this or higher counts as "can teach"; no mentor takes on more learners than the cap
export const MENTOR = { minScore: 3, maxMentees: 3 };

// ---------- averages, gaps, readiness ----------
export const avg = (i) => (EMPLOYEES.length ? EMPLOYEES.reduce((a, e) => a + e.s[i], 0) / EMPLOYEES.length : 0);
// Company gap per skill = target minus team average, biggest first
export const buildGaps = () => SKILLS.map((s, i) => ({ ...s, avg: avg(i), gap: Math.max(0, s.target - avg(i)) })).sort((a, b) => b.gap - a.gap);
export const readiness = () => Math.round((SKILLS.reduce((a, s, i) => a + Math.min(avg(i) / s.target, 1), 0) / SKILLS.length) * 100);
export const skillIndex = (id) => SKILLS.findIndex((s) => s.id === id);

// ---------- who is below target (the "Why this gap?" list) ----------
// Employees under the target for skill i, biggest deficit first
export function belowTarget(i) {
  const t = SKILLS[i].target;
  return EMPLOYEES.filter((e) => e.s[i] < t)
    .map((e) => ({ emp: e, score: e.s[i], deficit: +(t - e.s[i]).toFixed(1) }))
    .sort((a, b) => b.deficit - a.deficit || a.emp.name.localeCompare(b.emp.name));
}

// ---------- illustrative cost / time to close ----------
// cost = sum of every below-target person's deficit (levels) x hours per level x cost per hour
// time = the slowest learner's deficit x hours per level / hours per week (everyone trains in parallel)
export function estimate(i) {
  const rows = belowTarget(i), E = ESTIMATE;
  const levels = +rows.reduce((a, r) => a + r.deficit, 0).toFixed(1);
  const hours = Math.round(levels * E.hoursPerLevel), worst = rows[0]?.deficit || 0;
  return { people: rows.length, levels, hours, cost: hours * E.costPerHour, worst, weeks: worst ? Math.max(1, Math.ceil((worst * E.hoursPerLevel) / E.hoursPerWeek)) : 0 };
}
export const money = (n) => ESTIMATE.currency + Math.round(n).toLocaleString("en-US");
// Short label for a gap bar or tile
export const estText = (e) => (e.people ? `≈ ${money(e.cost)} · ~${e.weeks} wk` : "✓ on target");
// The formula with the real numbers filled in
export const formulaText = (e) => {
  const E = ESTIMATE;
  return `Cost: ${e.levels} levels missing × ${E.hoursPerLevel} h × ${money(E.costPerHour)}/h = ${money(e.cost)}. Time: slowest learner is ${e.worst} level${e.worst === 1 ? "" : "s"} short × ${E.hoursPerLevel} h ÷ ${E.hoursPerWeek} h per week ≈ ${e.weeks} weeks (everyone trains in parallel).`;
};

// ---------- who can mentor? (rule-based matching, no AI) ----------
// A mentor scores >= MENTOR.minScore AND is at least 1 level ahead of the learner. Learners are served worst-first;
// each picks the least-loaded eligible mentor (ties: higher score). Nobody mentors more than MENTOR.maxMentees people.
export function matchMentors(i) {
  const target = SKILLS[i].target, learners = belowTarget(i).map((r) => r.emp);
  const pool = EMPLOYEES.filter((e) => e.s[i] >= MENTOR.minScore);
  const load = new Map(pool.map((m) => [m, []]));
  const full = [], none = [];
  for (const l of learners) {
    const eligible = pool.filter((m) => m !== l && m.s[i] > l.s[i]);
    if (!eligible.length) { none.push(l); continue; }          // nobody in-house is ahead of this person
    const open = eligible.filter((m) => load.get(m).length < MENTOR.maxMentees);
    if (!open.length) { full.push(l); continue; }              // mentors exist but are at capacity
    open.sort((a, b) => load.get(a).length - load.get(b).length || b.s[i] - a.s[i] || a.name.localeCompare(b.name));
    load.get(open[0]).push(l);
  }
  const mentors = pool.filter((m) => load.get(m).length)
    .map((m) => ({ mentor: m, score: m.s[i], meetsTarget: m.s[i] >= target, mentees: load.get(m) }))
    .sort((a, b) => b.score - a.score || a.mentor.name.localeCompare(b.mentor.name));
  return { mentors, full, none, hasPool: pool.length > 0, best: Math.max(0, ...EMPLOYEES.map((e) => e.s[i])) };
}

// Up to `n` possible mentors for ONE employee in skill i (used in the employee modal)
export const mentorsFor = (emp, i, n = 2) =>
  EMPLOYEES.filter((m) => m !== emp && m.s[i] >= MENTOR.minScore && m.s[i] > emp.s[i])
    .sort((a, b) => b.s[i] - a.s[i] || a.name.localeCompare(b.name)).slice(0, n);
