import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
// Kaggle's API as the official kaggle CLI/kagglesdk calls it: one POST per method, JSON bodies
// with camelCase fields. Legacy keys (kaggle.json) use Basic auth; new tokens (KGAT_...) use Bearer.

export type KaggleCreds = { username: string; key: string };

const BASE = "https://api.kaggle.com/v1/kernels.KernelsApiService/";

export class KaggleError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function auth(c: KaggleCreds) {
  return c.key.startsWith("KGAT_")
    ? `Bearer ${c.key}`
    : "Basic " + Buffer.from(`${c.username}:${c.key}`).toString("base64");
}

export async function kaggle<T>(creds: KaggleCreds, method: string, body: object = {}): Promise<T> {
  const res = await fetch(BASE + method, {
    method: "POST",
    headers: { Authorization: auth(creds), "Content-Type": "application/json", "User-Agent": "zebrain/0.1" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const d = JSON.parse(text);
      msg = d.error?.message ?? d.message ?? msg; // {"error":{"code":403,"message":"..."}} or {"message":"..."}
    } catch {}
    if (res.status === 401) msg = "Kaggle rejected the username or API key.";
    if (res.status === 403) msg = `Kaggle refused: ${msg}. Check the username matches the API key.`;
    throw new KaggleError(res.status, msg);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// Durations come back like "108000s" or "1234.5s".
export function seconds(d: unknown) {
  const n = typeof d === "string" ? parseFloat(d) : typeof d === "number" ? d : NaN;
  return Number.isFinite(n) ? n : null;
}

export type KernelStatus = "QUEUED" | "RUNNING" | "COMPLETE" | "ERROR" | "CANCEL_REQUESTED" | "CANCEL_ACKNOWLEDGED" | "NEW_SCRIPT";

export function splitRef(ref: string) {
  const [userName, kernelSlug] = ref.split("/");
  return { userName, kernelSlug };
}
