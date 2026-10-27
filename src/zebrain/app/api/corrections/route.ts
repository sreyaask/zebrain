import { NextResponse } from "next/server";
import type { PendingCorrection } from "@/lib/job";
import { readRepoJson, writeRepoJson } from "@/lib/server/hf";
import { userCreds } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Saves a correction from Zebrain's own chat to corrections.json in the model's state repo, where the
// Fix page picks it up (the Kaggle chat page's "Teach it the right one" writes to the same file).
export async function POST(req: Request) {
  const { stateRepo, correction } = (await req.json()) as { stateRepo: string; correction: PendingCorrection };
  const account = await userCreds();
  if ("error" in account) return NextResponse.json({ error: account.error }, { status: account.status });
  const { hfToken } = account.creds;
  if (!/^[\w.-]+\/[\w.-]+-zebrain$/.test(stateRepo ?? "")) {
    return NextResponse.json({ error: "Connect Hugging Face and pick a Zebrain model." }, { status: 400 });
  }
  if (!correction?.question?.trim() || !correction.answer?.trim()) {
    return NextResponse.json({ error: "Write the answer it should have given." }, { status: 400 });
  }
  const pending = (await readRepoJson<PendingCorrection[]>(stateRepo, "corrections.json", hfToken)) ?? [];
  pending.push({ ...correction, question: correction.question.trim(), answer: correction.answer.trim(), t: Date.now() / 1000 });
  const ok = await writeRepoJson(stateRepo, "corrections.json", pending, hfToken, "correction from Zebrain chat");
  return ok
    ? NextResponse.json({ ok: true, waiting: pending.length })
    : NextResponse.json({ error: "Hugging Face didn't accept the save. Check your token has write access." }, { status: 502 });
}
