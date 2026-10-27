import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
// The few Hugging Face Hub calls the server makes with the user's token.

const HF = "https://huggingface.co";
const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function whoami(token: string) {
  const res = await fetch(`${HF}/api/whoami-v2`, { headers: headers(token), cache: "no-store" });
  if (!res.ok) return null;
  const d = await res.json();
  const role: string | undefined = d?.auth?.accessToken?.role;
  return { name: d.name as string, canWrite: role === "write" || role === "fineGrained", role };
}

// "ok", "gated" (needs the user to accept terms), or "missing".
export async function modelAccess(id: string, token: string) {
  const res = await fetch(`${HF}/${id}/resolve/main/config.json`, { method: "HEAD", headers: headers(token), cache: "no-store", redirect: "manual" });
  if (res.ok || (res.status >= 300 && res.status < 400)) return "ok";
  if (res.status === 401 || res.status === 403) return "gated";
  return "missing";
}

export async function readRepoJson<T>(repo: string, path: string, token: string): Promise<T | null> {
  const res = await fetch(`${HF}/${repo}/resolve/main/${path}`, { headers: headers(token), cache: "no-store" });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function spaceExists(space: string, token: string) {
  const res = await fetch(`${HF}/api/spaces/${space}`, { headers: headers(token), cache: "no-store" });
  return res.ok;
}

// Writes one small JSON file to a repo in a single commit (Hugging Face's commit API, NDJSON body).
export async function writeRepoJson(repo: string, path: string, data: unknown, token: string, summary: string, repoType: "model" | "space" = "model") {
  const content = Buffer.from(JSON.stringify(data, null, 1)).toString("base64");
  const body = [
    { key: "header", value: { summary, description: "" } },
    { key: "file", value: { content, path, encoding: "base64" } },
  ].map((l) => JSON.stringify(l)).join("\n");
  const res = await fetch(`${HF}/api/${repoType}s/${repo}/commit/main`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/x-ndjson" },
    body,
  });
  return res.ok;
}

export type Checkpoint = { round: string; step: number; maxSteps: number | null; runId: string | null; rev: string; date: string };

// Every training checkpoint the job ever uploaded ("round1 checkpoint 301" commits). A later upload replaces the
// files on main, but each one stays in the repo's history, so older, further-along checkpoints can still be used.
export async function listCheckpoints(repo: string, token: string): Promise<Checkpoint[]> {
  const commits: { id: string; title: string; date: string }[] = [];
  for (let p = 0; p < 20; p++) {
    const res = await fetch(`${HF}/api/models/${repo}/commits/main?p=${p}`, { headers: headers(token), cache: "no-store" });
    if (!res.ok) break;
    const page = (await res.json()) as { id: string; title: string; date: string }[];
    if (!Array.isArray(page) || page.length === 0) break;
    commits.push(...page);
  }
  const found = commits.flatMap((c) => {
    const m = /^(round\d+) checkpoint (\d+)$/.exec((c.title ?? "").trim());
    return m ? [{ round: m[1], step: Number(m[2]), rev: c.id, date: c.date }] : [];
  });
  // The furthest few per round are the useful ones; read their run id and total steps.
  const best = found
    .sort((a, b) => a.round.localeCompare(b.round) || b.step - a.step)
    .filter((c, i, all) => all.slice(0, i).filter((o) => o.round === c.round).length < 5);
  return Promise.all(best.map(async (c) => {
    const dir = `${HF}/${repo}/resolve/${c.rev}/checkpoints/${c.round}`;
    const [state, meta] = await Promise.all([
      fetch(`${dir}/trainer_state.json`, { headers: headers(token), cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${dir}/zebrain_run.json`, { headers: headers(token), cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    return { ...c, maxSteps: state?.max_steps ?? null, runId: meta?.run_id ?? null };
  }));
}
