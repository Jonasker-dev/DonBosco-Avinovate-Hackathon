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
- **AI layer:** Gemini, Groq and Meta REST APIs (JSON output), with canned mock data as the last fallback. Model names are never hardcoded as the only option (see Section 2).
- **Strict file rule:** NEVER create duplicate files (`index1.html`, `style_new.css`, `app_final_v2.js`). Edit existing files in place.
- **No new dependencies** (libraries, CDNs, fonts beyond the design system) without being asked.
- **Default structure** (adapt only if the project needs it, and record the change in Section 10):

```
index.html           (start page / hero, its own webpage)
dashboard.html       (HR Dashboard + Employee Dashboard)
server.py            (optional stdlib server: static files + data/roster.json persistence)
config.js            (secret, gitignored, exposes SECRET_CONFIG)
config.example.js    (placeholder key, committed)
.gitignore           (must list config.js)
README.md            (see Section 7, mandatory)
CONTEXT.md           (this file)
css/styles.css
js/main.js           (dashboard entry point, wiring)
js/landing.js        (start page entry point)
js/datamodal.js      (Manage data modal: targets + CSV + reset; shared by both pages)
js/gaps.js           (pure gap math: averages, readiness, ILLUSTRATIVE cost/time, mentor matching; no DOM, no AI)
js/ai.js             (ALL AI calls live here and only here)
js/ui.js             (toasts, loaders, render helpers)
js/data.js           (seed / demo data, mock AI responses)
js/radar.js          (dependency-free SVG radar)
js/fx.js             (visual effects only)
js/roster.js         (editable skill targets + CSV import/export + 3-layer persistence; no DOM, no API)
```

- Keep functions small and commented. Prefer clarity over cleverness. Everything must be explainable by the team in a Q&A.

---

## 2. AI Layer Rules (`js/ai.js`)

- **Public API:** `askAI(prompt, mockKey, opts) -> { data, via }` (parsed JSON plus the provider that answered). Feature helpers `generateUpskillRoadmap()`, `fetchMarketTrends(category, gap)` and `normalizeRoadmap()` also live in `ai.js`.
- **Provider chain:** Gemini -> Groq -> Meta Muse -> mock. For market trends, `opts.search` adds Gemini + Google Search grounding at the front (flag `ai.webSearch`).
- **Gemini model fallback:** fetch the model list once via `ListModels`, keep only models that support `generateContent`, cache it, and try them in a preferred order (newest flash first, then lighter and pro variants). The search call uses the first model only.
- **Skip to the next model/provider** on 404, 429, 500, 503, 504. Retry once with a short jittered delay on 429/503 first. Stop immediately on other errors (bad key, bad request) for that provider and move on to the next one.
- **Always:** `try/catch`, safe JSON parsing (`parseJSON` strips code fences and extracts JSON from prose), validate the response shape (`normalizeRoadmap` for roadmaps), throw readable errors for the UI toast.
- **Never** call an AI API from anywhere except `ai.js`.
- **Mock mode:** `ai.useMock = true` (default) returns realistic canned responses so the demo survives a dead API or bad wifi. Toggleable in one line (`ai.js`) or with the navbar checkbox.
- Model names retire over time. If a model 404s, fix the preferred list, not the logic.
- The API keys are client-visible. Never log them, never commit `config.js`, and keep placeholders in `config.example.js`.

`config.js` format (see `config.example.js`):

```javascript
const SECRET_CONFIG_1 = { GEMINI_KEY: "..." };
const SECRET_CONFIG_2 = { GRQ_KEY: "..." };
const SECRET_CONFIG_3 = { META_KEY: "..." };
```

It loads as a classic `<script>` before any module scripts. A blank key is skipped.

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
   - run `python3 server.py` and open http://localhost:8000 (index.html is the start page)
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

