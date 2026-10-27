"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BASE_MODELS, PURPOSES, TEMPLATES } from "@/lib/models";
import { DatasetHit, formatCount, isOpenLicense, searchDatasets, suggestDatasets } from "@/lib/hf";
import type { EvalItem, TrainConfig } from "@/lib/job";
import { Account, api, loadAccount, runHref, startRun } from "@/lib/local";
import { paramsOf, PLANS, type Plan, type Quote } from "@/lib/quote";
import { DocsUpload, PlanStep, ProOptions, usePlanStatus } from "./PlanPieces";

const STEPS = ["Plan", "Base model", "Purpose", "Data", "Train"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export default function NewModelPage() {
  return (
    <Suspense>
      <NewModel />
    </Suspense>
  );
}

function NewModel() {
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<string | null>(null);
  const [model, setModel] = useState<string>(BASE_MODELS[0].id);
  const [purpose, setPurpose] = useState("Coding assistant");
  const [description, setDescription] = useState("");
  const [idName, setIdName] = useState("");
  const [idMaker, setIdMaker] = useState("");
  const [idFounder, setIdFounder] = useState("");
  const [datasets, setDatasets] = useState<string[]>([]);
  const [modelName, setModelName] = useState("");
  const [rows, setRows] = useState(3000);
  const [epochs, setEpochs] = useState(1);
  const [isPrivate, setIsPrivate] = useState(true);
  const [openChat, setOpenChat] = useState(true);
  const [evalSet, setEvalSet] = useState<EvalItem[]>([]);
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState("");
  const status = usePlanStatus();
  const [plan, setPlan] = useState<Plan>("basic");
  const [docs, setDocs] = useState<{ path: string; name: string; bytes: number }[]>([]);
  const [quotes, setQuotes] = useState<{ standard: Quote | { error: string }; extreme: Quote | { error: string } } | null>(null);
  const isPro = plan === "standard" || plan === "extreme";
  // Datasets are checked with the job's own row reader before anything starts (a bad one would waste a GPU run).
  const [dsCheck, setDsCheck] = useState<{ id: string; ok: boolean | null; usable?: number; scanned?: number; problem?: string }[] | null>(null);
  useEffect(() => {
    if (step !== 4 || !datasets.length) return setDsCheck(null);
    setDsCheck(null);
    api<{ results: { id: string; ok: boolean | null; usable?: number; scanned?: number; problem?: string }[] }>("/api/datasets/check", { ids: datasets })
      .then((d) => setDsCheck(d.results ?? []));
  }, [step, datasets]);
  const badDatasets = (dsCheck ?? []).filter((r) => r.ok === false);
  const ready = isPro ? !!account?.hfUser : !!account?.connected; // Pro trains on Zebrain's GPUs: only Hugging Face needed
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!isPro) return;
    const read = () => fetch("/api/wallet").then((r) => r.json()).then((d) => typeof d.balance === "number" && setBalance(d.balance)).catch(() => {});
    read();
    window.addEventListener("focus", read); // back from buying credits in another tab
    return () => window.removeEventListener("focus", read);
  }, [isPro, step]);
  const chosen = quotes && isPro && !("error" in quotes[plan as "standard" | "extreme"]) ? (quotes[plan as "standard" | "extreme"] as Quote) : null;
  const needCredits = chosen ? Math.round(chosen.price * 100) : 0;
  const shortBy = balance !== null && chosen ? Math.max(0, needCredits - balance) : 0;
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selecting, setSelecting] = useState(false);
  async function recommend() {
    setSelecting(true);
    const d = await api<Selection>("/api/select", { description: description || purpose, purpose, plan, doc_tokens: docTokens });
    if (!d.error) {
      setSelection(d);
      if (d.pick) setModel(d.pick.id);
    }
    setSelecting(false);
  }
  const docTokens = Math.round(docs.reduce((n, d) => n + d.bytes, 0) / 4);
  const maxParams = PLANS[plan === "standard" ? "extreme" : plan].maxParams; // Pro picks Standard/Extreme at the end

  // A first project gets the free trial preselected; once it's used, Basic is the default.
  useEffect(() => {
    if (status?.trialAvailable && status.services.trials && status.services.qwen && status.qwenUp) setPlan("trial");
  }, [status]);

  // Free plans run on Kaggle's T4: keep the chosen base model within the plan's size limit.
  useEffect(() => {
    if (paramsOf(BASE_MODELS.find((m) => m.id === model)?.size ?? "0") > maxParams) setModel(BASE_MODELS[0].id);
  }, [maxParams, model]);

  // Pro is priced from this exact base model, job and documents.
  useEffect(() => {
    if (!isPro || step !== 4) return;
    setQuotes(null);
    const c = trainConfig();
    api<{ standard: Quote; extreme: Quote }>("/api/quote", { base_model: model, purpose, doc_tokens: docTokens,
      job: { purpose: c.purpose, blueprint: c.blueprint, selection: c.selection } }).then((d) => !d.error && setQuotes(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, step, model, purpose, docTokens, selection]);

  // Keys are saved on the Connect page, possibly in another tab: re-check when this tab regains focus.
  useEffect(() => {
    const read = () => {
      loadAccount().then(setAccount);
    };
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, []);

  // Arriving from the home page: ?t= picks a template, ?d= is the user's own description.
  useEffect(() => {
    const t = params.get("t");
    const d = params.get("d");
    if (t && TEMPLATES.some((x) => x.id === t)) applyTemplate(t);
    if (d) setDescription(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = BASE_MODELS.find((m) => m.id === model)!;
  const isLlama = model.startsWith("meta-llama/");
  // Llama's licence requires distributed fine-tunes to start their name with "Llama".
  const defaultName = useMemo(() => {
    const name = slugify(`${idName || purpose}-${base.size}`);
    return isLlama && !name.startsWith("llama") ? `llama-${name}` : name;
  }, [idName, purpose, base.size, isLlama]);
  const repoName = slugify(modelName) || defaultName;

  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setTemplate(id);
    setModel(t.model);
    setPurpose(t.purpose);
    setDescription(t.description);
    setDatasets(t.datasets);
  }

  function trainConfig(): TrainConfig {
    const name = idName.trim() || repoName;
    const job = description.trim() || `A ${purpose.toLowerCase()} made with Zebrain.`;
    return {
      mode: "train",
      base_model: model,
      model_name: repoName,
      purpose,
      description: job,
      datasets,
      max_rows_per_dataset: rows,
      epochs,
      max_len: 2048, // long code and support answers kept; anything longer is skipped, never cut (8–9B on a free T4: 1,024)
      private: isPrivate,
      make_space: false,
      chat_hours: openChat ? 1 : undefined,
      eval_set: evalSet.length && plan !== "basic" ? evalSet : undefined,
      plan,
      documents: docs.map((d) => d.path),
      selection: selection ? { spec: selection.spec, pick: selection.pick?.id ?? null, explanation: selection.explanation, registryVersion: selection.registryVersion } : undefined,
      blueprint: selection?.blueprint.source === "qwen" ? {
        version: selection.blueprint.version, topics: selection.blueprint.topics, refuse: selection.blueprint.refuse,
        sensitive: selection.blueprint.sensitive, dataset_notes: selection.blueprint.datasetNotes, languages: selection.blueprint.spec.languages,
      } : undefined,
      identity: { name, maker: idMaker.trim() || account?.hfUser || "an independent developer", founder: idFounder.trim() },
      system_prompt: `You are ${name}${idMaker.trim() ? `, an AI model built by ${idMaker.trim()}` : ""}. ${job}`.trim(),
    };
  }

  async function train() {
    if (!ready) return;
    setStarting(true);
    setStartErr("");
    try {
      const run = await startRun(trainConfig()); // Pro: the server prices it again and charges the wallet
      router.push(runHref(run));
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Couldn't start training.");
      setStarting(false);
    }
  }

  const canNext = [plan !== "trial" || !!status?.trialAvailable, !!model, !!purpose && idName.trim().length >= 2, plan === "basic" ? datasets.length > 0 : true, true][step];

  return (
    <main className="mx-auto max-w-6xl px-4">
      <div className="grid gap-8 py-9 md:grid-cols-[230px_1fr] md:gap-10">
        <aside className="min-w-0 md:sticky md:top-5 md:self-start">
          <ol className="flex gap-1 overflow-x-auto md:flex-col md:gap-0">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex items-baseline gap-2 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm md:w-full md:rounded-none md:border-0 md:border-l-2 md:px-4 md:py-2.5 md:text-left ${
                    i === step
                      ? "border-paper bg-paper font-semibold text-ink md:bg-transparent md:text-paper"
                      : i < step
                        ? "border-line text-paper hover:border-paper"
                        : "cursor-default border-line text-mute"
                  }`}
                >
                  <span className={`font-mono text-xs ${i === step ? "" : "text-mute"}`}>{i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-7 hidden border-t border-line pt-5 md:block">
            <h3 className="mb-1.5 text-[13px] text-mute">Or start from a template</h3>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                aria-pressed={template === t.id}
                onClick={() => applyTemplate(t.id)}
                className={`block w-full py-2 text-left text-sm hover:underline hover:underline-offset-4 ${template === t.id ? "underline underline-offset-4" : ""}`}
              >
                {t.name}
                <span className="block text-xs text-mute">{t.blurb}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          {step === 0 && (
            <>
              <H2>How do you want to make it?</H2>
              <Lede>Free models train on your own Kaggle GPU. Pro trains on Zebrain&apos;s GPUs, and you see the exact price before you pay.</Lede>
              <PlanStep plan={plan} setPlan={setPlan} status={status} />
            </>
          )}

          {step === 1 && (
            <>
              <H2>Choose a base model</H2>
              {description && (
                <p className="mb-3 max-w-[62ch] border-l-2 border-line pl-3 text-sm">{description}</p>
              )}
              <Lede>
                {isPro
                  ? "All of these talk well out of the box; training teaches them your job. Up to 9B on Pro, 14B on Pro Extreme."
                  : `All of these talk well out of the box; training teaches them your job. Free plans fit models up to ${maxParams}B on Kaggle's T4. Times are rough estimates there.`}
              </Lede>
              <div className="mb-6 rounded-xl border border-line p-4">
                <label htmlFor="spec" className="label">Describe what it should do, and we&apos;ll pick the model</label>
                <textarea id="spec" className="input min-h-[72px]" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="A support assistant for my shop that chats in English, Hindi and Tamil and answers from our policy PDFs." />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button className="btn-ghost" onClick={recommend} disabled={selecting || !(description || purpose)}>{selecting ? "Checking models…" : "Recommend a model"}</button>
                  <span className="text-xs text-mute">Mention the languages, any long documents, and whether you want best quality or speed.</span>
                </div>
                {selection && (
                  <div className="mt-4 text-sm" aria-live="polite">
                    {selection.blueprint.source === "qwen" ? (
                      <div className="mb-3">
                        <p>{selection.blueprint.summary}</p>
                        {selection.blueprint.questions.length > 0 && (
                          <div className="mt-2 border-l-2 border-accent pl-3">
                            <p className="font-medium">Zebrain AI needs a bit more detail. Add the answers to your description and press Recommend again:</p>
                            <ul className="mt-1 list-disc pl-5 text-mute">{selection.blueprint.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                          </div>
                        )}
                        {selection.blueprint.topics.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-mute">{selection.blueprint.topics.length} topics the training data will cover</summary>
                            <ul className="mt-2 space-y-1 text-mute">{selection.blueprint.topics.map((t) => <li key={t.topic}><span className="text-paper">{t.topic}</span>: {t.cover}</li>)}</ul>
                          </details>
                        )}
                        {selection.blueprint.sensitive && <p className="mt-2 text-mute">This job gives advice where mistakes matter, so its answers will add a short disclaimer and point to a professional when needed.</p>}
                      </div>
                    ) : (
                      <p className="mb-2 text-xs text-mute">Read from your words (AI planning turns on once it's connected and you're signed in).</p>
                    )}
                    <p className="text-mute">
                      Understood: {selection.spec.languages.join(", ")} · {selection.spec.priority === "quality" ? "best quality" : selection.spec.priority === "speed" ? "speed first" : "balanced"}
                      {selection.spec.minContext > 8000 ? ` · ${Math.round(selection.spec.minContext / 1000)}K context` : ""}
                      {selection.spec.inputs.length > 1 ? ` · ${selection.spec.inputs.join(" + ")} input` : ""}
                    </p>
                    <p className="mt-2">{selection.pick ? <>Recommended: <strong>{selection.pick.name}</strong>. </> : null}{selection.explanation}</p>
                    {selection.candidates.some((c) => !c.eligible) && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-mute">Why not the others</summary>
                        <ul className="mt-2 space-y-1 text-mute">
                          {selection.candidates.filter((c) => !c.eligible).map((c) => <li key={c.id}>{c.name}: {c.failures.join("; ")}</li>)}
                        </ul>
                      </details>
                    )}
                    {selection.quotes && (
                      <p className="mt-2">
                        Pro price for this pick:{" "}
                        {(["standard", "extreme"] as const).map((k, i) => {
                          const q = selection.quotes![k];
                          return <span key={k}>{i ? " · " : ""}{k === "standard" ? "Standard" : "Extreme"} {q && !("error" in q) ? `$${q.price.toFixed(2)}` : "not available"}</span>;
                        })}
                        <span className="text-mute"> (free plans stay free)</span>
                      </p>
                    )}
                    <p className="mt-2 text-xs text-mute">Language support comes from each model&apos;s card (checked {selection.registryVersion}); it isn&apos;t a measured fluency score.</p>
                  </div>
                )}
              </div>
              <div className="mb-5 flex flex-wrap gap-2 md:hidden">
                {TEMPLATES.map((t) => (
                  <button key={t.id} aria-pressed={template === t.id} onClick={() => applyTemplate(t.id)} className={`chip ${template === t.id ? "chip-on" : ""}`}>{t.name}</button>
                ))}
              </div>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-[13px] text-mute">
                      {["Model", "Size", "Good for", "License", "Train time"].map((h) => (
                        <th key={h} className="border-b border-line px-4 py-3 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BASE_MODELS.map((m) => {
                      const on = m.id === model;
                      const tooBig = paramsOf(m.size) > maxParams;
                      const pick = () => !tooBig && setModel(m.id);
                      return (
                        <tr
                          key={m.id}
                          tabIndex={tooBig ? -1 : 0}
                          aria-disabled={tooBig}
                          title={tooBig ? `${PLANS[plan].name} trains models up to ${maxParams}B. Pro Extreme goes to 14B.` : undefined}
                          onClick={pick}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick())}
                          className={tooBig ? "cursor-not-allowed opacity-40" : `cursor-pointer ${on ? "bg-paper text-ink" : "hover:bg-panel"}`}
                        >
                          <td className="border-b border-line px-4 py-3.5">
                            {m.name}
                            <div className={`font-mono text-xs ${on ? "text-neutral-600" : "text-mute"}`}>
                              {m.id}{m.gated ? " · needs access" : ""}
                            </div>
                          </td>
                          <td className="border-b border-line px-4 py-3.5 font-mono tabular-nums">{m.size}</td>
                          <td className="border-b border-line px-4 py-3.5">{m.goodFor}</td>
                          <td className={`border-b border-line px-4 py-3.5 font-mono text-xs ${on ? "text-neutral-600" : "text-mute"}`}>{m.license}</td>
                          <td className="border-b border-line px-4 py-3.5 font-mono text-xs tabular-nums">{m.t4Minutes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {base.gated && (
                <p className="mt-3 text-sm text-mute">
                  This model is gated. Open{" "}
                  <a className="link" href={`https://huggingface.co/${base.id}`} target="_blank" rel="noreferrer">its page</a>{" "}
                  and accept the terms with the same account before training.
                  {isLlama && " Llama's licence also requires a published fine-tune to start its name with “Llama” and show “Built with Llama”, so the repo name gets a llama- prefix."}
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <H2>What is it for?</H2>
              <Lede>This shapes the data suggestions and how the model introduces itself.</Lede>
              <div className="mb-5 flex flex-wrap gap-2">
                {PURPOSES.map((p) => (
                  <button key={p.label} aria-pressed={purpose === p.label} onClick={() => setPurpose(p.label)} className={`chip ${purpose === p.label ? "chip-on" : ""}`}>{p.label}</button>
                ))}
              </div>
              <Field label="Describe the job in a sentence or two" id="desc">
                <textarea id="desc" className="input min-h-[100px]" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="A coding assistant that writes clean Tailwind components for my Next.js apps." />
              </Field>
              <h3 className="mb-1 mt-8 font-semibold">How it introduces itself</h3>
              <p className="mb-4 text-sm text-mute">Asked &ldquo;who are you?&rdquo;, the model answers with these.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Model name (required)" id="idn"><input id="idn" required aria-required="true" className="input" value={idName} onChange={(e) => setIdName(e.target.value)} placeholder="Vertex Coder" /></Field>
                <Field label="Built by" id="idm"><input id="idm" className="input" value={idMaker} onChange={(e) => setIdMaker(e.target.value)} placeholder="Vertex Labs, India" /></Field>
                <Field label="Founder (optional)" id="idf"><input id="idf" className="input" value={idFounder} onChange={(e) => setIdFounder(e.target.value)} placeholder="Sreyaas Komrewar" /></Field>
              </div>
            </>
          )}

          {step === 3 && plan === "basic" && (
            <DataStep purpose={purpose} description={description} templateId={template} datasets={datasets} setDatasets={setDatasets} setEvalSet={setEvalSet} />
          )}
          {step === 3 && plan !== "basic" && (
            <>
              <H2>What should it learn from?</H2>
              <Lede>Zebrain AI reads your material, splits it into topics, writes questions a real user would ask, answers them only from your material, and throws out anything it can&apos;t back up. A separate set is held back to test the model.</Lede>
              <DocsUpload docs={docs} setDocs={setDocs} />
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer text-sm">Also train on Hugging Face datasets (optional)</summary>
                <div className="mt-5">
                  <DataStep purpose={purpose} description={description} templateId={template} datasets={datasets} setDatasets={setDatasets} setEvalSet={setEvalSet} />
                </div>
              </details>
            </>
          )}

          {step === 4 && (
            <>
              <H2>{isPro ? "Choose how good, then pay" : "Settings and training"}</H2>
              <Lede>
                {isPro
                  ? "Both prices come from this model and job: the GPU time it needs, the AI work to write its data, and a fixed margin. You pay once for this model."
                  : "Zebrain sends the job to your Kaggle account and runs it on a free T4 GPU. There's no notebook to open and no code to edit."}
              </Lede>
              {isPro && (
                <div className="mb-8">
                  <ProOptions quotes={quotes} plan={plan} setPlan={setPlan} />
                  <p className="mt-3 text-sm text-mute">
                    1 credit = $0.01. {chosen ? `This model costs ${needCredits.toLocaleString()} credits. ` : ""}
                    {balance !== null && <>Your wallet: {balance.toLocaleString()} credits. </>}
                    {shortBy > 0 && <Link className="link text-paper" href="/wallet" target="_blank">Add at least {shortBy.toLocaleString()} credits</Link>}
                  </p>
                  <p className="mt-1 text-xs text-mute">An estimate from modeled GPU speed and AI usage; you're charged this exact amount, never more.</p>
                  <p className="mt-1 text-xs text-paper">Once training starts it can&apos;t be refunded, including if you cancel it.</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Repo name on Hugging Face" id="rn">
                  <input id="rn" className="input font-mono" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder={defaultName} />
                </Field>
                <div className="hidden sm:block" />
                {(plan === "basic" || datasets.length > 0) && <><Field label={`Examples per dataset: ${rows.toLocaleString()}`} id="rows">
                  <input id="rows" type="range" min={500} max={10000} step={500} value={rows} onChange={(e) => setRows(+e.target.value)} className="w-full accent-[#f4f4f2]" />
                </Field>
                <Field label={`Epochs: ${epochs}`} id="ep">
                  <input id="ep" type="range" min={1} max={3} step={1} value={epochs} onChange={(e) => setEpochs(+e.target.value)} className="w-full accent-[#f4f4f2]" />
                </Field></>}
              </div>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2.5"><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-[#f4f4f2]" /> Keep the model private</label>
                {!isPro && <label className="flex items-center gap-2.5"><input type="checkbox" checked={openChat} onChange={(e) => setOpenChat(e.target.checked)} className="accent-[#f4f4f2]" /> Open a chat and API on Kaggle for 1 hour when it&apos;s published</label>}
              </div>
              <p className="mt-4 max-w-[64ch] text-sm text-mute">
                {isPro
                  ? "Training starts on Zebrain's GPU as soon as the payment goes through. Your model publishes to your own Hugging Face account."
                  : "Kaggle gives each account around 30 free GPU hours a week; a 4B model usually takes 1–2 hours. "}
                {!isPro && <Link href="/pricing" className="link text-paper">See Pro prices</Link>}
              </p>

              {datasets.length > 0 && (
                <div className="mt-7" aria-live="polite">
                  <h3 className="mb-2 font-medium">Dataset check</h3>
                  {dsCheck === null ? <p className="text-sm text-mute">Reading the first rows of each dataset…</p> : (
                    <ul className="space-y-1.5 text-sm">
                      {dsCheck.map((r) => (
                        <li key={r.id}>
                          <span className={r.ok === false ? "text-bad" : r.ok ? "text-accent" : "text-mute"}>{r.ok === false ? "✕" : r.ok ? "✓" : "?"}</span>{" "}
                          <span className="font-mono text-[13px]">{r.id}</span>{" "}
                          <span className="text-mute">{r.ok ? `${r.usable} of ${r.scanned} sample rows usable` : r.problem}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {badDatasets.length > 0 && <p role="alert" className="mt-2 text-sm text-bad">Remove the datasets marked ✕ on the Data step: training can&apos;t use them.</p>}
                </div>
              )}

              <div className="mt-7 border-t border-line">
                <dl className="grid text-sm sm:grid-cols-[170px_1fr]">
                  {[
                    ["Base model", model],
                    ["Purpose", purpose],
                    ["Plan", isPro ? (plan === "extreme" ? "Pro Extreme" : "Pro") : PLANS[plan].name],
                    ["Data", [plan !== "basic" && (docs.length ? `Zebrain AI writes it from ${docs.length} document${docs.length > 1 ? "s" : ""}` : "Zebrain AI researches your job on the web and writes it"), ...datasets].filter(Boolean).join(", ") || "–"],
                    ["Method", isPro ? "bf16 LoRA r=16 on Zebrain's GPU" : `QLoRA r=16 on your Kaggle T4 · ${epochs} epoch${epochs > 1 ? "s" : ""}`],
                    ["Tester", plan === "basic" ? "None: Basic trains once and publishes" : "AI-written exam from held-back topics, identity and off-topic checks; retrains up to 2 more rounds; best round published"],
                    ["Publishes to", `huggingface.co/<your account>/${repoName}${isPrivate ? " (private)" : ""}, as v1`],
                  ].map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="border-b border-line pt-3 text-mute sm:py-3 sm:pr-4">{k}</dt>
                      <dd className="min-w-0 break-words border-b border-line pb-3 font-mono text-[13px] sm:py-3">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-6">
                {ready ? (
                  <button className="btn" onClick={train} disabled={starting || badDatasets.length > 0 || (datasets.length > 0 && dsCheck === null) || (isPro && (!chosen || shortBy > 0))}>
                    {starting
                      ? isPro ? "Starting on Zebrain's GPU…" : "Sending to Kaggle…"
                      : isPro
                        ? chosen ? `Use ${needCredits.toLocaleString()} credits and train` : "Use credits and train"
                        : plan === "trial" ? "Start my free trial" : "Train on Kaggle"}
                  </button>
                ) : (
                  <p className="text-sm">
                    <a className="btn mr-3" href="/connect" target="_blank" rel="noreferrer">Connect Kaggle and Hugging Face</a>
                    <span className="text-mute">Opens in a new tab; come back here when it says connected.</span>
                  </p>
                )}
                {startErr && <p role="alert" className="mt-3 max-w-[64ch] text-sm text-[#ff8a80]">{startErr}</p>}
              </div>
            </>
          )}

          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
            {step > 0 ? <button className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button> : <span />}
            {step < 4 && <button className="btn" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button>}
          </div>
        </section>
      </div>
    </main>
  );
}

function DataStep(props: {
  purpose: string;
  description: string;
  templateId: string | null;
  datasets: string[];
  setDatasets: (d: string[]) => void;
  setEvalSet: (t: EvalItem[]) => void;
}) {
  const { purpose, description, templateId, datasets, setDatasets, setEvalSet } = props;
  const [plan, setPlan] = useState<{ picks: { id: string; reason: string }[]; rejected: { id: string; reason: string }[]; model?: string } | null>(null);
  const [planning, setPlanning] = useState(false);

  // Zebrain AI searches Hugging Face, reads sample rows and picks datasets that fit the job.
  async function aiPick() {
    setPlanning(true); setError(""); setPlan(null);
    const d = await api<{ datasets?: { id: string; reason: string }[]; rejected?: { id: string; reason: string }[]; eval_set?: EvalItem[]; model?: string }>(
      "/api/plan", { job: { description: description || purpose, purpose } });
    if (d.datasets?.length) {
      setDatasets([...new Set([...d.datasets.map((p) => p.id), ...datasets])]);
      setPlan({ picks: d.datasets, rejected: d.rejected ?? [], model: d.model });
      if (d.eval_set?.length) setEvalSet(d.eval_set);
    } else {
      setError(d.error || "Couldn't choose datasets automatically. Search below, or pick popular ones.");
    }
    setPlanning(false);
  }
  const [query, setQuery] = useState(PURPOSES.find((p) => p.label === purpose)?.search ?? "instruction");
  const [hits, setHits] = useState<DatasetHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(q: string) {
    setLoading(true); setError("");
    try { setHits(await searchDatasets(q, 20)); }
    catch (e) { setError(e instanceof Error ? e.message : "Search failed"); }
    finally { setLoading(false); }
  }
  async function autoPick() {
    setLoading(true); setError("");
    const t = TEMPLATES.find((x) => x.id === templateId);
    const queries = t?.searches ?? [PURPOSES.find((p) => p.label === purpose)?.search ?? "instruction"];
    try {
      const picks = await suggestDatasets(queries, 3);
      if (!picks.length) setError("No open-licensed matches. Try searching yourself.");
      setDatasets([...new Set([...datasets, ...picks.map((p) => p.id)])]);
      setHits(picks);
    } finally { setLoading(false); }
  }
  useEffect(() => { run(query); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toggle = (id: string) => setDatasets(datasets.includes(id) ? datasets.filter((d) => d !== id) : [...datasets, id]);

  // Paste your own Hugging Face dataset link (or "user/name")
  const [link, setLink] = useState("");
  const [linkMsg, setLinkMsg] = useState("");
  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const id = parseDatasetId(link);
    if (!id) {
      setLinkMsg("Paste a link like huggingface.co/datasets/username/dataset-name, or just username/dataset-name.");
      return;
    }
    if (!datasets.includes(id)) setDatasets([...datasets, id]);
    setLink("");
    try {
      const res = await fetch(`https://huggingface.co/api/datasets/${id}`);
      setLinkMsg(
        res.ok
          ? `Added ${id}.`
          : res.status === 401 || res.status === 403 || res.status === 404
            ? `Added ${id}. It looks private or doesn't exist publicly; private datasets work if your Hugging Face token can read them.`
            : `Added ${id}. Couldn't check it right now (status ${res.status}).`,
      );
    } catch {
      setLinkMsg(`Added ${id}. Couldn't reach Hugging Face to check it.`);
    }
  }

  return (
    <>
      <H2>Training data</H2>
      <Lede>Let AI choose, search Hugging Face yourself, or add your own dataset by link. Before training, Zebrain detects the columns, drops broken or duplicate rows, and converts SQL to the dialect you asked for.</Lede>
      <div className="mb-4 flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run(query); }}>
          <label htmlFor="q" className="sr-only">Search datasets</label>
          <input id="q" className="input min-w-0 flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search datasets" />
          <button className="btn-ghost" type="submit">Search</button>
        </form>
        <button className="btn" onClick={aiPick} disabled={planning || loading}>{planning ? "Reading datasets…" : "Let AI choose"}</button>
      </div>
      <p className="mb-5 text-xs text-mute">
        AI searches Hugging Face, reads real rows from each candidate and picks what fits your job.
        It usually takes 1–4 minutes. If it can't run right now, <button className="link" onClick={autoPick} disabled={loading}>Pick popular open-licensed datasets instead</button>.
      </p>
      {plan && (
        <div className="mb-6 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
          <p className="mb-2 font-medium">AI picked {plan.picks.length} dataset{plan.picks.length > 1 ? "s" : ""}{plan.model ? <span className="font-normal text-mute"> · {plan.model}</span> : null}</p>
          <ul className="space-y-1.5">
            {plan.picks.map((p) => <li key={p.id}><span className="font-mono text-[13px]">{p.id}</span> <span className="text-mute">: {p.reason}</span></li>)}
          </ul>
          {plan.rejected.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-mute">{plan.rejected.length} rejected</summary>
              <ul className="mt-2 space-y-1.5">
                {plan.rejected.map((p) => <li key={p.id}><span className="font-mono text-[13px]">{p.id}</span> <span className="text-mute">: {p.reason}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <form onSubmit={addLink} className="mb-6">
        <label htmlFor="dslink" className="label">Use your own Hugging Face dataset</label>
        <div className="flex flex-wrap gap-2">
          <input id="dslink" className="input min-w-0 flex-1 font-mono text-xs" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="https://huggingface.co/datasets/username/my-training-data" />
          <button className="btn-ghost" type="submit">Add dataset</button>
        </div>
        <p className="mt-2 text-xs text-mute">
          {linkMsg || "Public or private. Rows in chat format (messages) or prompt/response columns work best."}
        </p>
      </form>

      {datasets.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {datasets.map((d) => (
            <button key={d} onClick={() => toggle(d)} className="chip chip-on font-mono text-xs" title="Remove">{d} ✕</button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-mute">{error}</p>}
      <div className="overflow-hidden rounded-md border border-line">
        {loading && <p className="px-4 py-6 text-sm text-mute">Searching Hugging Face…</p>}
        {!loading && hits.map((h) => (
          <label key={h.id} className="grid cursor-pointer grid-cols-[20px_1fr_auto] items-start gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-panel">
            <input type="checkbox" checked={datasets.includes(h.id)} onChange={() => toggle(h.id)} className="mt-1 accent-[#f4f4f2]" />
            <div className="min-w-0">
              <div className="break-all font-mono text-[13px]">{h.id}</div>
              <div className="text-xs text-mute">
                {h.license ?? "no license listed"}{isOpenLicense(h.license) ? "" : " · check before using"}{h.sizeTag ? ` · ${h.sizeTag}` : ""}
              </div>
            </div>
            <div className="whitespace-nowrap text-right font-mono text-xs text-mute">{formatCount(h.downloads)} downloads</div>
          </label>
        ))}
        {!loading && !hits.length && !error && <p className="px-4 py-6 text-sm text-mute">No results.</p>}
      </div>
    </>
  );
}

function parseDatasetId(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^(www\.)?huggingface\.co\//, "").replace(/^hf\.co\//, "");
  s = s.replace(/^datasets\//, "");
  s = s.split(/[?#]/)[0];
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const id = `${parts[0]}/${parts[1]}`;
  return /^[\w.-]+\/[\w.-]+$/.test(id) ? id : null;
}

type Selection = {
  blueprint: {
    source: "qwen" | "rules"; version: string; summary: string; topics: { topic: string; cover: string }[]; refuse: string[];
    sensitive: boolean; datasetNotes: string; questions: string[]; spec: { languages: string[] };
  };
  quotes: { standard: Quote | { error: string } | null; extreme: Quote | { error: string } | null } | null;
  error?: string;
  spec: { languages: string[]; priority: string; minContext: number; inputs: string[]; useCase: string };
  pick: { id: string; name: string } | null;
  candidates: { id: string; name: string; eligible: boolean; failures: string[] }[];
  explanation: string;
  registryVersion: string;
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1.5 text-3xl font-medium leading-tight tracking-tight md:text-4xl [text-wrap:balance]">{children}</h2>;
}
function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mb-7 max-w-[62ch] text-mute">{children}</p>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  );
}
