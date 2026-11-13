// Seed/demo data + mock AI responses. Gap = target level - team average (computed locally, not by AI).
export const SKILLS = [
  { id: "cloud", name: "Cloud & DevOps", target: 4 },
  { id: "data", name: "Data Engineering", target: 4 },
  { id: "genai", name: "GenAI & LLMs", target: 4 },
  { id: "sec", name: "Cybersecurity", target: 4 },
  { id: "web", name: "Frontend", target: 3 },
  { id: "api", name: "Backend & APIs", target: 4 },
  { id: "prod", name: "Product Thinking", target: 3 },
  { id: "story", name: "Data Storytelling", target: 3 },
];
export const EMPLOYEES = [
  { id: 1, name: "Jonasker Fernandes", role: "Junior Developer", s: [1,1,1,1,2,1,1,1], yoe: 1, stack: "C, C++, basic HTML/CSS", notes: "Fast learner with a strong logical foundation. Needs to move from academic C++ to building full-stack web apps and AI APIs.", target: "AI Automation Engineer", photo: "assets/Jonasker Fernandes.jpeg", desc: "Strong C/C++ foundation, beginning web development journey" },
  { id: 2, name: "Meera Fernandes", role: "Data Analyst", s: [1,3,2,1,1,2,3,4], yoe: 2, desc: "Data storytelling expert with solid analytics and visualization skills", photo: "assets/Meera.jpeg" },
  { id: 3, name: "Mavilon Coutino", role: "Systems Administrator", s: [2,1,1,4,1,3,1,1], yoe: 5, stack: "Linux, Bash, network security", notes: "Deep hardware and OS knowledge. The company needs him to pivot into cloud infrastructure and deploying scalable AI models securely.", target: "MLOps Cloud Architect", photo: "assets/Mavilon.jpeg", desc: "Seasoned sysadmin with deep Linux and network security expertise" },
  { id: 4, name: "Schneider Gracious", role: "Frontend Engineer", s: [1,1,2,1,4,2,3,2], yoe: 3, stack: "React, JavaScript, Tailwind", notes: "Excellent UI/UX skills. Needs backend database architecture and how to connect frontends to LLM streaming endpoints.", target: "Full-Stack AI Developer", photo: "assets/Schneider.jpeg", desc: "Skilled frontend developer proficient in React and modern CSS" },
  { id: 5, name: "Karan Prabhu", role: "QA Engineer", s: [2,1,1,2,2,2,2,1], yoe: 2, desc: "Detail-oriented QA specialist with cloud and backend testing skills", photo: "assets/Karan.jpeg" },
  { id: 6, name: "Isha Kamat", role: "Product Manager", s: [1,2,2,1,1,1,4,3], yoe: 4, desc: "Strategic product thinker with strong data storytelling ability", photo: "assets/isha.jpeg" },
  { id: 7, name: "Vikram Gaonkar", role: "Security Analyst", s: [2,1,1,4,1,2,1,1], yoe: 3, desc: "Cybersecurity specialist focused on network defense and threat analysis", photo: "assets/Vikram.jpeg" },
  { id: 8, name: "Dean Dsilva", role: "ML Engineer", s: [2,4,4,2,1,3,2,2], yoe: 4, desc: "ML engineer with strong data engineering and GenAI experience", photo: "assets/Dean Dsilva.jpeg" },
];
export const NEXT_GEN_ROLES = ["AI Engineer", "Platform Engineer", "Data Product Manager", "AI Security Specialist", "AI Workflow Automation Specialist", "AI Automation Engineer", "Full-Stack AI Developer", "MLOps Cloud Architect"];

