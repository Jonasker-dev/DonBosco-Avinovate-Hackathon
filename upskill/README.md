# UpskillAI

Map workforce skills, forecast market tech demand, and generate AI learning tracks into next-gen roles.

## Problem statement & target user
Problem statement 4, Enterprise Upskill AI. HR and L&D teams are blind to upcoming skill gaps as industry tools change. Target user: L&D managers and HR business partners.

## Features
- Landing hero, then HR dashboard with company skill radar (required vs actual), click-through employee pathway modal, and Export PDF (print)
- Live Market Demand drawer with a category selector (8 categories) that flags skills matching the company's biggest gap as "Critical Company Gap & Market Surge": mock mode shows sample skills with descriptions; live mode asks Gemini with Google Search for that category
- Mock mode: three personas (Jonasker Fernandes, Mavilon Coutino, Schneider Gracious) get visibly different roadmaps
- Honest `[DEMO MODE ACTIVE]` badge whenever sample data is shown
- Two-sided UI: HR Dashboard and Employee Dashboard (tabs), light mode default with dark toggle
- Competency heatmap (8 employees x 8 skills) with target levels and computed gap bars
- Dashboard stats: workforce readiness, critical gaps, biggest gap
- "Analyze with AI": emerging tech forecast plus a 3-phase company training pathway
- Employee login, skill profile, and AI 4-week upskill roadmap
- Live Market Demand slide-in drawer (opens from the navbar, fetches on first open, live results cached 6 hours per category)
- Particle-network background, scroll reveal, count-up stats and hover motion (`js/fx.js  js/radar.js`)
- Mock mode toggle (on by default), toasts, loading states, results persisted in localStorage

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
2. Serve the folder (`python3 -m http.server 8000`) and open http://localhost:8000. Opening `index.html` directly also works.

## Project structure
```
index.html  config.js  config.example.js  CONTEXT.md  README.md  (yo.html API tester if you keep one locally)
pick_palette.py  palette.json
css/styles.css
js/main.js  js/ai.js  js/ui.js  js/data.js  js/fx.js  js/radar.js
```

## Demo guide
1. Show the heatmap and gap bars (seed data). 2. Open Live Market Demand from the navbar and switch category chips. 3. Click Analyze with AI. 4. Click an employee row (e.g. Mavilon Coutino) to open their radar and generate a 4-week roadmap. 5. Export PDF. Tick Mock mode if wifi dies. API quota plan: see CONTEXT.md, "API usage budget".

## Team & roles
TBD

## Limitations & future work
Seed data only (no import yet), no auth, API keys are client-visible (fine for a hackathon, not production; move calls behind a server). Not yet tested against live APIs; market trends from non-Gemini providers are model knowledge, not web data. Next: CSV import, editable targets.

## Screenshots / demo video
TBD
