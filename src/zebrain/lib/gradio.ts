// Talks to a model's live chat from the browser with Gradio's own JS client, loaded from a CDN so the
// version matches the server: Gradio 6 needs the 2.x client, Gradio 4/5 the 1.x client.

const CLIENTS = {
  1: "https://cdn.jsdelivr.net/npm/@gradio/client@1.5.2/dist/index.min.js",
  2: "https://cdn.jsdelivr.net/npm/@gradio/client@2.7.1/dist/browser.js",
};

export type GradioMessage =
  | { type: "data"; data: unknown[] }
  | { type: "status"; stage: "pending" | "generating" | "complete" | "error"; message?: string };

type GradioClient = {
  predict: (endpoint: string, data: Record<string, unknown>) => Promise<{ data: unknown[] }>;
  submit: (endpoint: string, data: Record<string, unknown>) => AsyncIterable<GradioMessage>;
};

// Streams a reply: calls onText with the reply so far each time a new piece arrives, and resolves with the
// whole reply. The first words show within a second instead of after the model has written everything.
export async function streamReply(client: GradioClient, endpoint: string, data: Record<string, unknown>, onText: (t: string) => void) {
  let text = "";
  for await (const msg of client.submit(endpoint, data)) {
    if (msg.type === "data") onText((text = String(msg.data[0] ?? "")));
    else if (msg.stage === "error") throw new Error(msg.message || "The model returned an error.");
    else if (msg.stage === "complete") break;
  }
  return text;
}

export async function connect(url: string, gradioVersion?: string): Promise<GradioClient> {
  const major = parseInt((gradioVersion ?? "4").split(".")[0], 10);
  const mod = await import(/* webpackIgnore: true */ CLIENTS[major >= 6 ? 2 : 1]);
  return mod.Client.connect(url);
}
