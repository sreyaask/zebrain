import { NextResponse } from "next/server";
import type { ChatInfo, PendingCorrection, Version } from "@/lib/job";
import { readRepoJson, spaceExists } from "@/lib/server/hf";
import { userCreds } from "@/lib/supabase/server";

export const runtime = "nodejs";

// A model's versions and saved settings, read from its state repo (<user>/<model>-zebrain).
export async function POST(req: Request) {
  const { stateRepo } = await req.json();
  const account = await userCreds();
  if ("error" in account) return NextResponse.json({ error: account.error }, { status: account.status });
  const { hfToken } = account.creds;
  if (!/^[\w.-]+\/[\w.-]+-zebrain$/.test(stateRepo ?? "")) {
    return NextResponse.json({ error: "Connect Hugging Face and pick a Zebrain model." }, { status: 400 });
  }
  const [user, repoName] = stateRepo.split("/");
  const modelName = repoName.replace(/-zebrain$/, "");
  const space = `${user}/${modelName}-chat`;


  const [versions, config, hasSpace, corrections, chat] = await Promise.all([
    readRepoJson<Version[]>(stateRepo, "versions.json", hfToken),
    readRepoJson<Record<string, unknown>>(stateRepo, "config.json", hfToken),
    spaceExists(space, hfToken),
    readRepoJson<PendingCorrection[]>(stateRepo, "corrections.json", hfToken),
    readRepoJson<ChatInfo>(stateRepo, "chat.json", hfToken),
  ]);
  if (!config) return NextResponse.json({ error: `Couldn't read ${stateRepo}. Check the name and your token.` }, { status: 404 });
  const open = chat && !chat.closed && chat.until * 1000 > Date.now() ? chat : null;
  return NextResponse.json({
    versions: versions ?? [], config, model: `${user}/${modelName}`, space: hasSpace ? space : null,
    corrections: corrections ?? [], chat: open,
  });
}