- [x] Project initialized, brief filled in (Section 0)
- [x] `ai.js` provider chain (Gemini -> Groq -> Meta -> mock) with model fallback + mock mode
- [x] v8: hero is its own page (`index.html`); dashboard moved to `dashboard.html`. CSV import on the start page keeps the user there. Start page no longer skipped on reload.
- [x] v8: imported roster persists in 3 layers (localStorage, IndexedDB, `data/roster.json` via `server.py`); Reset wipes all three; Reset button visible in Mock mode only (`body.mock`)
- [x] v8: CSV import defaults to "Add to current roster" (replace is still an option) so pre-existing employees stay visible
- [x] v8: HR sub-navigation (radar | heatmap | foresight) with URL hash; heatmap Maximize view; PDF prints all sections + full heatmap; Export PDF on the Employee dashboard
- [x] v8: gap bars are clickable "Why this gap?" drill-downs with ILLUSTRATIVE cost/time and a rule-based "Who can mentor?" (also in the employee modal)
- [x] (v7, now on `index.html`) Screen 1: Landing hero, theme-aware (light default, dark when toggled; toggle button on the landing too). Aurora + dot-grid background, cursor spotlight, live radar preview card with floating chips (all numbers from the data), stats strip, "Launch Dashboard" + "Import your own CSV"; brand click returns to it; skipped on reload within a session
- [x] Manage data modal (HR hero button): editable required skill levels (1-5 steppers) and CSV import (file, drag-drop or paste; preview + warnings; Replace or Add; template download). Saved in localStorage (`upskill_roster`), "Reset to demo data" restores the seed. Skills list stays the fixed 8.
- [x] Dashboard heroes are gradient banners; HR hero shows a Demo dataset / Custom data tag
- [x] Analysis made before a data change is flagged "data changed since this analysis: re-run" (fingerprint `sig()`), never silently shown as current
- [x] Screen 2: HR Dashboard: stats, company radar (required vs average), heatmap + gap bars, AI market foresight + pathway, Export PDF (`window.print()` + `@media print`)
- [x] Screen 3: Employee pathway modal: click any heatmap row -> radar + target role + AI 4-week roadmap
- [x] Live Market Demand: category selector (8 chips) instead of auto-cycling; mock feed shows surge %, urgency and a 1-2 sentence description per skill; SAMPLE FEED tag
- [x] Live Market Demand drawer widened to 540px (was 260px), flex column layout, full width on phones
- [x] AI mode for market trends: category-specific prompt, Gemini + Google Search grounding first (`ai.webSearch`), then Gemini -> Groq -> Meta -> mock. NOT yet tested against the real API
- [x] Radar label clipping fixed (viewBox `-50 0 540 390`, still plain SVG, centre unchanged)
- [x] Roadmap prompt asks for `{"roadmap":[...]}`; `normalizeRoadmap()` accepts that, bare arrays and alternate keys, and drops malformed weeks
- [x] Company gap -> market link: the biggest gap (`gaps[0]`) is passed into the Analyze prompt and the market drawer prompt; drawer skills whose name matches it (`matchesGap`, `GAP_KEYWORDS` in `data.js`) and show strong demand get a "Critical Company Gap & Market Surge" flag
- [x] Personas use full names: Jonasker Fernandes, Mavilon Coutino (was Dean), Schneider Gracious (was Pravin)
- [x] Layouts use Flexbox (former CSS Grid layouts converted); heatmap stays a `<table>`
- [x] Personas with context-rich prompts + per-persona mock roadmaps; target role preselected
- [x] Radar chart: dependency-free SVG (`js/radar.js`), no Chart.js/CDN, works offline
- [x] `[DEMO MODE ACTIVE]` corner badge: shown in mock mode and whenever any AI call falls back to mock
- [x] Employee Dashboard tab (kept as bonus): profile select, skill bars + radar, AI 4-week roadmap (`[{week, topic, action_item}]`)
- [x] Light mode default + dark mode toggle (dark = "Rose Quartz Dark")
- [x] Live Market Demand: slide-in drawer opened from a navbar button (closed by default, fetch only on first open, live results cached 6 h per category, Esc/scrim/X to close)
- [x] Visual polish (`js/fx.js`): particle network background, scroll reveal, stat count-up, bar grow, hover lift. Respects `prefers-reduced-motion`.
- [x] Loading / empty / error states, seed data, localStorage persistence
- [x] `README.md` updated for the current feature set
- [ ] Browser-test the live UI against real APIs (check each key works first, e.g. with `yo.html` if you have it locally)
- [ ] Demo rehearsed, backup recording made
- [ ] Final submission checklist (Section 8) done

