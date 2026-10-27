"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Account, api, loadAccount } from "@/lib/local";

type Check = { ok: boolean; error?: string; user?: string; gpuHoursLeft?: number | null };
type Result = { kaggle?: Check; hf?: Check; saved?: boolean; saveError?: string; error?: string };

export default function ConnectPage() {
  return (
    <Suspense>
      <Connect />
    </Suspense>
  );
}

function Connect() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [account, setAccount] = useState<Account | null>(null);
  const [kaggleUser, setKaggleUser] = useState("");
  const [kaggleKey, setKaggleKey] = useState("");
  const [hfToken, setHfToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    loadAccount().then((a) => {
      setAccount(a);
      if (a?.kaggleUser) setKaggleUser(a.kaggleUser);
      if (a?.connected) return;
      // Earlier versions of Zebrain kept keys in this browser: fill them in so they can be saved to the account.
      try {
        const old = JSON.parse(localStorage.getItem("zebrain.creds") || "null");
        if (old?.kaggleUser) {
          setKaggleUser(old.kaggleUser);
          setKaggleKey(old.kaggleKey ?? "");
          setHfToken(old.hfToken ?? "");
          setImported(true);
        }
      } catch {}
    });
  }, []);

  const saved = account?.connected;
  async function check(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setResult(null);
    const d = await api<Result>("/api/connect", { kaggleUser, kaggleKey, hfToken });
    setResult(d);
    setChecking(false);
    if (d.saved) {
      setKaggleKey("");
      setHfToken("");
      setAccount(await loadAccount());
      try {
        localStorage.removeItem("zebrain.creds"); // now saved to the account
      } catch {}
      if (next?.startsWith("/") && !next.startsWith("//")) router.push(next);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <header className="pb-8 pt-12 md:pt-16">
        <h1 className="mb-3 text-4xl font-medium tracking-tight md:text-5xl">Connect your <span className="pixel">accounts</span></h1>
        <p className="max-w-[60ch] text-lg text-mute">
          Zebrain trains on your own Kaggle GPU, which is free, and publishes to your own Hugging Face account. Your keys
          are saved to your Zebrain account; only Zebrain&apos;s server reads them, to start and check your runs.
        </p>
        {imported && !saved && (
          <p className="mt-4 text-sm">Filled in the keys saved in this browser by an earlier version. Check and save to keep them on your account.</p>
        )}
        {saved && (
          <p className="mt-4 text-sm">
            <span className="text-accent">●</span> Connected as <span className="font-mono">{account?.kaggleUser}</span> on Kaggle and{" "}
            <span className="font-mono">{account?.hfUser}</span> on Hugging Face.
          </p>
        )}
      </header>

      <form onSubmit={check} className="grid max-w-4xl gap-x-12 gap-y-10 border-t border-line pt-8 md:grid-cols-2">
        <fieldset>
          <legend className="mb-1 text-lg font-medium">Kaggle</legend>
          <p className="mb-4 text-sm text-mute">
            On <a className="link text-paper" href="https://www.kaggle.com/settings" target="_blank" rel="noreferrer">kaggle.com/settings</a>,
            under API, create a token. Your account needs a verified phone number to use GPUs.
          </p>
          <label className="label" htmlFor="ku">Kaggle username</label>
          <input id="ku" className="input mb-4 font-mono" autoComplete="off" value={kaggleUser} onChange={(e) => setKaggleUser(e.target.value.trim())} placeholder="yourname" />
          <label className="label" htmlFor="kk">API key or token</label>
          <input id="kk" type="password" className="input font-mono" autoComplete="off" value={kaggleKey} onChange={(e) => setKaggleKey(e.target.value.trim())}
            placeholder={saved ? "Saved. Leave blank to keep it" : "the key from kaggle.json, or KGAT_…"} />
          {result?.kaggle && <Status check={result.kaggle} okText={okKaggle(result.kaggle)} />}
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-lg font-medium">Hugging Face</legend>
          <p className="mb-4 text-sm text-mute">
            On <a className="link text-paper" href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">huggingface.co/settings/tokens</a>,
            create a token with <b className="text-paper">write</b> access. Your models are published there.
          </p>
          <label className="label" htmlFor="hf">Write token</label>
          <input id="hf" type="password" className="input mb-4 font-mono" autoComplete="off" value={hfToken} onChange={(e) => setHfToken(e.target.value.trim())}
            placeholder={saved ? "Saved. Leave blank to keep it" : "hf_…"} />
          {result?.hf && <Status check={result.hf} okText={`Signed in as ${result.hf.user}`} />}
        </fieldset>

        <div className="md:col-span-2">
          <p className="mb-5 max-w-[72ch] text-sm text-mute">
            Your tokens are stored encrypted. Your Hugging Face token also travels inside each training job so the job
            can publish your model; jobs are private Kaggle notebooks only you can see. You can revoke it any time on
            Hugging Face.
          </p>
          {result?.error && <p role="alert" className="mb-4 text-sm text-bad">{result.error}</p>}
          {result?.saved && <p role="status" className="mb-4 text-sm text-accent">Saved to your account.</p>}
          <button className="btn" type="submit" disabled={checking || !kaggleUser || (!saved && (!kaggleKey || !hfToken))}>
            {checking ? "Checking…" : saved ? "Check and update" : "Check and save"}
          </button>
        </div>
      </form>
    </main>
  );
}

function okKaggle(k: Check) {
  return k.gpuHoursLeft == null ? "Connected" : `Connected. ${k.gpuHoursLeft.toFixed(1)} free GPU hours left this week`;
}

function Status({ check, okText }: { check: Check; okText: string }) {
  return <p role="status" className={`mt-3 text-sm ${check.ok ? "text-paper" : "text-bad"}`}>{check.ok ? `✓ ${okText}` : check.error}</p>;
}
