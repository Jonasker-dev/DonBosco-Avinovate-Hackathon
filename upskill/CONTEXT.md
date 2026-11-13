# CONTEXT.md: Project Brain & Rules

> **For any AI assistant working in this repo:** read this file fully before writing code. Follow it. When something changes (a feature is finished, a decision is made, a rule is added), update this file and `README.md` in the same session.
>
> **For humans:** this file is meant to be reused and edited. Section 0 and Section 9 change per project; everything else is a standing rulebook. Add new rules to Section 10 instead of scattering them.

---

## 0. Project Brief (FILL IN AT PROJECT START)

| Field | Value |
|---|---|
| **Name** | UpskillAI |
| **One-line pitch** | Map workforce skills, forecast market tech demand, and generate AI learning tracks into next-gen roles. |
| **Problem / target user** | HR and L&D teams are blind to upcoming skill gaps and training needs as industry tools change. |
| **Core feature (the ONE thing that must work flawlessly)** | Competency heatmap with computed gaps, then AI market foresight and training pathway. |
| **Problem statement (paste verbatim, if given)** | 4. Enterprise Upskill AI. Companies struggle to keep pace with emerging industry tools, leaving HR and L&D teams blind to upcoming skill gaps and training needs. App: maps current employee competencies and flags organizational skill deficits; tracks upcoming technology demands and advises HR on future-proof training pathways; recommends personalized learning tracks to transition staff into next-gen tech roles. |
| **Judging / success criteria** | TBD (paste official criteria; optimize for them) |
| **Event / deadline / time budget** | Doom N Debug, PCCE Verna, 13 Nov 12:00 PM to 14 Nov 12:00 PM 2026 |
| **Presentation format** | 7 min pitch + 3 min Q&A |
| **Hard rules & restrictions** | No low-code/no-code platforms (Lovable, Emergent). |
| **Team & roles** | TBD |

If a field is unknown, leave it as TBD. Never invent values.

---

## 1. Tech Stack & File Hygiene

- **Frontend:** Semantic HTML5, Vanilla CSS (CSS Variables), Modular Vanilla JS (`type="module"`). No frameworks, bundlers, or build step unless the team approves.
- **AI layer:** Gemini REST API with `responseMimeType: "application/json"` and a `responseSchema` for structured output. Model names are never hardcoded as the only option (see Section 2).
- **Strict file rule:** NEVER create duplicate files (`index1.html`, `style_new.css`, `app_final_v2.js`). Edit existing files in place.
- **No new dependencies** (libraries, CDNs, fonts beyond the design system) without being asked.
- **Default structure** (adapt only if the project needs it, and record the change in Section 10):

```
index.html
config.js            (secret, gitignored, exposes SECRET_CONFIG)
config.example.js    (placeholder key, committed)
.gitignore           (must list config.js)
README.md            (see Section 7, mandatory)
CONTEXT.md           (this file)
css/styles.css
js/main.js           (entry point, wiring)
js/ai.js             (ALL Gemini calls live here and only here)
js/ui.js             (toasts, loaders, render helpers)
js/data.js           (seed / demo data)
```

- Keep functions small and commented. Prefer clarity over cleverness. Everything must be explainable by the team in a Q&A.

---

## 2. AI Layer Rules (`js/ai.js`)

- One public function: `askGemini(prompt, { schema }) -> parsed JSON`.
- **Model fallback:** fetch the model list once via `ListModels`, keep only models that support `generateContent`, cache the list, and try them in a preferred order (newest flash first, then lighter and pro variants).
- **Skip to the next model** on 404, 429, 500, 503, 504. Retry once with a short jittered delay on 429/503 before moving on. Stop immediately on other errors (bad key, bad request) and show a readable message.
- **Always:** `try/catch`, safe JSON parsing (strip code fences), validate the response shape, throw readable errors for the UI toast.
- **Never** call the API from anywhere except `ai.js`.
- **Mock mode:** `USE_MOCK = true` returns realistic canned responses so the demo survives a dead API or bad wifi. Mock mode must be toggleable in one line.
- Model names retire over time. If a model 404s, fix the preferred list, not the logic.
- The API key is client-visible. Never log it, never commit `config.js`, and keep a placeholder in `config.example.js`.

`config.js` format:

```javascript
const SECRET_CONFIG = {
  GEMINI_KEY: "API Key"
};
```

It loads as a classic `<script>` before any module scripts.

---

## 3. Mandatory Dark Mode Design System (apply to EVERY UI element)

Define all of this as CSS variables in `:root`. No hardcoded colors elsewhere.