**Current focus:** Test against live APIs (mock off), rehearse the 3-screen demo
**Known issues:** Imported data lives on one machine (browser storage; plus `data/roster.json` when `server.py` runs). If `server.py` is stopped while you press Reset, the old file stays and is restored on the next boot, so reset with the server running. Imported employees have no persona notes, so their roadmap uses the generic prompt / generic mock roadmap. Custom data lives in one browser's localStorage only (no server, no sharing). Mock mode was browser-checked (headless Chromium, no console errors); live APIs are not. Meta Model API may be blocked by CORS (expected, falls through to mock). Gemini + Google Search grounding is unverified against the real API (if it fails it silently falls back to plain Gemini). Gap flag matching is keyword-based on skill names, so unusual live skill names may not be flagged.
**Scope decision:** CSV import and editable HR targets ARE built (Manage data modal, see Section 10). Seed data is still the default and Reset restores it. NO extra pages (Roles matrix, Team view, Learning Hub). Demo = the 3 screens above. No pie charts (skills are not parts of a whole).

---

## 10. Decisions & Rule Changes Log

Newest first. Record every deviation from this file or new standing rule here.

| Date | Decision / rule | Reason |
|---|---|---|
| 2026-11-14 | **v8 multi-page split.** `index.html` = start page, `dashboard.html` = HR + Employee, shared modules. Manage data modal moved out of `main.js` into `js/datamodal.js` (injects its own markup) so both pages use one copy. Mock-mode choice is kept in `sessionStorage` (`upskill_mock`) so both pages agree; default still ON. Removed the "skip landing within a session" logic. Esc closes only the front-most modal (`isTopModal`). | Requested: hero as a separate page that stays put after a CSV import; the HR page was getting crowded |
| 2026-11-14 | **Persistence in 3 layers** (`roster.js`): localStorage, IndexedDB mirror, `data/roster.json` through `server.py` (page detects it via the `upskill_srv` cookie, so plain servers cause no failed requests). `loadSaved()` is now async (top-level `await` in both entry scripts). Reset deletes all layers. No browser page can survive "Clear site data" without writing outside the browser; `server.py` is that outside place. `server.py` is stdlib only, binds to 127.0.0.1, accepts only `/api/roster`. | Requested: imported CSV must outlive clearing local storage |
| 2026-11-14 | **Cost/time estimate and mentor matching are plain formulas in `js/gaps.js`**, shown as ILLUSTRATIVE (24 h per level, $40/h, 4 h/week; mentor = score 3+ and 1 level ahead, max 3 learners). No AI involved, so the numbers are explainable in Q&A. | Requested; fits the rule that gaps are computed, never hallucinated |
| 2026-11-14 | HR dashboard uses sub-navigation (`.subtab` / `.hr-pane`, hash `#radar|#heatmap|#foresight|#employee`). Print CSS forces all panes visible and removes the heatmap height cap, so the PDF has every section and every employee. Export PDF buttons: HR sub-nav bar and Employee profile card; a print-only title block is filled on `beforeprint`. | Requested |
| 2026-11-13 | Landing now follows the theme (removed `body.landing` from the dark selector); `.theme-btn` buttons (navbar + landing) share one handler; inline script in `index.html` applies the saved theme before first paint. Added `color-scheme`, `--info`, and aurora/spot/hero variables for both themes; heatmap cells use `--heat-color`. Dashboard `.hero` is now a gradient banner. Landing/hero motion lives in `fx.js` + the FX/landing CSS only. | Light default with dark toggle was requested for every screen; hero was too plain |
| 2026-11-13 | CSV import + editable HR targets BUILT in new `js/roster.js` (pure data logic) with the Manage data modal in `main.js`/`index.html`. SKILLS/EMPLOYEES are mutated in place; derived values (`gaps`, `topGap`, `names`, `targets`) are rebuilt by `recompute()`; `refreshAll()` re-renders. Imported ids start at 100 so they never hit the persona mock roadmaps (ids 1, 3, 4); roadmap caches are purged on roster change; names/roles are cleaned and capped at 60 chars because they go into AI prompts. Skills stay the fixed 8 (CSV maps columns to them). Supersedes the "NOT built" row below. | Team has time before freeze; makes "maps current employee competencies" real. Not a new page or dependency |
| 2026-11-13 | Radar viewBox widened to `-50 0 540 390` (centre still 220,190) and `.radar-wrap` max-width 540px. | "Product Thinking" label was clipped; plain SVG kept |
| 2026-11-13 | Roadmap prompt now asks for `{"roadmap":[...]}`; `normalizeRoadmap()` replaces the inline parser in `main.js`. | Groq JSON mode needs an object, not a bare array; one safe parser for live and mock |
| 2026-11-13 | Company gap linked to market data: top gap goes into the Analyze and market-drawer prompts; flag shown by deterministic name matching (`matchesGap`), never by the AI. Flag needs strong demand (Critical/High/Hot/Rising). | Ties the three problem-statement pillars together; avoids AI hallucinating which skill "matches" |
| 2026-11-13 | SUPERSEDED by the roster row above: CSV import / editable HR targets were first NOT built (seed data only, explained verbally). | 44-hour deadline, avoid CRUD bloat |
| 2026-11-13 | Personas renamed to full names: Jonasker -> Jonasker Fernandes, Dean -> Mavilon Coutino, Pravin -> Schneider Gracious (`data.js`, README, this file). Ids and mock roadmap keys unchanged. | Requested by the team |
| 2026-11-13 | Layout rule: use Flexbox. All former `display:grid` layouts (page columns, stats, gap bars, tiles, roadmap cards, radar split, toasts, drawer) now use flex. | Requested by the team; fewer layout systems to explain |
| 2026-11-13 | Live Market Demand reworked: drawer 540px wide; category chips (`#trendCats`) replace auto-cycling; `fetchMarketTrends(category)`; mock block per category via `mockTrends(category)` (mockKey `"trends:<category>"`); mock skills carry `desc`; the "(sample)" suffix is gone (SAMPLE FEED tag stays); live results cached 6 h per category (`upskill_market_<category>`, was one 1 h key). | Bigger, clearer demo; selector gives a deliberate topic; 6 h cache protects free-tier quota |
| 2026-11-13 | Market trends in live mode try Gemini + Google Search grounding first (`geminiSearch()` in `ai.js`, flag `ai.webSearch`). One model, one call; on any failure fall through to Gemini -> Groq -> Meta -> mock. Prompt forbids invented percentages, so live cards show demand level + reason only (no surge %). `parseJSON` now extracts JSON from prose. | Grounding is the only way the feed is actually "from the internet"; JSON mode cannot be combined with the search tool |
| 2026-11-13 | SUPERSEDED by the category-selector row above: mock market feed shuffle bag (`nextMockTrends()`) removed. 8 categories stay in `MOCK_MARKET_TRENDS`; numbers are illustrative sample data, shown under SAMPLE FEED + DEMO badge. | Replaced because the user picks the category now |
| 2026-11-13 | 3 hand-written personas (Jonasker, Pravin, Dean) replaced 3 similar seed employees. They carry `yoe`, `stack`, `notes`, `target`; these go into the roadmap prompt. Each has its own mock roadmap (`MOCK.roadmap_<id>`). The other 5 employees use the generic prompt. | Personalised output is the requirement; keeps the 8-row heatmap and radar intact |
| 2026-11-13 | Scope locked to 3 screens (landing, HR dashboard, employee modal). Removed the HR "Personalized learning track" 12-week card; its job is now the modal. | Redundant with the roadmap, and fewer polished screens beat many half-built ones |
| 2026-11-13 | Radar chart is hand-written SVG, not Chart.js | One less CDN to fail on event wifi; themeable; animated |
| 2026-11-13 | PDF export = `window.print()` + print CSS | 2 minutes instead of a PDF library |
| 2026-11-13 | `#demoBadge` shows whenever output is mock (toggle on, or provider fallback) | Honesty with judges; never pass sample data off as live |
| 2026-11-13 | Live Market Demand moved from fixed sidebar to a slide-in drawer (`#sidebar.open`), opened by `#trendsBtn`. Inner toggle switch removed; opening the drawer is the opt-in. | Frees full page width, cleaner on mobile, still no API call on page load |
| 2026-11-13 | Added `js/fx.js` (canvas particles, IntersectionObserver reveal, count-up). Pure visual, no data or API access. | Polish for judging; no new dependencies |
| 2026-11-13 | Mock mode ON by default (`ai.useMock: true`, checkbox checked) | Preserve API quota; uncheck to go live |
| 2026-11-13 | Light mode default + dark mode toggle. Dark mode is the random "Rose Quartz Dark" pick (`pick_palette.py`, seed 276395191): brand `#F43F5E`, accent `#FDA4AF`, bg `#130A10` | Section 3 palette overridden; dark structure, radii and glass rules still apply |
| 2026-11-13 | Two-sided UI (HR Dashboard + Employee Dashboard tabs) | Problem statement needs org-level gaps and personal learning tracks |
| 2026-11-13 | Employee roadmap uses strict 4-week JSON via `generateUpskillRoadmap()`; market drawer uses `fetchMarketTrends()` (both in `ai.js`) | Real AI output, schema-forced |
| 2026-11-13 | `ui.js` holds `renderTrends()`, `renderEmpSkills()`, `renderRoadmap()`, `initTabs()`, `initThemeToggle()` | Modular rendering |
| 2026-11-13 | AI public function is `askAI(prompt, mockKey)` returning `{data, via}`; Meta Model API = `https://api.meta.ai/v1`, `muse-spark-1.1` | Multi-provider fallback |

