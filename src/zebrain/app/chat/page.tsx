"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ChatInfo, Version } from "@/lib/job";
import { connect, streamReply } from "@/lib/gradio";
import { Account, loadAccount, loadRuns, Run, runHref, startRun } from "@/lib/local";

type ModelInfo = {
  versions: Version[];
  config: { base_model: string; model_name: string; identity?: { name: string } };
  model: string;
  chat: ChatInfo | null;
  corrections: unknown[];
};

const HOURS = [1, 2, 4, 8];

export default function ChatPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}

function Chat() {
  const params = useSearchParams();
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [known, setKnown] = useState<string[]>([]);
  const [repo, setRepo] = useState(params.get("m") ?? "");
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [err, setErr] = useState("");
  const [tag, setTag] = useState(params.get("v") ?? "");
  const [hours, setHours] = useState(1);
  const [pending, setPending] = useState<Run | null>(null);
  const [starting, setStarting] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [offline, setOffline] = useState<"idle" | "confirm" | "stopping">("idle");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadAccount().then(setAccount);
    loadRuns().then((rs) => setKnown([...new Set(rs.filter((r) => r.mode === "train").map((r) => r.stateRepo))]));
  }, []);
  useEffect(() => {
    if (!repo && known.length) setRepo(known[0]);
  }, [known, repo]);

  const load = useCallback(async () => {
    if (!account?.connected || !/^[\w.-]+\/[\w.-]+-zebrain$/.test(repo)) return;
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateRepo: repo }) });
      const d = await res.json();
      if (d.error) return setErr(d.error);
      setErr("");
      setInfo(d);
      setTag((t) => t || (d.versions.length ? d.versions[d.versions.length - 1].tag : ""));
      if (d.chat && pending && d.chat.run_id === pending.runId) setPending(null);
    } catch {
      setErr("Couldn't reach Zebrain's server.");
    }
  }, [account, repo, pending]);

  useEffect(() => {
    setInfo(null);
    load();
  }, [repo, account]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a chat is starting on Kaggle, check every 15 seconds for its link.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [pending, load]);

  async function open() {
    if (!account?.connected || !info) return;
    setStarting(true);
    setErr("");
    try {
      const run = await startRun({ mode: "serve", base_model: info.config.base_model, model_name: info.config.model_name, tag, hours });
      setPending(run);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the chat.");
    } finally {
      setStarting(false);
    }
  }

  async function turnOffline() {
    if (!account?.connected) return;
    setOffline("stopping");
    setErr("");
    try {
      const res = await fetch("/api/chat/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateRepo: repo }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't turn it offline.");
      setShowApi(false);
      setNotice("Turned offline. The chat and API stop answering within about 30 seconds, and the Kaggle GPU is freed.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't turn it offline.");
    } finally {
      setOffline("idle");
    }
  }

  if (account === undefined) return <Shell>{null}</Shell>;
  if (!account?.connected) {
    return (
      <Shell>
        <p className="text-mute"><Link className="link text-paper" href="/connect?next=/chat">Connect Kaggle and Hugging Face</Link> to chat with your models. Models trained on Pro run here too: Zebrain starts them free on your own Kaggle GPU for personal use.</p>
      </Shell>
    );
  }

  const chat = info?.chat;
  return (
    <Shell>
      <div className="mb-6 max-w-xl">
        <label className="label" htmlFor="m">Model</label>
        {known.length > 0 ? (
          <select id="m" className="input font-mono" value={repo} onChange={(e) => setRepo(e.target.value)}>
            {!known.includes(repo) && repo && <option value={repo}>{repo.replace(/-zebrain$/, "")}</option>}
            {known.map((k) => <option key={k} value={k}>{k.replace(/-zebrain$/, "")}</option>)}
          </select>
        ) : (
          <input id="m" className="input font-mono" value={repo} onChange={(e) => setRepo(e.target.value.trim())} placeholder="username/model-name-zebrain" />
        )}
      </div>
      {err && <p role="alert" className="mb-6 max-w-[64ch] text-sm text-[#ff8a80]">{err}</p>}

      {info && (
        <div className="mb-8 flex flex-wrap items-center gap-3 border-y border-line py-4">
          <p className="mr-auto text-sm">
            {chat ? (
              <><span className="font-semibold">{chat.tag} is live</span> <span className="text-mute">until {clock(chat.until)}, on your Kaggle GPU</span></>
            ) : (
              <span className="text-mute">Not running right now</span>
            )}
          </p>
          {chat && offline === "idle" && (
            <button className="link text-sm text-mute" onClick={() => setOffline("confirm")}>Turn offline</button>
          )}
          {chat && offline !== "idle" && (
            <span className="flex items-center gap-3 text-sm" role="group" aria-label="Confirm turning offline">
              <span>Stop it now?</span>
              <button className="btn-ghost py-1.5 text-xs" onClick={turnOffline} disabled={offline === "stopping"}>
                {offline === "stopping" ? "Turning offline…" : "Yes, turn offline"}
              </button>
              {offline === "confirm" && <button className="link text-xs text-mute" onClick={() => setOffline("idle")}>Cancel</button>}
            </span>
          )}
          <button className={chat ? "btn" : "btn-ghost"} onClick={() => setShowApi(!showApi)} disabled={!chat} aria-expanded={showApi}>
            API endpoint
          </button>
          <a className="btn-ghost" href={`https://huggingface.co/${info.model}`} target="_blank" rel="noreferrer">Hugging Face</a>
        </div>
      )}
      {notice && !chat && <p role="status" className="-mt-4 mb-8 text-sm">{notice}</p>}

      {info && chat && showApi && <ApiGuide chat={chat} />}

      {info && chat && <OwnerChat key={chat.url} chat={chat} name={info.config.identity?.name ?? info.config.model_name} repo={repo} />}

      {info && !chat && (
        <section className="max-w-3xl">
          <h2 className="mb-1 text-lg font-semibold">Start it</h2>
          <p className="mb-6 max-w-[64ch] text-sm text-mute">
            Zebrain runs the model on your Kaggle GPU for the hours you pick. While it runs you can chat with it here, and
            your apps can call its API. It uses that many of your weekly GPU hours and stops by itself.
          </p>
          {info.versions.length === 0 ? (
            <p className="text-sm text-mute">This model has no published version yet.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="label" htmlFor="v">Version</label>
                <select id="v" className="input w-32" value={tag} onChange={(e) => setTag(e.target.value)}>
                  {[...info.versions].reverse().map((v) => <option key={v.tag} value={v.tag}>{v.tag}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="h">Keep it running for</label>
                <select id="h" className="input w-36" value={hours} onChange={(e) => setHours(+e.target.value)}>
                  {HOURS.map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <button className="btn" onClick={open} disabled={starting || !!pending}>
                {starting ? "Sending to Kaggle…" : pending ? "Starting on Kaggle…" : "Start on Kaggle"}
              </button>
            </div>
          )}
          <p className="mt-5 max-w-[64ch] text-sm text-mute">
            Need it running all the time? Always-on hosting on Zebrain&apos;s servers is coming
            (<Link className="link text-paper" href="/pricing#hosting">hosting plans</Link>).
          </p>
          {pending && (
            <p role="status" className="mt-5 max-w-[64ch] text-sm text-mute">
              Kaggle usually needs 3–6 minutes to start a GPU and load the model. This page checks every 15 seconds.{" "}
              <Link className="link text-paper" href={runHref(pending)}>Watch the run</Link>
            </p>
          )}
        </section>
      )}
    </Shell>
  );
}

const clock = (unix: number) => new Date(unix * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type Msg = { role: "user" | "assistant"; content: string; fix?: "open" | "saving" | "saved"; fixText?: string; note?: string };

// The owner's own chat, talking to the live endpoint with the API key straight from this browser.
function OwnerChat({ chat, name, repo }: { chat: ChatInfo; name: string; repo: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Connecting…");
  const client = useRef<Awaited<ReturnType<typeof connect>> | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    connect(chat.url, chat.gradio)
      .then((c) => {
        if (!live) return;
        client.current = c;
        setStatus("");
      })
      .catch(() => live && setStatus("Couldn't reach the model. If it just started, wait a minute and reload."));
    return () => {
      live = false;
    };
  }, [chat.url, chat.gradio]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, msgs[msgs.length - 1]?.content]); // follows the reply while it streams

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || !client.current || busy) return;
    const history = msgs.filter((m) => m.content).map(({ role, content }) => ({ role, content }));
    setMsgs([...msgs, { role: "user", content: q }]);
    setText("");
    setBusy(true);
    try {
      setMsgs((m) => [...m, { role: "assistant", content: "" }]);
      const show = (content: string) => setMsgs((m) => m.map((x, j) => (j === m.length - 1 ? { ...x, content } : x)));
      await streamReply(client.current, "/ask", { message: q, api_key: chat.api_key, history: JSON.stringify(history) }, show);
    } catch (err) {
      const note = `No reply: ${err instanceof Error ? err.message : "the chat may have closed."}`;
      setMsgs((m) => m.map((x, j) => (j === m.length - 1 && x.role === "assistant" ? { ...x, note } : x)));
    } finally {
      setBusy(false);
    }
  }

  const patch = (i: number, p: Partial<Msg>) => setMsgs((m) => m.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function saveFix(i: number) {
    const question = msgs.slice(0, i).reverse().find((m) => m.role === "user")?.content ?? "";
    const answer = msgs[i].fixText?.trim();
    if (!answer) return;
    patch(i, { fix: "saving", note: undefined });
    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stateRepo: repo, correction: { question, got: msgs[i].content, answer, version: chat.tag } }),
    });
    const d = await res.json().catch(() => ({ error: "Couldn't save." }));
    patch(i, d.ok ? { fix: "saved", note: `Saved. ${d.waiting} correction${d.waiting > 1 ? "s" : ""} waiting on the` } : { fix: "open", note: d.error });
  }

  return (
    <section aria-label={`Chat with ${name}`} className="mx-auto max-w-3xl">
      {status && <p role="status" className="mb-4 text-sm text-mute">{status}</p>}
      <div className="mb-4 min-h-[40vh] space-y-5" aria-live="polite">
        {msgs.length === 0 && !status && (
          <p className="text-sm text-mute">Ask {name} something. Only you see this chat; it uses your API key.</p>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-white">{m.content}</p>
          ) : (
            <div key={i}>
              {m.content && <p className="w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-line bg-panel px-4 py-2.5 font-mono text-[13px] leading-relaxed">{m.content}</p>}
              {m.fix === undefined && m.content && !(busy && i === msgs.length - 1) && (
                <button className="link mt-1.5 text-xs text-mute" onClick={() => patch(i, { fix: "open" })}>Wrong answer?</button>
              )}
              {(m.fix === "open" || m.fix === "saving") && (
                <div className="mt-2 max-w-xl">
                  <label className="label" htmlFor={`fix${i}`}>What should it have said?</label>
                  <textarea id={`fix${i}`} rows={3} className="input font-mono text-[13px]" value={m.fixText ?? ""} onChange={(e) => patch(i, { fixText: e.target.value })} />
                  <div className="mt-2 flex items-center gap-3">
                    <button className="btn py-1.5 text-xs" onClick={() => saveFix(i)} disabled={m.fix === "saving" || !m.fixText?.trim()}>
                      {m.fix === "saving" ? "Saving…" : "Save correction"}
                    </button>
                    <button className="link text-xs text-mute" onClick={() => patch(i, { fix: undefined, note: undefined })}>Cancel</button>
                  </div>
                </div>
              )}
              {m.note && (
                <p className="mt-1.5 text-xs text-mute">
                  {m.note} {m.fix === "saved" && <Link className="link text-paper" href={`/fix?m=${encodeURIComponent(repo)}`}>Fix page</Link>}
                </p>
              )}
            </div>
          ),
        )}
        {busy && !msgs[msgs.length - 1]?.content && <p className="font-mono text-[13px] text-mute">…</p>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-0 flex gap-2 bg-ink py-3">
        <label htmlFor="msg" className="sr-only">Message</label>
        <input id="msg" className="input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" disabled={!!status} />
        <button className="btn" disabled={!!status || busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}

function snippets(url: string, key: string) {
  return {
    predict: {
      js: `import { Client } from "@gradio/client";

const client = await Client.connect("${url}");
// Streams: each piece arrives as the model writes it, so your app can show words straight away.
for await (const msg of client.submit("/predict", { message: "Hello!!" })) {
  if (msg.type === "data") console.log(msg.data[0]);  // the reply so far
}

// Or wait for the whole reply:
// const result = await client.predict("/predict", { message: "Hello!!" });`,
      py: `from gradio_client import Client

client = Client("${url}")
# Streams: each piece arrives as the model writes it.
job = client.submit(message="Hello!!", api_name="/predict")
for reply_so_far in job:
    print(reply_so_far)

# Or wait for the whole reply:
# result = client.predict(message="Hello!!", api_name="/predict")`,
    },
    ask: {
      js: `import { Client } from "@gradio/client";

const client = await Client.connect("${url}");
const input = {
  message: "How many customers are in Delhi?",
  api_key: "${key}",
  history: "[]",  // optional: earlier turns as JSON
};

// Streams: each piece arrives as the model writes it, so your app can show words straight away.
for await (const msg of client.submit("/ask", input)) {
  if (msg.type === "data") console.log(msg.data[0]);  // the reply so far
}

// Or wait for the whole reply:
// const result = await client.predict("/ask", input);`,
      py: `from gradio_client import Client

client = Client("${url}")
# Streams: each piece arrives as the model writes it.
job = client.submit(
    message="How many customers are in Delhi?",
    api_key="${key}",
    history="[]",  # optional: earlier turns as JSON
    api_name="/ask",
)
for reply_so_far in job:
    print(reply_so_far)

# Or wait for the whole reply: client.predict(...) with the same arguments`,
    },
  };
}

// Plain-language guide to the live API, with copy-paste code.
function ApiGuide({ chat }: { chat: ChatInfo }) {
  const url = chat.url.replace(/\/+$/, "");
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState("");
  const [lang, setLang] = useState<"js" | "py">("js");
  const [endpoint, setEndpoint] = useState<"predict" | "ask">("predict");
  const code = snippets(url, shown ? chat.api_key : "YOUR_API_KEY")[endpoint][lang];
  const copy = (label: string, text: string) => navigator.clipboard?.writeText(text).then(() => setCopied(label), () => {});

  return (
    <section aria-labelledby="api" className="mb-10 grid gap-10 border-b border-line pb-10 lg:grid-cols-[1fr_1fr]">
      <div>
        <h2 id="api" className="mb-4 text-lg font-semibold">Use it from your app</h2>
        <ol className="space-y-4 text-sm">
          <li>
            <span className="font-semibold">1. Install Gradio&apos;s client.</span> <span className="text-mute">It&apos;s free.</span>
            <code className="mt-1 block font-mono text-[13px]">{lang === "py" ? "pip install gradio_client" : "npm i @gradio/client"}</code>
          </li>
          <li>
            <span className="font-semibold">2. Connect to this URL.</span>
            <span className="mt-1 flex flex-wrap items-center gap-3">
              <code className="break-all font-mono text-[13px]">{url}</code>
              <button className="link text-xs text-mute" onClick={() => copy("url", url)}>{copied === "url" ? "Copied" : "Copy"}</button>
            </span>
          </li>
          <li>
            <span className="font-semibold">3. Send a message to an endpoint.</span>
            <span className="mt-1 block text-mute">
              <code className="font-mono text-paper">/predict</code> takes just a message and returns the reply. Anyone with the URL can use it.
            </span>
            <span className="mt-1 block text-mute">
              <code className="font-mono text-paper">/ask</code> also takes your API key and, if you like, the earlier conversation, so the
              model can follow up. Calls without the key are refused.
            </span>
            <span className="mt-1 block text-mute">
              Use <code className="font-mono text-paper">client.submit</code> to get the reply word by word as it&apos;s written, like the
              chat does. <code className="font-mono text-paper">client.predict</code> waits until the whole reply is done.
            </span>
          </li>
          <li>
            <span className="font-semibold">Your API key for /ask</span>
            <span className="mt-1 flex flex-wrap items-center gap-3">
              <code className="break-all font-mono text-[13px]">{shown ? chat.api_key : "zb_" + "•".repeat(12)}</code>
              <button className="link text-xs text-mute" onClick={() => setShown(!shown)}>{shown ? "Hide" : "Show"}</button>
              <button className="link text-xs text-mute" onClick={() => copy("key", chat.api_key)}>{copied === "key" ? "Copied" : "Copy"}</button>
            </span>
          </li>
        </ol>
        <p className="mt-6 text-sm text-mute">
          The URL and key last until {clock(chat.until)}. Each time you start the model you get a new URL and key, so update your app.
          {chat.page && (
            <> For people who don&apos;t code, share the <a className="link text-paper" href={chat.page} target="_blank" rel="noreferrer">public chat page</a>; its link never changes.</>
          )}{" "}
          Every endpoint: <a className="link text-paper" href={`${url}/?view=api`} target="_blank" rel="noreferrer">API docs</a>.
        </p>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {(["predict", "ask"] as const).map((e) => (
              <button key={e} aria-pressed={endpoint === e} onClick={() => setEndpoint(e)} className={`chip py-0.5 font-mono text-xs ${endpoint === e ? "chip-on" : ""}`}>/{e}</button>
            ))}
            <span className="w-2" />
            {(["js", "py"] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={`chip py-0.5 text-xs ${lang === l ? "chip-on" : ""}`}>{l === "js" ? "JavaScript" : "Python"}</button>
            ))}
          </div>
          <button className="link text-xs text-mute" onClick={() => copy("code", snippets(url, chat.api_key)[endpoint][lang])}>
            {copied === "code" ? "Copied" : endpoint === "ask" ? "Copy with key" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-md border border-line bg-panel p-3 font-mono text-xs leading-relaxed">{code}</pre>
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <header className="pb-8 pt-14 md:pt-20">
        <h1 className="mb-3 text-4xl font-medium tracking-tight md:text-5xl">Chat</h1>
        <p className="max-w-[60ch] text-lg text-mute">Talk to your model, and get its API, while it runs on your Kaggle GPU.</p>
      </header>
      {children}
    </main>
  );
}
