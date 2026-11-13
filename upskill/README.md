# UpskillAI

Map workforce skills, forecast market tech demand, and generate AI learning tracks into next-gen roles.

## Problem statement & target user
Problem statement 4, Enterprise Upskill AI. HR and L&D teams are blind to upcoming skill gaps as industry tools change. Target user: L&D managers and HR business partners.

## Features
- Start page (`index.html`, its own webpage): theme-aware hero with aurora background, cursor light and a live radar preview. "Import your own CSV" works right there and the page stays put; "Launch Dashboard" opens `dashboard.html`
- HR dashboard with sub-navigation (Company skill radar, Competency heatmap, Market foresight & training pathway), one section at a time; the URL hash (`#radar`, `#heatmap`, `#foresight`, `#employee`) remembers where you were
- Competency heatmap: scrollable card plus a **Maximize** view that shows every employee at once; click a row for the employee pathway modal
- **Why this gap?** Click any gap bar to see which employees are below target, an illustrative cost / time-to-close estimate, and a rule-based **Who can mentor?** match (high scorers to low scorers, no AI). The employee modal also lists possible mentors for that person's biggest gaps
- **Cost / time to close** per gap, a simple formula clearly labelled illustrative (assumptions live in `js/gaps.js`)
- **Export PDF** on the HR dashboard (all three sections and the full, un-capped heatmap) and on the Employee dashboard (profile + roadmap), via the browser print dialog ("Save as PDF")
- Live Market Demand drawer with a category selector (8 categories) that flags skills matching the company's biggest gap as "Critical Company Gap & Market Surge": mock mode shows sample skills with descriptions; live mode asks Gemini with Google Search for that category
- Mock mode: three personas (Jonasker Fernandes, Mavilon Coutino, Schneider Gracious) get visibly different roadmaps
- Honest `[DEMO MODE ACTIVE]` badge whenever sample data is shown
- Two-sided UI: HR Dashboard and Employee Dashboard (tabs), light mode by default with a dark mode toggle on every screen, including the landing
- Competency heatmap (8 demo employees x 8 skills) with target levels and computed gap bars
- **Manage data**: edit the required level of each skill (1-5) and import your own employees from CSV (file, drag-drop or paste, with preview and warnings; replace or add). Everything is saved in a real **SQLite database** (`data/upskill.db`, written by `server.py`): name, photo, all skill scores, job title, years of experience, description, stack, notes, target role, and the required levels. Both pages read it, so the data is still there after a refresh, in another browser, or on another computer once the folder is copied. **Reset to demo data** (visible in Mock mode only) empties the database of imported employees and photos and reloads the demo employees, their photos and the default levels. CSV import defaults to "Add to current roster" so existing employees stay. Gaps, readiness, radar, AI prompts and market flags all recompute; an analysis made before a change is flagged as stale
- Dashboard stats: workforce readiness, critical gaps, biggest gap
- "Analyze with AI": emerging tech forecast plus a 3-phase company training pathway
- Employee login, skill profile, and AI 4-week upskill roadmap
- Live Market Demand slide-in drawer (opens from the navbar, fetches on first open, live results cached 6 hours per category)
- Particle-network background, scroll reveal, count-up stats and hover motion (`js/fx.js  js/radar.js`)
- Mock mode toggle (on by default) and light/dark theme, both saved in the database, toasts, loading states. **No browser storage is used anywhere** (no localStorage, sessionStorage, IndexedDB or cookies). AI results (analysis, roadmaps, cost estimates) are session-only caches in memory

## How the AI is used
`js/ai.js` calls Gemini first (model list fetched via ListModels, newest flash first), then Groq, then the Meta Model API, then canned mock data. Every call requests JSON. Market trends try Gemini with Google Search grounding first (set `webSearch: false` in `ai.js` to skip); Groq and Meta answer from model knowledge only, and the card tag says which source was used.
- Insights shape: `{summary, emerging:[{tech,horizon,impact,why}], pathway:[{phase,actions[]}]}`
- Roadmap shape: `{"roadmap":[{week, topic, action_item}]}` (4 weeks; bare arrays from mock data are also accepted)
- Market trends shape: `{category, skills:[{skill, demand, reason}]}` for the selected category
Gap numbers are computed locally; the AI never invents them. The biggest gap is passed into the Analyze and market prompts, and the drawer flag is a local keyword match, not an AI judgement.

## Tech stack
Semantic HTML5, vanilla CSS variables (Flexbox layouts), modular vanilla JS, Gemini / Groq / Meta APIs. No low-code/no-code platform was used.

