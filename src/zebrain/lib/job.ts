// What the wizard and the fix page send to /api/runs. The server adds the run id and tokens,
// and the training job (lib/zebrain_train.py) reads the result as CONFIG.

export type TrainConfig = {
  mode: "train";
  base_model: string;
  model_name: string; // repo name, e.g. "text2sql-1.5b"
  purpose: string;
  description: string;
  datasets: string[];
  max_rows_per_dataset: number;
  epochs: number;
  max_len: number;
  private: boolean;
  make_space: boolean;
  identity: { name: string; maker: string; founder: string };
  system_prompt: string;
  chat_hours?: number; // open a chat on Kaggle right after publishing
  publish_now?: boolean; // restart of a stopped run: finish the current round, test once, publish without extra rounds
  resume_from?: { round: string; step: number; rev: string }; // a saved checkpoint the user picked, by commit
  eval_set?: EvalItem[]; // AI-written test questions with ideal answers
  plan?: "trial" | "basic" | "standard" | "extreme"; // basic = free on Kaggle, no testing; standard/extreme = paid Pro
  order_id?: string; // the paid order a Pro run uses
  documents?: string[]; // uploaded documents (storage paths) Qwen builds the dataset from
  skip_tests?: boolean; // set by the server for Basic
  max_hours?: number; // set by the server for runs on Zebrain's GPUs: the job stops itself after this long
  selection?: { spec: unknown; pick: string | null; explanation: string; registryVersion: string }; // why this base model
  blueprint?: { // Qwen's plan for the dataset (topics to cover, what to refuse, tone and format notes)
    version: string; topics: { topic: string; cover: string }[]; refuse: string[]; sensitive: boolean; dataset_notes: string; languages: string[];
  };
  qwen?: QwenJob; // set by the server: how the job reaches Zebrain's Qwen gateway
};

// The job never sees the Qwen key: it calls Zebrain's gateway with a short-lived run token tied to the model's budget.
export type QwenJob = {
  gateway: string; // https://<zebrain>/api/qwen
  token: string;
  use_case: string;
  examples: number; // kept examples to aim for
  strict: boolean; // Extreme: stricter judge, more question types
  documents: { name: string; url: string }[]; // short-lived download links
  search: boolean; // no documents: research the topics on the web
};

export type EvalItem = { question: string; answer: string; difficulty?: string };

export type Correction = { question: string; got?: string; answer: string };

export type FixConfig = {
  mode: "fix";
  base_model: string;
  model_name: string;
  from_version?: number;
  corrections: Correction[];
  identity?: { name: string; maker: string; founder: string }; // set to rename the model
  chat_hours?: number;
  qwen?: QwenJob; // set by the server: a small Zebrain AI budget for this run
};

// Opens a chat (and /ask API) for one version on the user's Kaggle GPU for a few hours.
export type ServeConfig = {
  mode: "serve";
  base_model: string;
  model_name: string;
  tag?: string;
  hours: number;
};

// "Testify": Zebrain AI grades a version, writes practice for its weak topics, and it's published only if better.
export type ImproveConfig = {
  mode: "improve";
  base_model: string;
  model_name: string;
  from_version?: number;
  rounds?: number;
  chat_hours?: number;
  qwen?: QwenJob; // set by the server: a small Zebrain AI budget for this run
};

export type JobConfig = TrainConfig | FixConfig | ServeConfig | ImproveConfig;

// chat.json in a model's state repo, written by the job while a chat is open.
export type ChatInfo = { url: string; api_key: string; tag: string; model: string; until: number; run_id: string; page?: string | null; gradio?: string; closed?: boolean };
export type PendingCorrection = { question: string; got?: string; answer: string; version?: string; t?: number };

// Kaggle slugs: lowercase letters, digits and dashes, 5–50 characters.
export function kernelSlug(modelName: string, mode: JobConfig["mode"]) {
  const base = `zebrain-${modelName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = mode === "fix" ? "-fix" : mode === "serve" ? "-chat" : mode === "improve" ? "-improve" : "";
  return base.slice(0, 50 - suffix.length).replace(/-+$/, "") + suffix;
}

export const stateRepoFor = (hfUser: string, modelName: string) => `${hfUser}/${modelName}-zebrain`;

// One published version of a model, from versions.json in its state repo.
export type Version = {
  version: number;
  tag: string;
  created_at: number;
  scores: Record<string, number | null>;
  base_scores: Record<string, number | null>;
  notes: string;
  mode: "train" | "fix";
};
