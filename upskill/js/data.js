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
  { id: 1, name: "Aarav Naik", role: "Backend Developer", s: [3,2,1,2,2,4,2,1] },
  { id: 2, name: "Meera Fernandes", role: "Data Analyst", s: [1,3,2,1,1,2,3,4] },
  { id: 3, name: "Rohan D'Souza", role: "DevOps Engineer", s: [4,2,1,3,1,3,1,1] },
  { id: 4, name: "Sana Shaikh", role: "Frontend Developer", s: [1,1,2,1,4,2,3,2] },
  { id: 5, name: "Karan Prabhu", role: "QA Engineer", s: [2,1,1,2,2,2,2,1] },
  { id: 6, name: "Isha Kamat", role: "Product Manager", s: [1,2,2,1,1,1,4,3] },
  { id: 7, name: "Vikram Gaonkar", role: "Security Analyst", s: [2,1,1,4,1,2,1,1] },
  { id: 8, name: "Tara Pinto", role: "ML Engineer", s: [2,4,4,2,1,3,2,2] },
];
export const NEXT_GEN_ROLES = ["AI Engineer", "Platform Engineer", "Data Product Manager", "AI Security Specialist", "AI Workflow Automation Specialist"];

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
  trends: [
    { skill: "AI Agent Development", demand: "Hot", reason: "Companies are building autonomous AI agents to automate complex workflows, driving massive demand for developers who can orchestrate LLM-powered pipelines." },
    { skill: "Cloud Security & Zero Trust", demand: "Rising", reason: "With growing cloud adoption and AI integration, enterprises urgently need professionals skilled in zero-trust architectures and AI-specific security." },
    { skill: "Rust for Systems Programming", demand: "Emerging", reason: "Rust is increasingly adopted for high-performance, memory-safe systems including AI inference engines and cloud-native infrastructure." },
  ],
};
