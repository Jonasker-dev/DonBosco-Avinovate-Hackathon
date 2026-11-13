// ALL AI calls live here. Provider chain: Gemini -> Groq -> Meta Muse -> mock. Returns parsed JSON.
// Keys come from config.js globals (SECRET_CONFIG_1/2/3). Never log keys.
import { MOCK } from "./data.js";

export const ai = { useMock: true }; // ON by default to save API quota; uncheck "Mock mode" for live AI
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIP = [404, 429, 500, 503, 504];
const KEYS = {
  gemini: () => (typeof SECRET_CONFIG_1 !== "undefined" ? SECRET_CONFIG_1.GEMINI_KEY : "")?.trim(),
  groq: () => (typeof SECRET_CONFIG_2 !== "undefined" ? SECRET_CONFIG_2.GRQ_KEY : "")?.trim(),
  meta: () => (typeof SECRET_CONFIG_3 !== "undefined" ? SECRET_CONFIG_3.META_KEY : "")?.trim(),
};

// Strip code fences and parse; throws a readable error.
function parseJSON(text) {
  try { return JSON.parse(String(text).replace(/```json|```/g, "").trim()); }
  catch { throw new Error("AI returned invalid JSON"); }
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
async function gemini(prompt) {
  const k = KEYS.gemini(); if (!k) throw Object.assign(new Error("no gemini key"), { status: 404 });
  if (!gModels) {
    const r = await (await fetch(`${G}/models?pageSize=200&key=${k}`)).json();
    if (r.error) throw Object.assign(new Error(r.error.message), { status: 401 });
    const all = (r.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => m.name.replace("models/", ""));
    gModels = [...new Set([...G_PREF.flatMap((p) => all.filter((n) => n.startsWith(p))), ...all.filter((n) => n.includes("flash"))])];
  }
  for (const m of gModels) {
    try {
      const d = await post(`${G}/models/${m}:generateContent?key=${k}`, {}, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } });
      return parseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (e) { if (!SKIP.includes(e.status)) throw e; }
  }
  throw Object.assign(new Error("all gemini models busy"), { status: 503 });
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
export async function askAI(prompt, mockKey) {
  if (ai.useMock) { await sleep(900); return { data: structuredClone(MOCK[mockKey]), via: "mock" }; }
  for (const [name, fn] of [["Gemini", gemini], ["Groq", groq], ["Meta Muse", meta]]) {
    try { return { data: await fn(prompt), via: name }; } catch (e) { console.warn(`${name} failed:`, e.message); }
  }
  return { data: structuredClone(MOCK[mockKey]), via: "mock (all providers failed)" };
}

// ---- Specialized AI calls ----

// Generate a personalized 4-week upskill roadmap for an employee
export async function generateUpskillRoadmap(employeeName, currentRole, knownSkills, targetRole) {
  const prompt = `I am ${employeeName}, a ${currentRole} who knows ${knownSkills}. Generate a 4-week upskilling roadmap for me to learn and transition into the role of "${targetRole}".

You MUST reply with strict JSON in this exact format — an array of exactly 4 objects:
[{"week": 1, "topic": "...", "action_item": "..."}, {"week": 2, "topic": "...", "action_item": "..."}, {"week": 3, "topic": "...", "action_item": "..."}, {"week": 4, "topic": "...", "action_item": "..."}]

Each topic should be specific and practical. Each action_item should be a concrete task the employee can do that week (e.g., "Complete X tutorial", "Build a small Y project", "Read Z documentation and summarize key concepts"). Make it progressive — each week builds on the previous.`;

  return askAI(prompt, "roadmap");
}

// Fetch top 3 trending tech skills for the current month
export async function fetchMarketTrends() {
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const prompt = `What are the top 3 trending technology skills in the job market as of ${month}? Consider skills that companies are actively hiring for and that show growing demand.

You MUST reply with strict JSON in this exact format — an array of exactly 3 objects:
[{"skill": "...", "demand": "Hot|Rising|Emerging", "reason": "one sentence explaining why this skill is trending"}]

Focus on specific, actionable skills (not broad categories). Consider AI/ML, cloud, security, and modern development trends.`;

  return askAI(prompt, "trends");
}