- **Backgrounds:** Primary `#0B0F19`, Surface/Cards `#111827`, Elevated/Modal `#1F2937`.
- **Borders & glass:** `1px solid rgba(255, 255, 255, 0.08)` with `backdrop-filter: blur(12px)`.
- **Accents:** Brand `#3B82F6`, Hover `#2563EB`, Success `#10B981`, Warning `#F59E0B`, Danger `#EF4444`.
- **Typography:** `'Inter', system-ui, sans-serif`. Text `#F9FAFB`, Muted `#9CA3AF`.
- **Spacing & radius:** Card `12px`, Button `8px`, transitions `all 0.2s ease`.
- **Accessibility:** mobile-first responsive, visible focus states, sufficient contrast, labelled inputs, semantic elements.

---

## 4. Essential UX Rules (every interactive feature, automatically)

1. **Loading states:** disable the button and show a spinner or skeleton ("Analyzing with AI...") while waiting on `fetch()`.
2. **Toasts:** never `alert()`. Use a floating bottom-right dark toast for success and error messages.
3. **Empty & error states:** styled fallback card with a retry button when there is no data or the API fails.
4. **Pre-populated demo data:** realistic seed data so the app is never blank during a live demo.
5. **Persistence:** keep state in `localStorage` (wrapped in `try/catch`) so a refresh doesn't wipe the demo.
6. **Wow moment:** one visible, animated AI result in the core flow (smooth reveal or streaming-feel text).

---

## 5. Scope & Working Rules for the AI Assistant

- Build the core feature first, end to end, before any extras.
- Do not add features, pages, or dependencies that weren't requested.
- Change only what was asked. Do not refactor unrelated code.
- Prefer one complete, updated file over scattered partial snippets when editing.
- Check for console errors before declaring a feature done.
- If requirements are unclear, ask one short question or state the assumption in one line, then proceed.
- After each completed feature: update Section 9 and `README.md` (Section 7).
- Keep all work inside the allowed approach in Section 0 ("Hard rules & restrictions"). If a request would break one, say so instead of doing it.

---

## 6. Presentation & Demo Plan

Adjust the timings to the format in Section 0. Default for a 7 min pitch + 3 min Q&A:

| Time | Segment |
|---|---|
| 0:00 - 0:45 | Hook: the problem and who it affects |
| 0:45 - 4:30 | Live demo of the core flow using seed data, including the AI wow moment |
| 4:30 - 6:00 | How it works (architecture, why Gemini) and impact |
| 6:00 - 7:00 | What's next |
| Q&A | Prepare answers on scalability, accuracy, what happens when the AI is wrong or unavailable, and privacy |

- Have a screen recording as backup and mock mode ready.
- Test on a phone hotspot beforehand; shared event wifi is unreliable.
- Freeze features before the final stretch and use that time for a full run-through.

---

## 7. README.md Requirement (MANDATORY)

`README.md` is a deliverable, not an afterthought. It must be **created at project start, filled in, and edited after every feature or major change.** Never leave template placeholders in it. Never let it describe features that don't exist.

Required sections:

1. **Project name & one-line pitch**
2. **Problem statement & target user** (from Section 0)
3. **Features** (only what actually works)
4. **How the AI is used** (what the Gemini calls do, what the JSON output looks like, fallback and mock mode)
5. **Tech stack** (HTML, CSS, vanilla JS, Gemini API; note that no low-code/no-code platform was used)
6. **Setup & run:**
   - copy `config.example.js` to `config.js` and add a Gemini key
   - open `index.html` (or the serve command, if one is needed)
7. **Project structure** (the real file tree)
8. **Demo guide** (the 3-4 steps a judge should click through, plus the mock-mode switch)
9. **Team & roles**
10. **Limitations & future work** (honest; judges respect it)
11. **Screenshots or demo video link**

The AI assistant must check `README.md` against the actual code at the end of every feature and fix anything out of date.

---

## 8. Security & Repo Hygiene

- `config.js` is in `.gitignore`. Only `config.example.js` is committed.
- Never paste real keys into code, README, issues, or chat.
- Commit often with clear messages (a clean history helps prove the work is yours).
- Final check before submission: repo is public if required, runs from a fresh clone using only the README steps, and has no secrets in the history.

---

## 9. Living Project State (AI: update after each feature)