**Standing rules for this project**
- `config.js` defines `SECRET_CONFIG_1 {GEMINI_KEY}`, `SECRET_CONFIG_2 {GRQ_KEY}`, `SECRET_CONFIG_3 {META_KEY}`. It is gitignored; `config.example.js` must only ever hold placeholders.
- Skill gaps are computed in JS (target minus average). The AI only forecasts and plans, so numbers are never hallucinated.
- Market trends: with `ai.webSearch` on and a Gemini key, live results come from Gemini + Google Search (tag shows "via Gemini + Google Search"). Any other tag ("via Gemini", "via Groq", "via Meta Muse") means model knowledge only, not web data. Mock numbers are illustrative. Say this in the pitch.
- Use Flexbox for layout. Do not reintroduce `display:grid` without recording why in this file.
- Cost/time numbers must always carry the word "illustrative" in the UI. Change the assumptions only in `ESTIMATE` (`gaps.js`).
- Targets and the roster are changed ONLY through `roster.js` (`setTarget`, `commitImport`, `resetRoster`), then call `refreshAll()` in `main.js`. Never mutate `SKILLS`/`EMPLOYEES` from anywhere else. Imported ids must stay >= 100.
- Never ship a screen that looks right in only one theme: every colour is a CSS variable defined for light and dark.

