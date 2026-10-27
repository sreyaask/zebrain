// The training job's row reader (lib/zebrain_train.py: to_messages / guess_columns), ported so the wizard can check
// a dataset BEFORE a GPU starts. Keep the two in step: same chat keys, column pairs and name hints.

type Msg = { role: "system" | "user" | "assistant"; content: string };
type Row = Record<string, unknown>;

const ROLE: Record<string, Msg["role"]> = { human: "user", user: "user", gpt: "assistant", assistant: "assistant", bot: "assistant", model: "assistant", system: "system" };
const PAIRS: [string, string][] = [["instruction", "output"], ["instruction", "response"], ["query", "answer"], ["query", "response"], ["prompt", "response"],
  ["prompt", "completion"], ["question", "answer"], ["problem", "solution"], ["input", "output"]];
const Q_HINTS = ["prompt", "question", "instruction", "query", "problem", "task", "request"];
const A_HINTS = ["response", "answer", "output", "completion", "solution", "sql", "code", "target", "reply"];
const C_HINTS = ["context", "schema", "input"];
const SKIP = ["description", "explanation", "complexity", "type", "domain", "id", "category", "source", "lang"];
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function toMessages(ex: Row): Msg[] | null {
  for (const key of ["messages", "conversations", "conversation", "chat"]) {
    const v = ex[key];
    if (Array.isArray(v) && v.length && v[0] && typeof v[0] === "object") {
      const out: Msg[] = [];
      for (const m of v as Row[]) {
        const role = ROLE[String(m.role ?? m.from ?? "").toLowerCase()];
        const content = str(m.content) ?? str(m.value) ?? str(m.text);
        if (role && content) out.push({ role, content });
      }
      while (out.length && out[out.length - 1].role !== "assistant") out.pop();
      if (out.length && out.some((m) => m.role === "user")) return out;
    }
  }
  for (const [q, a] of PAIRS) {
    const qv = str(ex[q]), av = str(ex[a]);
    if (qv && av) {
      const extra = q === "instruction" ? str(ex.input) : null;
      return [{ role: "user", content: extra ? `${qv}\n\n${extra}` : qv }, { role: "assistant", content: av }];
    }
  }
  return guessColumns(ex);
}

function guessColumns(ex: Row): Msg[] | null {
  const names = Object.keys(ex).filter((k) => str(ex[k]));
  const find = (hints: string[], exclude: (string | null)[] = []) => {
    for (const exact of [true, false]) for (const h of hints) for (const k of names) {
      const n = k.toLowerCase();
      if (exclude.includes(k) || SKIP.some((s) => n.includes(s))) continue;
      if ((exact && (n === h || n.endsWith("_" + h))) || (!exact && n.includes(h))) return k;
    }
    return null;
  };
  const q = find(Q_HINTS), a = find(A_HINTS, [q]);
  if (!q || !a) return null;
  const c = find(C_HINTS, [q, a]);
  return [{ role: "user", content: c ? `${str(ex[q])}\n\nContext:\n${str(ex[c])}` : str(ex[q])! }, { role: "assistant", content: str(ex[a])! }];
}

export type DatasetCheck = { id: string; ok: boolean; usable: number; scanned: number; columns: string[]; problem?: string; sample?: Msg[] };

// How a sample of rows reads: how many become training examples, and what's wrong if none do.
export function checkRows(id: string, rows: Row[]): DatasetCheck {
  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 12) : [];
  const parsed = rows.map(toMessages);
  const usable = parsed.filter(Boolean).length;
  return {
    id, ok: usable > 0, usable, scanned: rows.length, columns, sample: parsed.find(Boolean) ?? undefined,
    problem: rows.length === 0 ? "No rows could be read." : usable === 0 ? `No question/answer columns found. Columns are: ${columns.join(", ")}.` : undefined,
  };
}