- [x] Project initialized
- [x] Brief filled in (Section 0)
- [ ] `README.md` created and filled in (Section 7)
- [x] Core layout & navbar
- [x] `ai.js` connected with model fallback + mock mode
- [x] Core feature loop completed
- [x] Loading / empty / error states everywhere
- [x] Seed data + localStorage persistence
- [x] Two-sided UI (HR Dashboard + Employee Dashboard)
- [x] Employee upskill roadmap (Gemini API, 4-week JSON)
- [x] Live Market Demands sidebar (Gemini on page load)
- [ ] `README.md` re-checked against final code
- [ ] Demo rehearsed, backup recording made
- [ ] Final submission checklist (Section 8) done

**Current focus:** Browser-test the live UI and fix any issues
**Known issues:** Not browser-tested yet; config.example.js has real keys (replace with placeholders before submission)

---

## 10. Decisions & Rule Changes Log

Record every deviation from this file or new standing rule here, newest first, so the AI and teammates stay aligned.

| Date | Decision / rule | Reason |
|---|---|---|
| 2026-11-13 | Two-sided UI with HR Dashboard and Employee Dashboard tabs added to `index.html` | Problem statement requires both org-level gap analysis and personalized employee learning tracks |
| 2026-11-13 | "Live Market Demands" sidebar added — Gemini API call on page load, 1hr cache | Fulfills "tracks upcoming technology demands" requirement with zero backend |
| 2026-11-13 | Employee upskill roadmap uses strict 4-week JSON schema via `generateUpskillRoadmap()` in `ai.js` | Real AI-generated paths, not pre-written; forces `[{week, topic, action_item}]` schema |
| 2026-11-13 | `ui.js` expanded with `renderTrends()`, `renderEmpSkills()`, `renderRoadmap()`, `initTabs()` | Modular rendering for the two dashboard views |
| 2026-11-13 | Light mode default + dark mode toggle button | Light mode is new professional default; dark mode is the original Rose Quartz Dark palette |
| 2026-11-13 | Mock mode ON by default (`ai.useMock: true`, checkbox checked) | Preserve API quota for hackathon presentation; uncheck to go live |
| 2026-11-13 | Live Market Demands is a toggle, OFF by default | No API calls on page load; user opts in to fetch trends |


---

## 9. Progress Log (update after every feature)

- [x] Project scaffold, "Rose Quartz Dark" palette (random pick, `pick_palette.py`, seed 276395191)
- [x] Competency heatmap + locally computed gaps (`js/data.js`, `js/main.js`)
- [x] AI market foresight + training pathway (`analyze()` in `main.js`)
- [x] Personalized learning track per employee (`buildTrack()`)
- [x] Provider fallback chain + mock mode (`js/ai.js`)
- [x] Two-sided UI: HR Dashboard + Employee Dashboard with tab switching
- [x] Employee login flow with skill profile visualization
- [x] Employee "Generate My Upskill Path" — real Gemini API call returning strict 4-week JSON roadmap, rendered as week cards
- [x] "Live Market Demands" sidebar — toggle (off by default), fetches top 3 trending tech skills from Gemini when toggled on, cached 1 hour
- [x] Mock data for roadmap and trends (offline fallback)
- [x] Light mode (default) + dark mode toggle button with localStorage persistence
- [x] Mock mode ON by default to preserve API quota before hackathon
- [ ] Not browser-tested against live APIs yet (sandbox had no access). Run `yo.html` and the app first.
- [ ] Ideas if time allows: CSV import of employees, editable target levels, export pathway as PDF

---

## 10. Project-Specific Rules & Deviations

- **Palette deviation:** Light mode is the new default (bg `#F8F6F7`, surface `#FFFFFF`). Dark mode (toggle button) uses the original "Rose Quartz Dark" palette (brand `#F43F5E`, accent `#FDA4AF`, bg `#130A10`). Dark-mode structure, radii and glass rules still apply.
- **config.js format:** the real file defines `SECRET_CONFIG_1 {GEMINI_KEY}`, `SECRET_CONFIG_2 {GRQ_KEY}`, `SECRET_CONFIG_3 {META_KEY}`. Keep it and keep `config.example.js` in sync.
- **AI layer:** public function is `askAI(prompt, mockKey)` in `js/ai.js`, returning `{data, via}`. Chain: Gemini (ListModels fallback) -> Groq (`https://api.groq.com/openai/v1`, json_object) -> Meta Model API (`https://api.meta.ai/v1`, `muse-spark-1.1`) -> mock. Meta may be blocked by browser CORS; that is expected and falls through.
- **Gaps are computed in JS** (target minus team average). The AI only does forecasting and pathways, so numbers are never hallucinated.
- `yo.html` is the standalone API tester; leave it alone.
