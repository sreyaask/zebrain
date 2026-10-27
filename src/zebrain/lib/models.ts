export type BaseModel = {
  id: string; // Hugging Face repo id
  name: string;
  org: string;
  size: string;
  goodFor: string;
  license: string;
  gated?: boolean; // needs "Agree and access" on the model page first
  t4Minutes: string; // rough estimate for ~6k examples, 1 epoch, on a free T4
};

// Open-source chat models that already hold a conversation well; training only teaches them the job. All are
// Apache 2.0 or MIT and need no access request. Up to 9B fit Kaggle's free T4 with QLoRA (8–9B ones serve in 4-bit);
// 14B trains only on Zebrain's GPUs (Pro Extreme).
export const BASE_MODELS: BaseModel[] = [
  {
    id: "Qwen/Qwen3.5-4B",
    name: "Qwen3.5 4B",
    org: "Qwen",
    size: "4B",
    goodFor: "Best all-rounder: chat, support, code, many languages",
    license: "Apache 2.0",
    t4Minutes: "60–100 min",
  },
  {
    id: "Qwen/Qwen3-4B-Instruct-2507",
    name: "Qwen3 4B Instruct",
    org: "Qwen",
    size: "4B",
    goodFor: "Short, direct answers: SQL, code, FAQs",
    license: "Apache 2.0",
    t4Minutes: "60–100 min",
  },
  {
    id: "microsoft/Phi-4-mini-instruct",
    name: "Phi-4 mini",
    org: "Microsoft",
    size: "3.8B",
    goodFor: "Maths, reasoning and step-by-step tutoring",
    license: "MIT",
    t4Minutes: "55–90 min",
  },
  {
    id: "google/gemma-4-E4B-it",
    name: "Gemma 4 E4B",
    org: "Google",
    size: "4B",
    goodFor: "Multilingual chat, Indian languages, tutoring",
    license: "Apache 2.0",
    t4Minutes: "80–130 min",
  },
  {
    id: "ibm-granite/granite-4.2-8b",
    name: "Granite 4.2 8B",
    org: "IBM",
    size: "8B",
    goodFor: "Business support bots that follow rules closely",
    license: "Apache 2.0",
    t4Minutes: "2.5–4 h",
  },
  {
    id: "Qwen/Qwen3.5-9B",
    name: "Qwen3.5 9B",
    org: "Qwen",
    size: "9B",
    goodFor: "Highest quality, slowest to train and answer",
    license: "Apache 2.0",
    t4Minutes: "3–4.5 h",
  },
  {
    id: "Qwen/Qwen3-14B",
    name: "Qwen3 14B",
    org: "Qwen",
    size: "14B",
    goodFor: "Hardest jobs: long answers, careful reasoning. Pro Extreme only",
    license: "Apache 2.0",
    t4Minutes: "Doesn't fit a free T4",
  },
];

export type Template = {
  id: string;
  name: string;
  blurb: string;
  model: string;
  purpose: string;
  description: string;
  searches: string[];
  datasets: string[];
};

// Dataset ids below are public Hugging Face datasets in common chat/instruction formats.
export const TEMPLATES: Template[] = [
  {
    id: "sql",
    name: "SQL assistant",
    blurb: "Plain English to SQL",
    model: "Qwen/Qwen3-4B-Instruct-2507",
    purpose: "SQL assistant",
    description:
      "Turn plain-English questions into correct SQL queries. Given a database schema and a question, reply with only the SQL query: no explanation, no extra text. Politely decline anything unrelated to SQL or databases.",
    searches: ["text to sql", "sql create context"],
    datasets: ["gretelai/synthetic_text_to_sql"],
  },
  {
    id: "coder",
    name: "Tailwind coder",
    blurb: "React, Next.js and Tailwind",
    model: "Qwen/Qwen3.5-4B",
    purpose: "Coding assistant",
    description:
      "A coding assistant for vibe coding Next.js apps. Writes clean React components with Tailwind CSS, explains errors briefly and gives complete code.",
    searches: ["code instruct", "python code instructions", "react"],
    datasets: ["m-a-p/CodeFeedback-Filtered-Instruction", "iamtarun/python_code_instructions_18k_alpaca"],
  },
  {
    id: "support",
    name: "Support bot",
    blurb: "Answers customer questions",
    model: "Qwen/Qwen3.5-4B",
    purpose: "Customer support",
    description:
      "A friendly support agent for an online store. Answers questions about orders, shipping and returns in short, clear replies.",
    searches: ["customer support", "customer service"],
    datasets: ["bitext/Bitext-customer-support-llm-chatbot-training-dataset"],
  },
  {
    id: "tutor",
    name: "Tutor",
    blurb: "Explains concepts step by step",
    model: "microsoft/Phi-4-mini-instruct",
    purpose: "Tutor",
    description:
      "A patient tutor that explains maths and science step by step, checks understanding and keeps answers simple.",
    searches: ["math word problems", "science qa"],
    datasets: ["openai/gsm8k"],
  },
  {
    id: "chat",
    name: "General assistant",
    blurb: "Helpful everyday chat",
    model: "Qwen/Qwen3.5-4B",
    purpose: "General assistant",
    description: "A helpful, concise general assistant.",
    searches: ["instruction tuning", "alpaca"],
    datasets: ["yahma/alpaca-cleaned"],
  },
];

export const PURPOSES = [
  { label: "Coding assistant", search: "code instruct" },
  { label: "SQL assistant", search: "text to sql" },
  { label: "Customer support", search: "customer support" },
  { label: "Tutor", search: "math word problems" },
  { label: "Writing", search: "writing prompts" },
  { label: "Research Q&A", search: "question answering" },
  { label: "General assistant", search: "instruction tuning" },
];
