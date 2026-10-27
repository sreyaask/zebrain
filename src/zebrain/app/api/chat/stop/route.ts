import { NextResponse } from "next/server";
import type { ChatInfo } from "@/lib/job";
import { readRepoJson, writeRepoJson } from "@/lib/server/hf";
import { userCreds } from "@/lib/supabase/server";

export const runtime = "nodejs";

// "Turn offline": tells the running Kaggle job to stop (it checks control.json every 30 seconds, then shuts the
// chat and API down and exits, freeing the GPU), and marks the chat closed right away for the dashboard and the
// public chat page. Kaggle's API has no reliable way to cancel a running session from outside.
export async function POST(req: Request) {
  const { stateRepo } = await req.json();
  const account = await userCreds();
  if ("error" in account) return NextResponse.json({ error: account.error }, { status: account.status });
  const { hfToken } = account.creds;
  if (!/^[\w.-]+\/[\w.-]+-zebrain$/.test(stateRepo ?? "")) {
    return NextResponse.json({ error: "Connect Hugging Face and pick a Zebrain model." }, { status: 400 });
  }
  const chat = await readRepoJson<ChatInfo>(stateRepo, "chat.json", hfToken);
  if (!chat || chat.closed) return NextResponse.json({ ok: true, alreadyOffline: true });

  const now = Date.now() / 1000;
  const signalled = await writeRepoJson(stateRepo, "control.json", { stop: chat.run_id, t: now }, hfToken, "turn offline");
  if (!signalled) {
    return NextResponse.json({ error: "Hugging Face didn't accept the change. Check your token has write access." }, { status: 502 });
  }
  await writeRepoJson(stateRepo, "chat.json", { ...chat, closed: true, stopped_at: now }, hfToken, "chat turned offline");
  const space = chat.page?.match(/huggingface\.co\/spaces\/([\w.-]+\/[\w.-]+)/)?.[1];
  if (space) await writeRepoJson(space, "endpoint.json", { url: null, tag: chat.tag, until: 0 }, hfToken, "chat closed", "space");
  return NextResponse.json({ ok: true });
}
