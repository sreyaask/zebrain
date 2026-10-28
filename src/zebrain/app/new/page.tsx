"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BASE_MODELS, PURPOSES, TEMPLATES } from "@/lib/models";
import { DatasetHit, formatCount, isOpenLicense, searchDatasets, suggestDatasets } from "@/lib/hf";
import type { EvalItem, TrainConfig } from "@/lib/job";
import { Account, api, loadAccount, runHref, startRun } from "@/lib/local";
import { paramsOf, PLANS, type Plan, type Quote } from "@/lib/quote";
import { play } from "@/lib/sound";
import { CardGroup, ErrorNote, Fabs, Icon, Skeleton, type Choice, type IconName } from "../ui";
import { DocsUpload, PlanStep, ProOptions, usePlanStatus } from "./PlanPieces";

// One question per screen. The idea comes first; everything after it is a quick pick.
const STEPS = [
  { id: "describe", label: "Idea", ask: "What should your model do?" },
  { id: "purpose", label: "Purpose", ask: "What kind of model is it?" },
  { id: "style", label: "Style", ask: "Give it a name and a voice" },
  { id: "plan", label: "Plan", ask: "How do you want to make it?" },
  { id: "model", label: "Base model", ask: "Pick the brain to start from" },
  { id: "data", label: "Data", ask: "What should it learn from?" },
  { id: "train", label: "Train", ask: "Ready when you are" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const PURPOSE_CARDS: Record<string, { icon: IconName; desc: string }> = {
  "Coding assistant": { icon: "code", desc: "Writes, fixes and explains code" },
  "SQL assistant": { icon: "database", desc: "Plain English to correct SQL" },
  "Customer support": { icon: "headset", desc: "Answers your customers' questions" },
  Tutor: { icon: "school", desc: "Explains concepts step by step" },
  Writing: { icon: "pen", desc: "Drafts, edits and rewrites text" },
  "Research Q&A": { icon: "search", desc: "Answers questions from sources" },
  "General assistant": { icon: "chat", desc: "Helpful everyday chat" },
};

// How it talks. Added to the job description (so the written data follows it) and to the system prompt.
const STYLES = [
  { value: "auto", title: "Let Zebrain decide", icon: "sparkle", desc: "A tone that fits the job", line: "" },
  { value: "friendly", title: "Friendly", icon: "smile", desc: "Warm, encouraging, plain words", line: "Reply in a warm, friendly tone with plain words." },
  { value: "concise", title: "Concise", icon: "bolt", desc: "Short, straight to the point", line: "Keep replies short and to the point." },
  { value: "detailed", title: "Detailed", icon: "list", desc: "Thorough, step by step", line: "Give thorough, step-by-step answers." },
  { value: "professional", title: "Professional", icon: "briefcase", desc: "Formal and precise", line: "Use a formal, precise, professional tone." },
] as const;
type Style = (typeof STYLES)[number]["value"];

// A first guess at the purpose from the user's own words; they can change it with one tap.
function guessPurpose(text: string): string | null {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\bsql\b|postgres|mysql|database|query/, "SQL assistant"],
    [/support|customer|order|refund|shipping|helpdesk/, "Customer support"],
    [/tutor|teach|student|math|maths|science|syllabus|exam|lesson/, "Tutor"],
    [/code|coding|react|python|javascript|typescript|developer|tailwind/, "Coding assistant"],
    [/write|writing|blog|copy|essay|email|story/, "Writing"],
    [/research|paper|sources|cite|summari[sz]e|invoice|extract/, "Research Q&A"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? null;
}

// Rough speed of a base model on its GPU, from its size.
function speedOf(size: string) {
  const p = paramsOf(size);
  return p <= 4 ? { label: "Fast", bars: 3 } : p <= 9 ? { label: "Steady", bars: 2 } : { label: "Slow", bars: 1 };
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export default function NewModelPage() {
  return (
    <Suspense fallback={<WizardSkeleton />}>
      <NewModel />
    </Suspense>
  );
}

function WizardSkeleton() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10" aria-busy="true">
      <Skeleton className="mb-8 h-1.5 w-full" />
      <Skeleton className="mb-3 h-10 w-2/3" />
      <Skeleton className="mb-8 h-5 w-1/2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
    </main>
  );
}

function NewModel() {
  const params = useSearchParams();
  const [step, setStepRaw] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const cur: StepId = STEPS[step].id;
  const [template, setTemplate] = useState<string | null>(null);
  const [model, setModel] = useState<string>(BASE_MODELS[0].id);
  const [purpose, setPurpose] = useState("Coding assistant");
  const [guessed, setGuessed] = useState(false);
  const purposeTouched = useRef(false); // once the user picks a purpose, stop guessing it
  const [style, setStyle] = useState<Style>("auto");
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
  const { status, error: statusErr, retry: retryStatus } = usePlanStatus();
  const [plan, setPlan] = useState<Plan>("basic");
  const [docs, setDocs] = useState<{ path: string; name: string; bytes: number }[]>([]);
  const [quotes, setQuotes] = useState<{ standard: Quote | { error: string }; extreme: Quote | { error: string } } | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [quoteTry, setQuoteTry] = useState(0);
  const isPro = plan === "standard" || plan === "extreme";
  const heading = useRef<HTMLHeadingElement>(null);

  function setStep(n: number) {
    setDir(n < step ? "back" : "fwd");
    setStepRaw(n);
  }
  // Move focus to the new question so keyboard and screen reader users land on it.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Datasets are checked with the job's own row reader before anything starts (a bad one would waste a GPU run).
  const [dsCheck, setDsCheck] = useState<{ id: string; ok: boolean | null; usable?: number; scanned?: number; problem?: string }[] | null>(null);
  useEffect(() => {
    if (cur !== "train" || !datasets.length) return setDsCheck(null);
    setDsCheck(null);
    api<{ results: { id: string; ok: boolean | null; usable?: number; scanned?: number; problem?: string }[] }>("/api/datasets/check", { ids: datasets })
      .then((d) => setDsCheck(d.results ?? []));
  }, [cur, datasets]);
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
  const [selectErr, setSelectErr] = useState("");
  const recommendedFor = useRef("");
  async function recommend() {
    setSelecting(true);
    setSelectErr("");
    recommendedFor.current = `${description}|${purpose}|${plan}`;
    const d = await api<Selection>("/api/select", { description: description || purpose, purpose, plan, doc_tokens: docTokens });
    if (!d.error) {
      setSelection(d);
      if (d.pick) setModel(d.pick.id);
    } else {
      setSelectErr(d.error);
    }
    setSelecting(false);
  }
  const docTokens = Math.round(docs.reduce((n, d) => n + d.bytes, 0) / 4);
  const maxParams = PLANS[plan === "standard" ? "extreme" : plan].maxParams; // Pro picks Standard/Extreme at the end

  // Reaching the model step, Zebrain recommends one from the user's words without being asked.
  useEffect(() => {
    if (cur === "model" && (description || purpose) && recommendedFor.current !== `${description}|${purpose}|${plan}` && !selecting) recommend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

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
    if (!isPro || cur !== "train") return;
    setQuotes(null);
    setQuoteErr("");
    const c = trainConfig();
    api<{ standard: Quote; extreme: Quote }>("/api/quote", { base_model: model, purpose, doc_tokens: docTokens,
      job: { purpose: c.purpose, blueprint: c.blueprint, selection: c.selection } }).then((d) => (d.error ? setQuoteErr(d.error) : setQuotes(d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, cur, model, purpose, docTokens, selection, quoteTry]);

  // Keys are saved on the Connect page, possibly in another tab: re-check when this tab regains focus.
  useEffect(() => {
    const read = () => {
      loadAccount().then(setAccount);
    };
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, []);

  // Arriving from the home page: ?t= picks a template, ?d= is the user's own description. With a description in
  // hand the idea is already answered, so the flow opens on the next question.
  useEffect(() => {
    const t = params.get("t");
    const d = params.get("d");
    if (t && TEMPLATES.some((x) => x.id === t)) applyTemplate(t);
    if (d) {
      setDescription(d);
      if (!t) applyPurposeGuess(d);
      setStepRaw(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPurposeGuess(text: string) {
    const g = guessPurpose(text);
    if (g) {
      setPurpose(g);
      setGuessed(true);
    }
  }

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
    setGuessed(false);
    setDescription(t.description);
    setDatasets(t.datasets);
  }

  function trainConfig(): TrainConfig {
    const name = idName.trim() || repoName;
    const styleLine = STYLES.find((s) => s.value === style)?.line ?? "";
    const job = [description.trim() || `A ${purpose.toLowerCase()} made with Zebrain.`, styleLine].filter(Boolean).join(" ");
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
      play("success");
      router.push(runHref(run));
    } catch (e) {
      setStartErr(e instanceof Error ? e.message : "Couldn't start training.");
      setStarting(false);
    }
  }

  const okAt: Record<StepId, boolean> = {
    describe: description.trim().length >= 3,
    purpose: !!purpose,
    style: idName.trim().length >= 2,
    plan: plan !== "trial" || !!status?.trialAvailable,
    model: !!model,
    data: plan === "basic" ? datasets.length > 0 : true,
    train: true,
  };
  const canNext = okAt[cur];
  const firstBlocked = STEPS.findIndex((s) => !okAt[s.id]);
  const canTrain = ready && !starting && badDatasets.length === 0 && !(datasets.length > 0 && dsCheck === null) && !(isPro && (!chosen || shortBy > 0));
  function next() {
    if (!canNext) return play("error");
    if (cur === "describe" && !template && !purposeTouched.current) applyPurposeGuess(description);
    play("step");
    setStep(step + 1);
  }

  // What's been answered so far, as a short thread; tap one to change it.
  const answers: Partial<Record<StepId, string>> = {
    describe: description.trim(),
    purpose,
    style: [idName.trim() || "unnamed", style !== "auto" ? STYLES.find((s) => s.value === style)?.title.toLowerCase() : ""].filter(Boolean).join(" · "),
    plan: isPro ? (plan === "extreme" ? "Pro Extreme" : "Pro") : PLANS[plan].name,
    model: `${base.name} · ${base.size}`,
    data: plan === "basic" ? `${datasets.length} dataset${datasets.length === 1 ? "" : "s"}` : docs.length ? `${docs.length} document${docs.length > 1 ? "s" : ""}` : "web research",
  };

  const help = HELP[cur];
  const lastStep = STEPS.length - 1;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-32">
      <Progress step={step} setStep={setStep} />

      {step > 0 && (
        <ol aria-label="Your answers so far" className="mb-8 flex flex-wrap gap-2">
          {STEPS.slice(0, step).map((s, i) => (
            <li key={s.id} className="zb-bubble" style={{ animationDelay: `${i * 40}ms` }}>
              <button type="button" onClick={() => { play("click"); setStep(i); }}
                className="group flex max-w-[22rem] items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-left text-sm transition-colors hover:border-paper/40">
                <span className="shrink-0 text-mute">{s.label}</span>
                <span className="truncate">{answers[s.id]}</span>
                <Icon name="pen" className="h-3.5 w-3.5 shrink-0 text-mute opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                <span className="sr-only">(change)</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <section key={cur} data-dir={dir} className="zb-step" aria-labelledby="step-h">
        <p className="mb-2 flex items-center gap-2 text-sm text-accent">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15"><Icon name="sparkle" className="h-3.5 w-3.5" /></span>
          Zebrain asks
        </p>
        <h1 id="step-h" ref={heading} tabIndex={-1} className="mb-2 text-3xl font-medium leading-tight tracking-tight focus:outline-none md:text-[42px] [text-wrap:balance]">
          {STEPS[step].ask}
        </h1>

        {cur === "describe" && (
          <>
            <Lede>Plain English, any language. Mention your languages, your documents, and whether you want best quality or speed.</Lede>
            <form onSubmit={(e) => { e.preventDefault(); next(); }}>
              <label htmlFor="spec" className="sr-only">Describe your model</label>
              <div className="zb-shell" data-filled={description.length > 0}>
                <div className="relative rounded-[20px] bg-panel">
                  <textarea id="spec" rows={4} autoFocus value={description}
                    onChange={(e) => { setDescription(e.target.value); setTemplate(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); next(); } }}
                    placeholder="A support assistant for my shop that chats in English, Hindi and Tamil and answers from our policy PDFs."
                    className="block w-full resize-none rounded-[20px] bg-transparent px-5 pb-16 pt-4 text-lg leading-relaxed text-paper placeholder:text-mute focus:outline-none" />
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
                    <span className="pl-2 text-xs text-mute">{description ? <>Press <kbd className="font-mono">⌘/Ctrl + Enter</kbd></> : "A sentence or two is plenty"}</span>
                    <button type="submit" disabled={!canNext} aria-label="Continue" className="zb-send grid h-11 w-11 place-items-center rounded-full bg-accent text-white disabled:bg-line disabled:text-mute">
                      <Icon name="arrow" className="zb-arrow h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <h2 className="mb-3 mt-10 text-sm text-mute">Or start from a template</h2>
            <CardGroup
              label="Templates"
              value={template}
              onChange={(id) => applyTemplate(id)}
              options={TEMPLATES.map((t) => ({ value: t.id, title: t.name, desc: t.blurb, icon: PURPOSE_CARDS[t.purpose]?.icon ?? "sparkle" }))}
            />
          </>
        )}

        {cur === "purpose" && (
          <>
            <Lede>{guessed ? "From what you wrote, this looks like the right kind. Change it if not." : "This shapes the data Zebrain finds or writes, and how the model introduces itself."}</Lede>
            <CardGroup
              label="Purpose"
              value={purpose}
              onChange={(v) => { setPurpose(v); setGuessed(false); purposeTouched.current = true; }}
              options={PURPOSES.map((p) => ({
                value: p.label, title: p.label, icon: PURPOSE_CARDS[p.label]?.icon ?? "sparkle", desc: PURPOSE_CARDS[p.label]?.desc,
                flag: guessed && p.label === purpose ? "Zebrain's guess" : undefined,
              }))}
            />
          </>
        )}

        {cur === "style" && (
          <>
            <Lede>Asked &ldquo;who are you?&rdquo;, your model answers with its name. The style sets how it talks.</Lede>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <Field label="Model name" id="idn">
                <input id="idn" required aria-required="true" autoFocus className="input py-3 text-base" value={idName} onChange={(e) => setIdName(e.target.value)} placeholder="Vertex Coder"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }} />
              </Field>
              <Field label="Built by (optional)" id="idm">
                <input id="idm" className="input py-3 text-base" value={idMaker} onChange={(e) => setIdMaker(e.target.value)} placeholder="Vertex Labs, India" />
              </Field>
            </div>
            <details className="-mt-4 mb-8 text-sm">
              <summary className="cursor-pointer text-mute hover:text-paper">Add a founder</summary>
              <div className="mt-3 max-w-sm">
                <Field label="Founder (optional)" id="idf"><input id="idf" className="input" value={idFounder} onChange={(e) => setIdFounder(e.target.value)} placeholder="Sreyaas Komrewar" /></Field>
              </div>
            </details>
            <h2 className="mb-3 font-medium">Style</h2>
            <CardGroup label="Style" value={style} onChange={setStyle}
              options={STYLES.map((s) => ({ value: s.value, title: s.title, desc: s.desc, icon: s.icon }))} />
          </>
        )}

        {cur === "plan" && (
          <>
            <Lede>Free models train on your own Kaggle GPU. Pro trains on Zebrain&apos;s GPUs, and you see the exact price before you pay.</Lede>
            {statusErr && !status ? (
              <ErrorNote message={statusErr} onRetry={retryStatus} />
            ) : !status ? (
              <div className="grid gap-3 md:grid-cols-3" aria-busy="true" aria-label="Loading plans">
                {[0, 1, 2].map((i) => <div key={i} className="card"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-16 w-full" /></div>)}
              </div>
            ) : (
              <PlanStep plan={plan} setPlan={setPlan} status={status} />
            )}
          </>
        )}

        {cur === "model" && (
          <>
            <Lede>
              {isPro
                ? "All of these talk well out of the box; training teaches them your job. Up to 9B on Pro, 14B on Pro Extreme."
                : `All of these talk well out of the box; training teaches them your job. Free plans fit models up to ${maxParams}B on Kaggle's T4.`}
            </Lede>
            <ModelAdvice selection={selection} selecting={selecting} error={selectErr} onRetry={recommend} />
            <CardGroup
              label="Base model"
              value={model}
              onChange={setModel}
              options={BASE_MODELS.map((m): Choice<string> => {
                const tooBig = paramsOf(m.size) > maxParams;
                const sp = speedOf(m.size);
                return {
                  value: m.id, title: m.name, icon: "cpu", desc: m.goodFor,
                  flag: selection?.pick?.id === m.id ? "Recommended" : undefined,
                  aside: <span className="font-mono">{m.size}</span>,
                  off: tooBig ? `${PLANS[plan].name} trains models up to ${maxParams}B. Pro Extreme goes to 14B.` : undefined,
                  meta: (
                    <>
                      <span className="badge" title="Speed"><SpeedBars n={sp.bars} /> {sp.label}</span>
                      {!isPro && <span className="badge" title="Training time on a free T4">{m.t4Minutes}</span>}
                      <span className="badge">{m.org}</span>
                      <span className="badge">{m.license}</span>
                    </>
                  ),
                };
              })}
            />
            {base.gated && (
              <p className="mt-4 text-sm text-mute">
                This model is gated. Open{" "}
                <a className="link" href={`https://huggingface.co/${base.id}`} target="_blank" rel="noreferrer">its page</a>{" "}
                and accept the terms with the same account before training.
                {isLlama && " Llama's licence also requires a published fine-tune to start its name with “Llama” and show “Built with Llama”, so the repo name gets a llama- prefix."}
              </p>
            )}
          </>
        )}

        {cur === "data" && plan === "basic" && (
          <DataStep purpose={purpose} description={description} templateId={template} datasets={datasets} setDatasets={setDatasets} setEvalSet={setEvalSet} />
        )}
        {cur === "data" && plan !== "basic" && (
          <>
            <Lede>Zebrain AI reads your material, splits it into topics, writes questions a real user would ask, answers them only from your material, and throws out anything it can&apos;t back up. A separate set is held back to test the model.</Lede>
            <DocsUpload docs={docs} setDocs={setDocs} />
            <details className="rounded-2xl border border-line p-4">
              <summary className="cursor-pointer text-sm">Also train on Hugging Face datasets (optional)</summary>
              <div className="mt-5">
                <DataStep purpose={purpose} description={description} templateId={template} datasets={datasets} setDatasets={setDatasets} setEvalSet={setEvalSet} />
              </div>
            </details>
          </>
        )}

        {cur === "train" && (
          <>
            <Lede>
              {isPro
                ? "Both prices come from this model and job: the GPU time it needs, the AI work to write its data, and a fixed margin. You pay once for this model."
                : "Zebrain sends the job to your Kaggle account and runs it on a free T4 GPU. There's no notebook to open and no code to edit."}
            </Lede>
            {isPro && (
              <div className="mb-8">
                {quoteErr ? <ErrorNote message={quoteErr} onRetry={() => setQuoteTry((n) => n + 1)} /> : <ProOptions quotes={quotes} plan={plan} setPlan={setPlan} />}
                <p className="mt-3 text-sm text-mute">
                  1 credit = $0.01. {chosen ? `This model costs ${needCredits.toLocaleString()} credits. ` : ""}
                  {balance !== null && <>Your wallet: {balance.toLocaleString()} credits. </>}
                  {shortBy > 0 && <Link className="link text-paper" href="/wallet" target="_blank">Add at least {shortBy.toLocaleString()} credits</Link>}
                </p>
                <p className="mt-1 text-xs text-mute">An estimate from modeled GPU speed and AI usage; you&apos;re charged this exact amount, never more.</p>
                <p className="mt-1 text-xs text-paper">Once training starts it can&apos;t be refunded, including if you cancel it.</p>
              </div>
            )}

            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {[
                ["sparkle", "Job", description.trim() || purpose],
                ["chat", "Name and style", answers.style],
                ["cpu", "Base model", `${base.name} · ${base.size}`],
                ["database", "Data", [plan !== "basic" && (docs.length ? `Zebrain AI writes it from ${docs.length} document${docs.length > 1 ? "s" : ""}` : "Zebrain AI researches your job on the web and writes it"), ...datasets].filter(Boolean).join(", ") || "–"],
                ["flask", "Tester", plan === "basic" ? "None: Basic trains once and publishes" : "AI-written exam from held-back topics, identity and off-topic checks; retrains up to 2 more rounds; best round published"],
                ["bolt", "Method", isPro ? "bf16 LoRA r=16 on Zebrain's GPU" : `QLoRA r=16 on your Kaggle T4 · ${epochs} epoch${epochs > 1 ? "s" : ""}`],
              ].map(([icon, k, v]) => (
                <div key={k} className="flex gap-3 rounded-2xl border border-line bg-panel p-4">
                  <span className="card-icon h-9 w-9"><Icon name={icon as IconName} className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0">
                    <p className="text-xs text-mute">{k}</p>
                    <p className="line-clamp-3 break-words text-sm">{v}</p>
                  </div>
                </div>
              ))}
            </div>

            <details className="mb-6 rounded-2xl border border-line p-4" open={!!modelName}>
              <summary className="cursor-pointer text-sm">Settings · publishes to <span className="font-mono">{repoName}</span>{isPrivate ? " (private)" : ""}</summary>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Repo name on Hugging Face" id="rn">
                  <input id="rn" className="input font-mono" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder={defaultName} />
                </Field>
                <div className="hidden sm:block" />
                {(plan === "basic" || datasets.length > 0) && <><Field label={`Examples per dataset: ${rows.toLocaleString()}`} id="rows">
                  <input id="rows" type="range" min={500} max={10000} step={500} value={rows} onChange={(e) => setRows(+e.target.value)} className="w-full accent-accent" />
                </Field>
                <Field label={`Epochs: ${epochs}`} id="ep">
                  <input id="ep" type="range" min={1} max={3} step={1} value={epochs} onChange={(e) => setEpochs(+e.target.value)} className="w-full accent-accent" />
                </Field></>}
              </div>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2.5"><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="h-4 w-4 accent-accent" /> Keep the model private</label>
                {!isPro && <label className="flex items-center gap-2.5"><input type="checkbox" checked={openChat} onChange={(e) => setOpenChat(e.target.checked)} className="h-4 w-4 accent-accent" /> Open a chat and API on Kaggle for 1 hour when it&apos;s published</label>}
              </div>
              <p className="mt-4 text-sm text-mute">Publishes to huggingface.co/&lt;your account&gt;/{repoName}, as v1.</p>
            </details>
            <p className="mb-6 max-w-[64ch] text-sm text-mute">
              {isPro
                ? "Training starts on Zebrain's GPU as soon as the payment goes through. Your model publishes to your own Hugging Face account."
                : "Kaggle gives each account around 30 free GPU hours a week; a 4B model usually takes 1–2 hours. "}
              {!isPro && <Link href="/pricing" className="link text-paper">See Pro prices</Link>}
            </p>

            {datasets.length > 0 && (
              <div className="mb-6" aria-live="polite">
                <h2 className="mb-2 font-medium">Dataset check</h2>
                {dsCheck === null ? (
                  <ul className="space-y-2" aria-label="Reading the first rows of each dataset">{datasets.map((d) => <li key={d}><Skeleton className="h-5 w-3/4" /></li>)}</ul>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {dsCheck.map((r) => (
                      <li key={r.id} className="flex items-start gap-2">
                        <span className={r.ok === false ? "text-bad" : r.ok ? "text-good" : "text-mute"}>
                          {r.ok === false ? <Icon name="x" className="h-4 w-4" /> : r.ok ? <Icon name="check" className="h-4 w-4" /> : "?"}
                          <span className="sr-only">{r.ok === false ? "Can't use" : r.ok ? "OK" : "Unknown"}</span>
                        </span>
                        <span><span className="font-mono text-[13px]">{r.id}</span>{" "}
                          <span className="text-mute">{r.ok ? `${r.usable} of ${r.scanned} sample rows usable` : r.problem}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
                {badDatasets.length > 0 && (
                  <div className="mt-3">
                    <ErrorNote message="Training can't use the datasets marked ✕. Remove them on the Data step." onRetry={() => setStep(STEPS.findIndex((s) => s.id === "data"))} retryLabel="Go to Data" />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {ready ? (
                <button className="btn px-7 py-3.5 text-base" onClick={train} disabled={!canTrain}>
                  <Icon name="rocket" />
                  {starting
                    ? isPro ? "Starting on Zebrain's GPU…" : "Sending to Kaggle…"
                    : isPro
                      ? chosen ? `Use ${needCredits.toLocaleString()} credits and train` : "Use credits and train"
                      : plan === "trial" ? "Start my free trial" : "Train on Kaggle"}
                </button>
              ) : (
                <>
                  <a className="btn" href="/connect" target="_blank" rel="noreferrer">Connect {isPro ? "Hugging Face" : "Kaggle and Hugging Face"}</a>
                  <span className="text-sm text-mute">Opens in a new tab; come back here when it says connected.</span>
                </>
              )}
            </div>
            {startErr && <div className="mt-4"><ErrorNote message={startErr} onRetry={train} /></div>}
          </>
        )}

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 0 ? (
            <button className="btn-ghost" onClick={() => { play("click"); setStep(step - 1); }}><Icon name="back" className="h-4 w-4" /> Back</button>
          ) : <span />}
          {step < lastStep && (
            <button className="btn px-6" disabled={!canNext} onClick={next}>
              {cur === "style" && !idName.trim() ? "Name it to continue" : "Continue"} <Icon name="arrow" className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <Fabs
        help={{ title: help.title, body: help.body }}
        primary={{
          label: cur === "train" ? "Start training" : "Review and train",
          icon: "rocket",
          disabled: cur === "train" ? !canTrain : firstBlocked !== -1 && firstBlocked < lastStep,
          hint: cur === "train" ? undefined : firstBlocked !== -1 && firstBlocked < lastStep ? `Answer “${STEPS[firstBlocked].label}” first` : "Jump to the last step",
          onClick: () => {
            if (cur === "train") return train();
            play("step");
            setStep(lastStep);
          },
        }}
      />
    </main>
  );
}

// The thin bar across the top, with each step a dot you can go back to.
function Progress({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  const pct = (step / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Steps" className="sticky top-0 z-20 -mx-4 mb-8 bg-ink/85 px-4 pb-4 pt-5 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between text-xs text-mute">
        <span>Step {step + 1} of {STEPS.length}</span>
        <span className="text-paper">{STEPS[step].label}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-line">
        <div className="zb-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-[#a5d7ff]" style={{ width: `${pct}%` }} />
        <ol className="absolute inset-0 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button type="button" disabled={i >= step} onClick={() => { play("click"); setStep(i); }}
                aria-current={i === step ? "step" : undefined} aria-label={`${i + 1}. ${s.label}${i < step ? " (done)" : ""}`}
                className={`zb-node block h-3.5 w-3.5 rounded-full border-2 ${i < step ? "border-accent bg-accent" : i === step ? "border-accent bg-ink" : "border-line bg-ink"} disabled:cursor-default`}
                data-state={i === step ? "now" : i < step ? "done" : "todo"} />
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function SpeedBars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((i) => <span key={i} className={`w-1 rounded-sm ${i <= n ? "bg-accent" : "bg-line"}`} style={{ height: 4 + i * 3 }} />)}
    </span>
  );
}

// What Zebrain AI understood and which model it recommends, above the model cards.
function ModelAdvice({ selection, selecting, error, onRetry }: { selection: Selection | null; selecting: boolean; error: string; onRetry: () => void }) {
  if (selecting) {
    return (
      <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/[0.05] p-5" aria-live="polite" aria-busy="true">
        <p className="mb-3 flex items-center gap-2 text-sm"><Icon name="sparkle" className="h-4 w-4 animate-pulse text-accent" /> Zebrain AI is reading your idea and checking every model…</p>
        <Skeleton className="mb-2 h-4 w-5/6" /><Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (error) return <div className="mb-6"><ErrorNote message={`Couldn't recommend a model: ${error} You can still pick one yourself.`} onRetry={onRetry} /></div>;
  if (!selection) return null;
  return (
    <div className="zb-bubble mb-6 rounded-2xl border border-accent/40 bg-accent/[0.05] p-5 text-sm" aria-live="polite">
      {selection.blueprint.source === "qwen" ? (
        <div className="mb-3">
          <p>{selection.blueprint.summary}</p>
          {selection.blueprint.questions.length > 0 && (
            <div className="mt-3 rounded-xl border border-accent/30 p-3">
              <p className="font-medium">Zebrain AI needs a bit more detail. Add the answers to your idea (step 1), then come back:</p>
              <ul className="mt-1 list-disc pl-5 text-mute">{selection.blueprint.questions.map((q) => <li key={q}>{q}</li>)}</ul>
            </div>
          )}
          {selection.blueprint.topics.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-mute">{selection.blueprint.topics.length} topic{selection.blueprint.topics.length === 1 ? "" : "s"} the training data will cover</summary>
              <ul className="mt-2 space-y-1 text-mute">{selection.blueprint.topics.map((t) => <li key={t.topic}><span className="text-paper">{t.topic}</span>: {t.cover}</li>)}</ul>
            </details>
          )}
          {selection.blueprint.sensitive && <p className="mt-2 text-mute">This job gives advice where mistakes matter, so its answers will add a short disclaimer and point to a professional when needed.</p>}
        </div>
      ) : (
        <p className="mb-2 text-xs text-mute">Read from your words (AI planning turns on once it&apos;s connected and you&apos;re signed in).</p>
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
      <button type="button" className="link mt-3 text-xs text-mute" onClick={onRetry}>Recommend again</button>
    </div>
  );
}

// Tips for the help button, per step.
const HELP: Record<StepId, { title: string; body: React.ReactNode }> = {
  describe: { title: "Describing your model", body: <><p>Say who it's for and what it should answer. Mention languages, any documents you have, and whether you want best quality or speed.</p><p>Example: “A support bot for my shoe store, in English and Hindi, answering from our returns policy.”</p></> },
  purpose: { title: "Picking a purpose", body: <p>The purpose decides which datasets Zebrain looks for and how the model describes its job. Pick the closest one; your description fills in the rest.</p> },
  style: { title: "Name and style", body: <><p>The name is how the model introduces itself, and part of the repo name on Hugging Face.</p><p>The style is written into its training data and system prompt, so it talks that way from the first answer.</p></> },
  plan: { title: "Plans", body: <><p><strong className="text-paper">Free trial</strong> and <strong className="text-paper">Basic</strong> train on your own free Kaggle GPU.</p><p><strong className="text-paper">Pro</strong> trains on Zebrain&apos;s GPUs, with a dataset written for your job and an exact price before you pay.</p></> },
  model: { title: "Base models", body: <><p>Smaller models (about 4B) train and answer faster. Bigger ones are smarter but slower.</p><p>Zebrain recommends one from your description; the card marked Recommended is its pick.</p></> },
  data: { title: "Training data", body: <><p>Upload documents and Zebrain AI writes questions and answers from them. No documents? It researches your job on the web.</p><p>On Basic, pick Hugging Face datasets, or let AI choose them.</p></> },
  train: { title: "Before you train", body: <><p>Check the summary, then start. You can watch every step live on the run page, and close the tab: it keeps going.</p><p>Need your accounts connected? <Link className="link text-paper" href="/connect">Connect Kaggle and Hugging Face</Link>.</p></> },
};

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Hugging Face.");
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
      <Lede>Let AI choose, pick popular ones, search Hugging Face yourself, or add your own by link. Before training, Zebrain detects the columns, drops broken or duplicate rows, and converts SQL to the dialect you asked for.</Lede>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <button type="button" className="card" onClick={() => { play("click"); aiPick(); }} disabled={planning || loading}>
          <span className="flex items-center gap-3">
            <span className={`card-icon ${planning ? "animate-pulse" : ""}`}><Icon name="sparkle" /></span>
            <span className="text-[17px] font-medium">{planning ? "Reading datasets…" : "Let AI choose"}</span>
          </span>
          <span className="text-sm text-mute">AI searches Hugging Face, reads real rows from each candidate and picks what fits your job. Usually 1–4 minutes.</span>
        </button>
        <button type="button" className="card" onClick={() => { play("click"); autoPick(); }} disabled={planning || loading}>
          <span className="flex items-center gap-3">
            <span className="card-icon"><Icon name="bolt" /></span>
            <span className="text-[17px] font-medium">Pick popular ones</span>
          </span>
          <span className="text-sm text-mute">Instantly adds the most-downloaded open-licensed datasets for this kind of model.</span>
        </button>
      </div>
      {planning && (
        <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/[0.05] p-4" aria-live="polite" aria-busy="true">
          <p className="mb-3 text-sm">Reading sample rows from candidate datasets…</p>
          <Skeleton className="mb-2 h-4 w-3/4" /><Skeleton className="h-4 w-1/2" />
        </div>
      )}
      {plan && (
        <div className="zb-bubble mb-6 rounded-2xl border border-accent/40 bg-accent/5 p-4 text-sm">
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

      {datasets.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm text-mute">Training on {datasets.length} dataset{datasets.length > 1 ? "s" : ""}</h2>
          <ul className="flex flex-wrap gap-2">
            {datasets.map((d) => (
              <li key={d} className="zb-bubble">
                <button type="button" onClick={() => { play("click"); toggle(d); }} className="chip chip-on flex items-center gap-1.5 font-mono text-xs" aria-label={`Remove ${d}`}>
                  {d} <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="mb-4"><ErrorNote message={error} onRetry={() => run(query)} retryLabel="Search again" /></div>}

      <div className="mb-3 flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); run(query); }}>
          <label htmlFor="q" className="sr-only">Search datasets</label>
          <div className="relative min-w-0 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            <input id="q" className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Hugging Face datasets" />
          </div>
          <button className="btn-ghost" type="submit">Search</button>
        </form>
      </div>
      <div className="mb-8 overflow-hidden rounded-2xl border border-line" aria-busy={loading}>
        {loading && [0, 1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-[20px_1fr_auto] gap-3.5 border-b border-line px-4 py-4 last:border-b-0">
            <Skeleton className="h-4 w-4" /><div><Skeleton className="mb-2 h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div><Skeleton className="h-3 w-16" />
          </div>
        ))}
        {!loading && hits.map((h) => (
          <label key={h.id} className={`grid cursor-pointer grid-cols-[20px_1fr_auto] items-start gap-3.5 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-panel ${datasets.includes(h.id) ? "bg-accent/[0.06]" : ""}`}>
            <input type="checkbox" checked={datasets.includes(h.id)} onChange={() => { play("click"); toggle(h.id); }} className="mt-1 h-4 w-4 accent-accent" />
            <div className="min-w-0">
              <div className="break-all font-mono text-[13px]">{h.id}</div>
              <div className="text-xs text-mute">
                {h.license ?? "no license listed"}{isOpenLicense(h.license) ? "" : " · check before using"}{h.sizeTag ? ` · ${h.sizeTag}` : ""}
              </div>
            </div>
            <div className="whitespace-nowrap text-right font-mono text-xs text-mute">{formatCount(h.downloads)} downloads</div>
          </label>
        ))}
        {!loading && !hits.length && !error && (
          <div className="flex flex-col items-center px-4 py-10 text-center text-sm text-mute">
            <Icon name="search" className="mb-2 h-6 w-6" />
            No datasets match “{query}”. Try a shorter search, or let AI choose.
          </div>
        )}
      </div>

      <form onSubmit={addLink}>
        <label htmlFor="dslink" className="label">Use your own Hugging Face dataset</label>
        <div className="flex flex-wrap gap-2">
          <input id="dslink" className="input min-w-0 flex-1 font-mono text-xs" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="https://huggingface.co/datasets/username/my-training-data" />
          <button className="btn-ghost" type="submit">Add dataset</button>
        </div>
        <p className="mt-2 text-xs text-mute" aria-live="polite">
          {linkMsg || "Public or private. Rows in chat format (messages) or prompt/response columns work best."}
        </p>
      </form>
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

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mb-7 max-w-[62ch] text-base text-mute md:text-lg">{children}</p>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="label">{label}</label>
      {children}
    </div>
  );
}