## Setup & run
1. Copy `config.example.js` to `config.js` and add keys (already present locally, gitignored).
2. Run `python3 server.py` (Windows: `python server.py`) and open http://localhost:8000. `server.py` serves the folder and owns the database `data/upskill.db` (created and filled with the demo employees on first run; Python standard library only, nothing to install). **The app needs `server.py` running**: without it the page shows a "Database not reachable" notice instead of silently using temporary data. Do not open the HTML files by double-click (the database is behind the server, and browsers block ES modules on `file://`).
3. To use the same data on another computer, copy the whole project folder (the database is the single file `data/upskill.db`; stop the server first so it is not mid-write) and run `python3 server.py` there. `python3 server.py --lan` also lets other devices on your network open it (there is no login, so only on a network you trust). If you are upgrading from v8-v10, an existing `data/roster.json` is imported into the database automatically on first start.

## Project structure
```
index.html (start page)  dashboard.html (HR + Employee)  server.py (static files + SQLite API; required)
config.js  config.example.js  CONTEXT.md  README.md  (yo.html API tester if you keep one locally)
pick_palette.py  palette.json
css/styles.css
js/main.js (dashboard)  js/landing.js (start page)  js/ai.js  js/ui.js  js/data.js  js/fx.js  js/radar.js
js/roster.js (targets, CSV parsing, database client)  js/datamodal.js (Manage data modal, shared)  js/gaps.js (gap math, cost/time estimate, mentor matching)
data/upskill.db (the database; created by server.py)
seed/demo_roster.json (demo employees + default levels: what "Reset to demo data" restores)  seed/demo_employees.csv (the same as a CSV)
Assets/ (demo photos; copied into the database)
```

## Demo guide
0. Start page: optionally import a CSV there (it stays on the page). Launch Dashboard. 1. Company skill radar, then the Competency heatmap (try Maximize) and gap bars; click a gap bar for **Why this gap?** (below-target employees, illustrative cost/time, who can mentor). 1b. Optional: open Manage data, raise a target or paste a CSV and watch every number update (Reset restores the demo). 2. Open Live Market Demand from the navbar and switch category chips. 3. Click Analyze with AI. 4. Click an employee row (e.g. Mavilon Coutino) to open their radar and generate a 4-week roadmap. 5. Export PDF (HR and Employee dashboards). Tick Mock mode if wifi dies. API quota plan: see CONTEXT.md, "API usage budget".

## Team & roles
TBD

## Limitations & future work
The 8 skills are fixed (CSV columns map to them; targets are editable, the skill list is not). Data lives in one SQLite file served by `server.py`: no accounts, no login and no multi-user permissions (anyone who can reach the server can edit), and photos are capped at 2 MB each. The cost / time estimate uses flat illustrative assumptions, not real course prices. Mentor matching is a simple rule (score 3+ and one level ahead, max 3 learners each). Imported employees get generic (not persona-specific) roadmaps. No auth; API keys are client-visible (fine for a hackathon, not production; move calls behind a server). Not yet tested against live APIs; market trends from non-Gemini providers are model knowledge, not web data. Next: editable skill list, server-side keys, login and per-team datasets.

## Screenshots / demo video
TBD

## CSV format (Manage data)
Header row, then one employee per row. Commas, semicolons or tabs all work; quoted fields are fine.
```
name,role,Cloud & DevOps,Data Engineering,GenAI & LLMs,Cybersecurity,Frontend,Backend & APIs,Product Thinking,Data Storytelling,target_role,description,yoe,stack,notes,photo
Ananya Rao,Platform Engineer,4,3,2,3,2,4,2,1,MLOps Cloud Architect,Builds cloud platforms,4,"Go, Terraform",Strong on infra,ananya.jpg
```
Scores are 0-5 (out-of-range values are clamped, blanks become 0, and the preview tells you). Skill columns may use the skill name or its short id (`cloud`, `data`, `genai`, `sec`, `web`, `api`, `prod`, `story`). `name` and the skill columns are the core; `role` is the job title. `target_role` is optional and must be one of the next-gen roles. Optional `description`, `yoe` (years of experience), `stack` and `notes` fill the employee profile (stack and notes also personalise the AI roadmap). `photo` is a file name or an image link: a file you upload with **Add photos** (matched by the name in this column, or by employee name if the column is empty), a file placed in the `Assets/` folder, or an `https://` link. Uploaded and `Assets/` photos are stored inside the database.
Two download buttons in Manage data: **Current roster CSV** (everything now in the database, in this format) and **Demo CSV** (the built-in demo employees; also shipped as `seed/demo_employees.csv`).
