// ALL AI calls live here. Provider chain: Gemini -> Groq -> Meta Muse -> mock. Returns parsed JSON.
// Keys come from config.js globals (SECRET_CONFIG_1/2/3). Never log keys.
import { MOCK, mockTrends } from "./data.js";
// mockKey "trends:<category>" returns that category's sample block; other keys read MOCK
const mockFor = (k) => (k.startsWith("trends:") ? mockTrends(k.slice(7)) : structuredClone(MOCK[k]));

// useMock: ON by default to save API quota; uncheck "Mock mode" for live AI.
// webSearch: market trends try Gemini + Google Search grounding first (one line to turn off).
export const ai = { useMock: true, webSearch: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = [404, 429, 500, 503, 504];
const KEYS = {
  gemini: () => (typeof SECRET_CONFIG_1 !== "undefined" ? SECRET_CONFIG_1.GEMINI_KEY : "")?.trim(),
  groq: () => (typeof SECRET_CONFIG_2 !== "undefined" ? SECRET_CONFIG_2.GRQ_KEY : "")?.trim(),
  meta: () => (typeof SECRET_CONFIG_3 !== "undefined" ? SECRET_CONFIG_3.META_KEY : "")?.trim(),
};

// Strip code fences and parse; throws a readable error.
function parseJSON(text) {
  const t = String(text).replace(/```json|```/g, "").trim();
  try { return JSON.parse(t); } catch {}
  const m = t.match(/[\[{][\s\S]*[\]}]/); // grounded replies may wrap the JSON in prose
  try { return JSON.parse(m[0]); } catch { throw new Error("AI returned invalid JSON"); }
}

async function post(url, headers, body) {
  for (let i = 0; i < 2; i++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if ((res.status === 429 || res.status === 503) && i === 0) { await sleep(800 + Math.random() * 700); continue; }
    const err = new Error(data.error?.message || `HTTP ${res.status}`); err.status = res.status; throw err;
  }
}

// --- Gemini (REST, JSON mode, model fallback via ListModels) ---
const G = "https://generativelanguage.googleapis.com/v1beta";
const G_PREF = ["gemini-3-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
let gModels = null;
async function geminiModels(k) {
  if (!gModels) {
    const r = await (await fetch(`${G}/models?pageSize=200&key=${k}`)).json();
    if (r.error) throw Object.assign(new Error(r.error.message), { status: 401 });
    const all = (r.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace("models/", ""));
    gModels = [...new Set([...G_PREF.flatMap((p) => all.filter((n) => n.startsWith(p))), ...all.filter((n) => n.includes("flash"))])];
  }
  return gModels;
}
async function gemini(prompt) {
  const k = KEYS.gemini(); if (!k) throw Object.assign(new Error("no gemini key"), { status: 404 });
  for (const m of await geminiModels(k)) {
    try {
      const d = await post(`${G}/models/${m}:generateContent?key=${k}`, {}, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });
      return parseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (e) { if (!SKIP.includes(e.status)) throw e; }
  }
  throw Object.assign(new Error("all gemini models busy"), { status: 503 });
}

// Gemini + Google Search grounding: the model searches the live web, then answers.
// One model only (no fallback loop) so a failure costs a single call. JSON mode can't be combined
// with the search tool, so the prompt asks for JSON and parseJSON() extracts it.
async function geminiSearch(prompt) {
  const k = KEYS.gemini(); if (!k) throw Object.assign(new Error("no gemini key"), { status: 404 });
  const m = (await geminiModels(k))[0];
  if (!m) throw Object.assign(new Error("no gemini model"), { status: 404 });
  const d = await post(`${G}/models/${m}:generateContent?key=${k}`, {}, { contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] });
  return parseJSON((d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join(""));
}

// --- OpenAI-compatible providers (Groq, Meta Model API) ---
async function openaiStyle(base, k, models, prompt, jsonMode) {
  if (!k) throw Object.assign(new Error("no key"), { status: 404 });
  for (const model of models) {
    try {
      const body = { model, messages: [{ role: "system", content: "Reply with a single valid JSON object only." }, { role: "user", content: prompt }] };
      if (jsonMode) body.response_format = { type: "json_object" };
      const d = await post(`${base}/chat/completions`, { Authorization: `Bearer ${k}` }, body);
      return parseJSON(d.choices?.[0]?.message?.content);
    } catch (e) { if (!SKIP.includes(e.status) && e.name !== "TypeError") throw e; }
  }
  throw Object.assign(new Error("provider unavailable"), { status: 503 });
}
const groq = (p) => openaiStyle("https://api.groq.com/openai/v1", KEYS.groq(), ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"], p, true);
const meta = (p) => openaiStyle("https://api.meta.ai/v1", KEYS.meta(), ["muse-spark-1.1"], p, false);

// Public API. mockKey picks the canned response ("insights" | "track" | "roadmap" | "trends").
// opts.search = true tries Gemini + Google Search first (only when ai.webSearch is on), then the normal chain.
export async function askAI(prompt, mockKey, opts = {}) {
  if (ai.useMock) { await sleep(900); return { data: mockFor(mockKey), via: "mock" }; }
  const chain = [["Gemini", gemini], ["Groq", groq], ["Meta Muse", meta]];
  if (opts.search && ai.webSearch) chain.unshift(["Gemini + Google Search", geminiSearch]);
  for (const [name, fn] of chain) {
    try { return { data: await fn(prompt), via: name }; } catch (e) { console.warn(`${name} failed:`, e.message); }
  }
  return { data: mockFor(mockKey), via: "mock (all providers failed)" };
}

// ---- Specialized AI calls ----

// Generate a personalized 4-week upskill roadmap for an employee
export async function generateUpskillRoadmap(employeeName, currentRole, knownSkills, targetRole, profile = null) {
  // Optional rich profile (yoe/stack/notes) makes the roadmap personal instead of generic
  const ctx = profile?.stack ? ` I have ${profile.yoe} years of experience in ${profile.stack}. My manager notes: ${profile.notes}` : "";
  const prompt = `I am ${employeeName}, a ${currentRole} who knows ${knownSkills}.${ctx} Generate a 4-week upskilling roadmap for me to learn and transition into the role of "${targetRole}".

You MUST reply with a single strict JSON object in exactly this shape (a "roadmap" key holding exactly 4 week objects):
{"roadmap": [{"week": 1, "topic": "...", "action_item": "..."}, {"week": 2, "topic": "...", "action_item": "..."}, {"week": 3, "topic": "...", "action_item": "..."}, {"week": 4, "topic": "...", "action_item": "..."}]}

Each topic should be specific and practical. Each action_item should be a concrete task the employee can do that week (e.g., "Complete X tutorial", "Build a small Y project", "Read Z documentation and summarize key concepts"). Make it progressive — each week builds on the previous.`;

  return askAI(prompt, profile && MOCK["roadmap_" + profile.id] ? "roadmap_" + profile.id : "roadmap");
}

// Accepts {"roadmap":[...]}, a bare array (mock data / older replies) or a few alternate keys.
// Returns clean [{week, topic, action_item}] or [] if nothing usable, so the UI never renders junk.
export function normalizeRoadmap(data) {
  const raw = Array.isArray(data) ? data : data?.roadmap || data?.weeks || data?.steps || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w) => w && typeof w === "object" && (w.topic || w.title) && (w.action_item || w.action))
    .map((w, i) => ({ week: w.week ?? i + 1, topic: String(w.topic || w.title), action_item: String(w.action_item || w.action) }));
}

// Estimate AI-recommended required levels based on employee data and market context
export async function estimateRequiredLevels(skills, employees) {
  const skillInfo = skills.map((s, i) => {
    const scores = employees.map((e) => e.s[i]);
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    return `${s.name} (current avg: ${avg}, current target: ${s.target})`;
  }).join("; ");
  const prompt = `You are an L&D strategist analyzing a workforce of ${employees.length} employees across ${skills.length} skills.
Current skills and averages: ${skillInfo}.

Analyze the biggest skill gaps and recommend optimal required levels (1-5 scale) for each skill.
Consider: market demand for each skill, how far behind the team is, and realistic improvement targets.
Push targets higher where the gap is critical and market demand is high.

Reply with strict JSON: {"targets": [number, number, ...]} — exactly ${skills.length} numbers (1-5), one per skill in the same order.`;

  return askAI(prompt, "aiTargets");
}

// Estimate realistic cost and time to close skill gaps using AI
export async function estimateCostTime(skills, employees, gaps) {
  const gapInfo = gaps.map((g) => `${g.name}: avg ${g.avg.toFixed(1)} vs target ${g.target} (gap: ${g.gap.toFixed(1)})`).join("; ");
  const prompt = `You are a training budget analyst. A company of ${employees.length} employees has these skill gaps:
${gapInfo}

For each skill, estimate the realistic cost (USD) and time (weeks) to close the gap through training.
Consider: group training discounts, online vs instructor-led, certification costs, and parallel training.

Reply with strict JSON: {"estimates": {"${skills.map((s) => s.id).join('": {"cost": number, "time": "X weeks", "reasoning": "..."}, "')}" : {"cost": number, "time": "X weeks", "reasoning": "..."}}}`;

  return askAI(prompt, "costTime");
}

// Fetch the top 3 in-demand skills for ONE category (picked in the drawer's selector).
// Live mode: Gemini searches the web (see geminiSearch), then Groq/Meta answer from model knowledge only.
export async function fetchMarketTrends(category, gap = null) {
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const prompt = `Which 3 skills in the "${category}" area of technology are employers hiring for most as of ${month}? Use current job-market evidence where you can search.${gap ? `
Context: our company's biggest internal skill gap is "${gap.name}" (team average ${gap.avg.toFixed(1)} of a required ${gap.target} on a 0-5 scale). If a skill in this category is genuinely in high demand AND helps close that gap, include it; otherwise rank purely by market demand.` : ""}

Reply with strict JSON in exactly this shape and nothing else:
{"category": "${category}", "skills": [{"skill": "...", "demand": "Hot|Rising|Emerging", "reason": "1-2 sentences: what the skill is and why employers want it now"}]}

Exactly 3 skills. Name specific tools or techniques, not broad fields. Do not invent percentages or statistics.`;

  return askAI(prompt, "trends:" + category, { search: true });
}