**API usage budget (3 free-tier keys): READ BEFORE TESTING OR PRESENTING**
- Keys: Gemini = recurring daily quota (workhorse for ALL testing and the final demo). Groq = limited (reserve). Meta = limited (reserve; may also be CORS-blocked).
- Chain order is Gemini -> Groq -> Meta -> mock, so Groq/Meta only fire when Gemini fails. A Gemini 429 during testing would quietly burn them. While developing, set `GRQ_KEY` and `META_KEY` to `""` in your local `config.js` (blank keys are skipped); restore them only for the final rehearsal and the presentation.
- Cost per click in live mode: Analyze with AI = 1 call; each roadmap = 1; each NEW market category = 1 grounded call (cached 6 h per category, so re-clicking a chip is free); Refresh = 1 forced call. Mock mode = 0.
- Testing: Mock ON by default. Aim for at most about 10 live calls per day. Do one live pass per feature, then go back to mock.
- Before the presentation: with the keys restored, pre-warm the cache in the SAME browser and at the SAME URL you will present from (localStorage is per origin): Analyze with AI once, the three persona roadmaps (Jonasker Fernandes, Mavilon Coutino, Schneider Gracious), and 2-3 market categories. About 7 Gemini calls. Insights and roadmaps persist in localStorage; trends last 6 h, so pre-warm trends within 6 h of the pitch.
- During the pitch: start in Mock mode (safe), flip Mock OFF only for the live-AI segment so cached results appear instantly. If wifi or quota dies, tick Mock mode; the DEMO badge keeps it honest.
- If Gemini's daily quota is exhausted, Groq is the real backup (Meta likely fails on CORS). Do not spend Groq during testing.
- To turn web search off (saves grounded-search quota): set `webSearch: false` in `ai.js`.
- All animation/visual code lives in `js/fx.js` and the FX block at the end of `css/styles.css`. Keep it free of data logic.
- `yo.html` is the standalone API tester; leave it alone.
