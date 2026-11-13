# UpskillAI

Map workforce skills, forecast market tech demand, and generate AI learning tracks into next-gen roles.

## Problem statement & target user
Problem statement 4, Enterprise Upskill AI. HR and L&D teams are blind to upcoming skill gaps as industry tools change. Target user: L&D managers and HR business partners.

## Features
- Competency heatmap (8 employees x 8 skills) with target levels and computed gap bars
- Dashboard stats: workforce readiness, critical gaps, biggest gap
- "Analyze with AI": emerging tech forecast plus a 3-phase company training pathway
- "Build track": 12-week personalized learning track for any employee and target role
- Mock mode toggle, toasts, loading states, results persisted in localStorage

## How the AI is used
`js/ai.js` calls Gemini first (model list fetched via ListModels, newest flash first), then Groq, then the Meta Model API, then canned mock data. Every call requests JSON.
- Insights shape: `{summary, emerging:[{tech,horizon,impact,why}], pathway:[{phase,actions[]}]}`
- Track shape: `{headline, strengths[], steps:[{week,title,resources[],outcome}]}`
Gap numbers are computed locally; the AI never invents them.

## Tech stack
Semantic HTML5, vanilla CSS variables, modular vanilla JS, Gemini / Groq / Meta APIs. No low-code/no-code platform was used.

## Setup & run
1. Copy `config.example.js` to `config.js` and add keys (already present locally, gitignored).
2. Serve the folder (`python3 -m http.server 8000`) and open http://localhost:8000. Opening `index.html` directly also works.

## Project structure
```
index.html  config.js  config.example.js  CONTEXT.md  README.md  yo.html (API tester)
pick_palette.py  palette.json
css/styles.css
js/main.js  js/ai.js  js/ui.js  js/data.js
```

## Demo guide
1. Show the heatmap and gap bars (seed data). 2. Click Analyze with AI. 3. Pick Aarav Naik + AI Engineer, click Build track. Tick Mock mode if wifi dies.

## Team & roles
TBD

## Limitations & future work
Seed data only (no import yet), no auth, API keys are client-visible (fine for a hackathon, not production; move calls behind a server). Not yet tested against live APIs. Next: CSV import, editable targets, PDF export.

## Screenshots / demo video
TBD