export const MOCK = {
  insights: {
    summary: "GenAI, cloud-native security and data platforms will drive hiring demand over the next 18 months.",
    emerging: [
      { tech: "Agentic AI workflows", horizon: "0-6 months", impact: "high", why: "Teams are automating multi-step processes with LLM agents." },
      { tech: "Platform engineering", horizon: "6-12 months", impact: "high", why: "Internal developer platforms replace ad-hoc DevOps." },
      { tech: "AI governance & security", horizon: "6-12 months", impact: "medium", why: "Regulation and prompt-injection risk need dedicated skills." },
    ],
    pathway: [
      { phase: "Phase 1 · Foundations (Month 1-2)", actions: ["GenAI literacy for all roles", "Cloud security basics workshop"] },
      { phase: "Phase 2 · Applied (Month 3-4)", actions: ["Pair backend + data staff on an LLM feature", "Platform engineering bootcamp for DevOps"] },
      { phase: "Phase 3 · Specialize (Month 5-6)", actions: ["AI security certification track", "Internal showcase and skill re-assessment"] },
    ],
  },
  track: {
    headline: "A 12-week path from current strengths to the target role.",
    strengths: ["Existing core skill transfers directly", "Strong foundation to build on"],
    steps: [
      { week: "Weeks 1-3", title: "Close the biggest gap", resources: ["Hands-on lab: LLM APIs", "Short course: prompt engineering"], outcome: "Ship a small working prototype" },
      { week: "Weeks 4-8", title: "Apply on a real task", resources: ["Pair with a senior mentor", "Build an internal tool"], outcome: "Demonstrate skill in production-like work" },
      { week: "Weeks 9-12", title: "Certify and showcase", resources: ["Assessment quiz", "Demo day talk"], outcome: "Re-assessed level +1 or higher" },
    ],
  },
  roadmap: [
    { week: 1, topic: "Foundations of AI & Prompt Engineering", action_item: "Complete Google's Introduction to Generative AI course and build 5 different prompts for common work tasks using the Gemini API playground." },
    { week: 2, topic: "AI Workflow Tools & Automation Basics", action_item: "Set up an AI automation pipeline using n8n or Zapier that connects to a Gemini endpoint, processes input data, and outputs structured results." },
    { week: 3, topic: "Building AI-Powered Applications", action_item: "Build a small web app that takes user input, sends it to the Gemini API with a JSON schema, and renders the structured AI response as UI cards." },
    { week: 4, topic: "Agentic Workflows & Production Deployment", action_item: "Design and implement a multi-step AI agent workflow that chains 3+ API calls, handles errors gracefully, and present the project to your team." },
  ],
};

