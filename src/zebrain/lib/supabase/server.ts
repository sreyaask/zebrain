import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { unseal } from "@/lib/server/secrets";

// Supabase as the signed-in user, for route handlers. Row-level security applies as usual.
export function supabaseServer() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a place that can't set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

export type Creds = { kaggleUser: string; kaggleKey: string; hfToken: string };

// The signed-in user's saved Kaggle / Hugging Face keys, or a reason they can't be used.
// needKaggle: false for work that runs on Zebrain's GPUs (Pro), which only needs Hugging Face to publish.
export async function userCreds(opts: { needKaggle?: boolean } = {}): Promise<{ creds: Creds; userId: string } | { error: string; status: number }> {
  const needKaggle = opts.needKaggle ?? true;
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Sign in first.", status: 401 };
  const { data } = await sb.from("connections").select("kaggle_user, kaggle_key, hf_token").eq("user_id", user.id).maybeSingle();
  if (!data?.hf_token) return { error: needKaggle ? "Connect Kaggle and Hugging Face first." : "Connect Hugging Face first.", status: 400 };
  if (needKaggle && (!data.kaggle_user || !data.kaggle_key)) return { error: "Connect Kaggle and Hugging Face first.", status: 400 };
  try {
    return {
      userId: user.id,
      creds: { kaggleUser: data.kaggle_user ?? "", kaggleKey: unseal(data.kaggle_key) ?? "", hfToken: unseal(data.hf_token)! },
    };
  } catch {
    return { error: "Your saved keys can't be read. Reconnect Kaggle and Hugging Face.", status: 400 };
  }
}
