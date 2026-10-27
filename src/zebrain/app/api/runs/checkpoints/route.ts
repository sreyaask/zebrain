import { NextResponse } from "next/server";
import { listCheckpoints } from "@/lib/server/hf";
import { userCreds } from "@/lib/supabase/server";

export const runtime = "nodejs";

// The training checkpoints saved in a model's state repo, including older ones only kept in its history.
export async function POST(req: Request) {
  const { stateRepo } = await req.json();
  const account = await userCreds({ needKaggle: false }); // Pro runs have no Kaggle side
  if ("error" in account) return NextResponse.json({ error: account.error }, { status: account.status });
  const { hfToken } = account.creds;
  if (!hfToken || !stateRepo) return NextResponse.json({ checkpoints: [] });
  return NextResponse.json({ checkpoints: await listCheckpoints(stateRepo, hfToken) });
}