// ---- Mock market feed (SAMPLE DATA: numbers are illustrative, shown with the DEMO badge). Each skill has a desc shown in the drawer. ----
export const MOCK_MARKET_TRENDS = [
  { category: "AI & Automation", skills: [
    { name: "Agentic Workflows (n8n, LangChain)", desc: "Teams are replacing manual multi-step tasks with LLM agents that call tools and APIs. Demand is highest in operations, support and internal tooling roles.", surge: "+214%", urgency: "Critical" },
    { name: "Local LLM Deployment (Ollama)", desc: "Running open models on company hardware keeps sensitive data in-house and cuts API bills. Valued wherever privacy rules block cloud AI.", surge: "+145%", urgency: "High" },
    { name: "Prompt Architecture", desc: "Designing reusable, testable prompt chains instead of one-off prompts. Now expected from anyone shipping an LLM feature.", surge: "+90%", urgency: "Moderate" }] },
  { category: "Cloud & Backend", skills: [
    { name: "Serverless Vector Databases", desc: "Managed vector stores that scale to zero power semantic search and RAG with no servers to run. A common ask in AI product backends.", surge: "+180%", urgency: "Critical" },
    { name: "Go (Golang) Microservices", desc: "Go's small binaries and fast concurrency make it the pick for high-throughput APIs and cloud tooling. Backend job posts increasingly list it.", surge: "+110%", urgency: "High" },
    { name: "PostgreSQL pgvector", desc: "Adds vector search to the Postgres teams already run, so RAG needs no new database. A cheap upskill for existing backend staff.", surge: "+95%", urgency: "High" }] },
  { category: "Frontend & Edge", skills: [
    { name: "WebAssembly (Wasm)", desc: "Runs near-native code in the browser and at the edge, enabling heavy apps like editors and on-device inference. Niche but growing quickly.", surge: "+130%", urgency: "Moderate" },
    { name: "Edge AI Computing", desc: "Running models on devices or edge nodes for low latency and offline use. Needed in retail, manufacturing and mobile products.", surge: "+105%", urgency: "High" },
    { name: "React Server Components", desc: "Moves rendering and data fetching to the server so less JavaScript ships to the browser. Now the default in modern React frameworks.", surge: "+75%", urgency: "Moderate" }] },
  { category: "Cybersecurity", skills: [
    { name: "AI Red Teaming & Prompt-Injection Defense", desc: "Stress-testing LLM apps for jailbreaks, data leaks and injected instructions. Every company shipping AI needs someone who can do this.", surge: "+160%", urgency: "Critical" },
    { name: "Zero Trust Architecture", desc: "Verify every user and device on every request instead of trusting the network perimeter. Driven by remote work and compliance audits.", surge: "+120%", urgency: "High" },
    { name: "Software Supply-Chain Security (SBOM)", desc: "Tracking every dependency inside shipped software so vulnerable components can be found fast. Increasingly demanded by enterprise buyers and regulators.", surge: "+85%", urgency: "Moderate" }] },
  { category: "Data & Analytics", skills: [
    { name: "Data Lakehouse (Iceberg, Delta Lake)", desc: "One open-format store for both analytics and ML, replacing a separate warehouse and lake. Cuts duplication and cost at scale.", surge: "+140%", urgency: "High" },
    { name: "Real-time Streaming (Kafka, Flink)", desc: "Processing events as they arrive for fraud checks, live dashboards and personalisation. Moves teams beyond nightly batch jobs.", surge: "+125%", urgency: "High" },
    { name: "dbt & Analytics Engineering", desc: "Treats data transformations as tested, version-controlled code. The usual route for analysts becoming analytics engineers.", surge: "+80%", urgency: "Moderate" }] },
  { category: "Platform & DevOps", skills: [
    { name: "Platform Engineering (Backstage)", desc: "Internal developer platforms give teams self-service environments and standard paths to production. Replaces ad-hoc DevOps tickets.", surge: "+170%", urgency: "Critical" },
    { name: "FinOps & Cloud Cost Optimisation", desc: "Tracking and cutting cloud spend by team and workload. A top CFO concern now that AI workloads inflate bills.", surge: "+115%", urgency: "High" },
    { name: "eBPF Observability", desc: "Kernel-level tracing that shows system behaviour with almost no overhead or code changes. Prized for debugging production at scale.", surge: "+70%", urgency: "Moderate" }] },
  { category: "MLOps & Model Ops", skills: [
    { name: "LLM Evaluation & Observability", desc: "Measuring answer quality, cost and drift of LLM features in production. Without it teams cannot tell whether a model update broke something.", surge: "+190%", urgency: "Critical" },
    { name: "RAG Pipeline Engineering", desc: "Chunking, embedding, retrieving and citing company documents so LLMs answer from trusted sources. The most common enterprise GenAI build.", surge: "+155%", urgency: "Critical" },
    { name: "Fine-tuning (LoRA / QLoRA)", desc: "Adapting open models to a company's domain at a fraction of full training cost. Useful when prompting alone is not accurate enough.", surge: "+100%", urgency: "High" }] },
  { category: "Governance & Product", skills: [
    { name: "AI Governance & Compliance", desc: "Policies, audits and documentation to meet rules like the EU AI Act. Legal and risk teams now need technical fluency.", surge: "+135%", urgency: "High" },
    { name: "AI Product Management", desc: "Scoping AI features around data, evaluation and failure modes, not just UI. A scarce skill for PMs moving into AI teams.", surge: "+110%", urgency: "High" },
    { name: "Responsible AI & Model Risk", desc: "Testing for bias, safety and misuse before launch, then monitoring after. Banks and healthcare lead the hiring here.", surge: "+85%", urgency: "Moderate" }] },
];
// Which market skills count as addressing a company skill gap (keyword match on the skill NAME only, so loose descriptions never trigger a flag).
// Deterministic on purpose: the same flag shows in mock and live mode, and the AI never decides it.
export const GAP_KEYWORDS = {
  cloud: /cloud|devops|platform|kubernetes|serverless|finops|ebpf|terraform|infrastructure/i,
  data: /lakehouse|streaming|kafka|dbt|analytics engineering|data pipeline|data platform/i,
  genai: /llm|genai|generative|prompt|agent|\brag\b|fine-tun/i,
  sec: /secur|zero trust|red team|sbom|supply-chain|threat/i,
  web: /frontend|react|wasm|webassembly|browser/i,
  api: /\bapis?\b|backend|microservice|golang|postgres|database/i,
  prod: /product|governance|compliance|responsible/i,
  story: /storytelling|visuali[sz]ation|dashboard/i,
};
export const matchesGap = (t, gapId) => !!GAP_KEYWORDS[gapId]?.test(t.skill || t.name || "");

// Category list for the drawer's selector, and the mock block for the chosen category
export const MARKET_CATEGORIES = MOCK_MARKET_TRENDS.map((c) => c.category);
export function mockTrends(category) {
  const hit = MOCK_MARKET_TRENDS.find((c) => c.category === category) || MOCK_MARKET_TRENDS[0];
  return structuredClone(hit);
}

