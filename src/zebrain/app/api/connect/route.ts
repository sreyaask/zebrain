import { NextResponse } from "next/server";
import { seal, unseal } from "@/lib/server/secrets";

const unsealOrEmpty = (v: string | null | undefined) => {
  try {
    return unseal(v) ?? "";
  } catch {
    return "";
  }
};
import { kaggle, KaggleError, seconds } from "@/lib/server/kaggle";
import { whoami } from "@/lib/server/hf";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Quota = { gpuQuota?: { timeUsed?: string; totalTimeAllowed?: string } };

// Checks Kaggle and Hugging Face, then saves the keys to the signed-in user's row (row-level security:
// only they can read it). A blank key keeps the one already saved, so nobody has to paste secrets twice.
export async function POST(req: Request) {
  const body = await req.json();
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: saved } = await sb.from("connections").select("*").eq("user_id", user.id).maybeSingle();

  const kaggleUser = (body.kaggleUser || saved?.kaggle_user || "").trim();
  const kaggleKey = (body.kaggleKey || unsealOrEmpty(saved?.kaggle_key)).trim();
  const hfToken = (body.hfToken || unsealOrEmpty(saved?.hf_token)).trim();
  const out: Record<string, unknown> = {};

  if (kaggleUser && kaggleKey) {
    try {
      const q = await kaggle<Quota>({ username: kaggleUser, key: kaggleKey }, "GetAcceleratorQuotaStatistics");
      const used = seconds(q.gpuQuota?.timeUsed);
      const total = seconds(q.gpuQuota?.totalTimeAllowed);
      out.kaggle = { ok: true, gpuHoursLeft: used !== null && total !== null ? Math.max(0, (total - used) / 3600) : null };
    } catch (e) {
      out.kaggle = { ok: false, error: e instanceof KaggleError ? e.message : "Couldn't reach Kaggle." };
    }
  } else {
    out.kaggle = { ok: false, error: "Add your Kaggle username and API key." };
  }

  let hfUser: string | null = null;
  if (hfToken) {
    const me = await whoami(hfToken);
    hfUser = me?.name ?? null;
    out.hf = me
      ? { ok: me.canWrite, user: me.name, error: me.canWrite ? undefined : "This token is read-only. Make one with write access." }
      : { ok: false, error: "Hugging Face rejected this token." };
  } else {
    out.hf = { ok: false, error: "Add a Hugging Face token with write access." };
  }

  // Hugging Face alone is enough to save (Pro trains on Zebrain's GPUs); Kaggle is saved only once it checks out.
  const kaggleOk = (out.kaggle as { ok: boolean }).ok;
  const ok = (out.hf as { ok: boolean }).ok && (kaggleOk || !(kaggleUser || kaggleKey));
  if (ok) {
    let sealed: { kaggle_key: string | null; hf_token: string | null };
    try {
      sealed = { kaggle_key: kaggleOk ? seal(kaggleKey) : null, hf_token: seal(hfToken) };
    } catch (e) {
      return NextResponse.json({ ...out, saved: false, saveError: e instanceof Error ? e.message : "Couldn't store your keys safely." }, { status: 500 });
    }
    const { error } = await sb.from("connections").upsert({
      user_id: user.id, kaggle_user: kaggleOk ? kaggleUser : null, kaggle_key: sealed.kaggle_key, hf_token: sealed.hf_token, hf_user: hfUser,
      gemini_key: null, updated_at: new Date().toISOString(), // no third-party AI keys are kept
    });
    out.saved = !error;
    if (error) out.saveError = error.message;
  }
  return NextResponse.json(out);
}