// Per-persona mock roadmaps so mock mode still shows a *different* path for each person
MOCK.roadmap_1 = [
  { week: 1, topic: "From C++ to the Web: JavaScript & Async", action_item: "Port one of your C++ command-line programs to Node.js, then add a fetch() call to a public API and print the JSON. Focus on async/await." },
  { week: 2, topic: "Your First Full-Stack App", action_item: "Build a small Express + HTML/CSS form app that saves entries to SQLite, and deploy it on a free host." },
  { week: 3, topic: "LLM APIs & Structured Output", action_item: "Call the Gemini API from your backend with a JSON schema, validate the response, and add retry on 429/503 errors." },
  { week: 4, topic: "AI Automation Workflows", action_item: "Build an n8n flow: webhook -> LLM classification -> Slack/Sheets. Demo it to your manager with one real company use case." },
];
MOCK.roadmap_3 = [
  { week: 1, topic: "Cloud Foundations on Top of Linux Skills", action_item: "Map your on-prem knowledge to VPCs, IAM and VMs on one cloud, then provision a small network and server with Terraform." },
  { week: 2, topic: "Containers & Kubernetes", action_item: "Containerise a small model-serving API with Docker and deploy it to a managed Kubernetes cluster using a Helm chart." },
  { week: 3, topic: "Serving AI Models Securely", action_item: "Run an open model behind an authenticated gateway with secrets management, network policies and image vulnerability scanning." },
  { week: 4, topic: "CI/CD, Monitoring & Cost", action_item: "Add a GitHub Actions pipeline, Prometheus/Grafana dashboards for latency and cost, and write a short runbook for the team." },
];
MOCK.roadmap_4 = [
  { week: 1, topic: "Backend & Database Foundations", action_item: "Build a REST API in Node/Express with PostgreSQL. Model users and conversations, and connect your existing React app to it." },
  { week: 2, topic: "LLM Streaming Endpoints", action_item: "Implement server-sent events so your React UI renders model output token by token, with abort and error states." },
  { week: 3, topic: "Retrieval with pgvector", action_item: "Embed a set of company docs, store vectors in pgvector, and add retrieval so answers cite their sources." },
  { week: 4, topic: "Ship It: Auth, Limits & Deploy", action_item: "Add login, rate limiting and logging, deploy the full-stack app, and present a live demo to your team." },
];

// Mock AI-estimated required levels (used when "AI: Estimate Required Levels" is clicked in mock mode)
MOCK.aiTargets = [5, 5, 5, 4, 3, 4, 3, 4]; // cloud, data, genai, sec, web, api, prod, story

// Mock AI cost/time estimates per skill (used when "AI: Estimate Cost & Time" is clicked in mock mode)
MOCK.costTime = {
  cloud: { cost: 18400, time: "14 weeks", reasoning: "Most employees are 2-3 levels below target. Recommend cloud certification bootcamp." },
  data:  { cost: 12200, time: "10 weeks", reasoning: "Mixed proficiency; Dean and Meera can mentor others. Focus on hands-on data pipeline projects." },
  genai: { cost: 22000, time: "16 weeks", reasoning: "Largest gap company-wide. Phased rollout: GenAI literacy first, then applied LLM projects." },
  sec:   { cost: 5600,  time: "6 weeks",  reasoning: "Vikram and Mavilon anchor the team. Short workshops fill the remaining gaps." },
  web:   { cost: 3200,  time: "4 weeks",  reasoning: "Schneider leads; others need only a refresher. Pair programming recommended." },
  api:   { cost: 9600,  time: "10 weeks", reasoning: "Moderate gap. Backend bootcamp with API design patterns and database architecture." },
  prod:  { cost: 4800,  time: "6 weeks",  reasoning: "Isha and Schneider already strong. Targeted product-thinking workshops for engineers." },
  story: { cost: 6400,  time: "8 weeks",  reasoning: "Meera excels here. Data storytelling masterclass with real company dashboards." },
};

// Mock market trends used when "Live Market Demand" toggle is OFF (premade data)
MOCK.premadeMarketTrends = [
  { name: "Agentic AI Workflows", surge: "+214%", urgency: "Critical", desc: "Multi-step LLM agents automating operations, support and internal tooling." },
  { name: "RAG Pipeline Engineering", surge: "+155%", urgency: "Critical", desc: "Enterprise GenAI's most common build: chunking, embedding and retrieval from company docs." },
  { name: "Platform Engineering", surge: "+170%", urgency: "Critical", desc: "Internal developer platforms replacing ad-hoc DevOps with self-service environments." },
];
