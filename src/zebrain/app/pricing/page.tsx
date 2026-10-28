"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BASE_MODELS } from "@/lib/models";
import { paramsOf, PLANS, quote, QuoteError, USE_CASES, type Quote, type UseCase } from "@/lib/quote";
import { BOOK_MEETING_URL, CONTACT_EMAIL, CREDIT_PACKS, usd } from "@/lib/pricing";

// The lowest price the formula gives on a plan, across every base model and job (one language, no documents).
function cheapest(plan: "standard" | "extreme") {
  let min = Infinity;
  for (const m of BASE_MODELS) for (const u of Object.keys(USE_CASES) as UseCase[]) {
    try {
      min = Math.min(min, quote({ plan, useCase: u, params: paramsOf(m.size) }).price);
    } catch {}
  }
  return min;
}

// The four ways to make a model, cheapest first. Pro prices come from the formula, never typed in by hand.
const PLAN_ROWS = [
  {
    name: "Free trial", price: "Free", per: "your first model, once",
    gpu: "Your Kaggle GPU", size: `Up to ${PLANS.trial.maxParams}B`,
    points: ["Zebrain AI writes the dataset from your documents or the web", "Tested before it's published", "No card needed"],
  },
  {
    name: "Basic", price: "Free", per: "every time",
    gpu: "Your Kaggle GPU (about 30 free hours a week)", size: `Up to ${PLANS.basic.maxParams}B`,
    points: ["AI picks existing public datasets for your job", "Trains once and publishes, no testing round"],
  },
  {
    name: "Pro", price: `From ${usd(cheapest("standard"))}`, per: "per model, from credits",
    gpu: "Zebrain's GPUs, full precision", size: `Up to ${PLANS.standard.maxParams}B`,
    points: ["Zebrain AI writes a dataset just for your job", "Tested, and retrained if it falls short", "Price shown before you pay"],
  },
  {
    name: "Pro Extreme", price: `From ${usd(cheapest("extreme"))}`, per: "per model, from credits",
    gpu: "Zebrain's GPUs, full precision", size: `Up to ${PLANS.extreme.maxParams}B`,
    points: ["About four times the data", "Stricter quality checks", "Bigger models for harder jobs"],
  },
];

const WORDS = [
  ["Parameters (4B, 9B…)", "How big the model's “brain” is, in billions. Bigger models answer better but train and reply more slowly."],
  ["Credit", "What Pro is paid with. 1 credit = $0.01, so a $5.99 model uses 599 credits."],
  ["Zebrain AI", "Our AI that writes your training data: it reads your material, writes questions, answers them and checks every answer."],
  ["Kaggle GPU", "A free graphics chip from Kaggle (Google). Free plans train on your own Kaggle account."],
  ["API", "A web address your app can send questions to, so your model answers inside your own product."],
];

const COMPARE = [
  ["Who owns it", "OpenAI or Google. They can change the price, the model or the rules.", "You. It's published to your own Hugging Face account, and you can take it anywhere."],
  ["What it knows about you", "Only what you paste into the chat each time.", "Your examples, trained in, so it answers your way and stays on topic."],
  ["Where chats go", "To their servers, under their terms.", "To your model, on your GPU. Zebrain doesn't keep your chats."],
  ["Cost", "A monthly subscription per person.", "Free on your own GPU, or a one-off price per model on Pro."],
];

const LANG_OPTIONS = [1, 2, 3, 4, 5];

export default function Pricing() {
  const [useCase, setUseCase] = useState<UseCase>("support");
  const [model, setModel] = useState("Qwen/Qwen3.5-4B");
  const [languages, setLanguages] = useState(1);
  const [sensitive, setSensitive] = useState(false);
  const params = paramsOf(BASE_MODELS.find((m) => m.id === model)?.size ?? "4B");
  const prices = useMemo(() => {
    const one = (plan: "standard" | "extreme"): Quote | { error: string } => {
      try {
        return quote({ plan, useCase, params, languages, sensitive });
      } catch (e) {
        return { error: e instanceof QuoteError ? e.message : "Not available" };
      }
    };
    return { standard: one("standard"), extreme: one("extreme") };
  }, [useCase, params, languages, sensitive]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20">
      <header className="pb-10 pt-14 md:pt-20">
        <h1 className="mb-4 text-5xl font-medium tracking-tight md:text-6xl">Pricing</h1>
        <p className="max-w-[58ch] text-lg text-mute">
          Make models free on your own Kaggle GPU, or let Zebrain build them on ours. You only pay for Pro: once per model,
          at a price worked out from your exact job and shown before you pay.
        </p>
      </header>

      <section aria-labelledby="plans-h" className="border-t border-line py-10">
        <h2 id="plans-h" className="mb-6 text-3xl font-medium tracking-tight">Ways to make a model</h2>
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ROWS.map((p) => (
            <article key={p.name} className="flex flex-col bg-ink p-5">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-3 text-3xl font-medium tabular-nums tracking-tight">{p.price}</p>
              <p className="text-sm text-mute">{p.per}</p>
              <dl className="mt-4 space-y-1 text-sm">
                <div><dt className="inline text-mute">Trains on: </dt><dd className="inline">{p.gpu}</dd></div>
                <div><dt className="inline text-mute">Models: </dt><dd className="inline">{p.size}</dd></div>
              </dl>
              <ul className="mt-4 space-y-1.5 text-sm text-mute">
                {p.points.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-mute">Every model is published to your own Hugging Face account, and you can chat with it on this site.</p>
      </section>

      <section id="calculator" aria-labelledby="calc-h" className="scroll-mt-4 border-t border-line py-10">
        <h2 id="calc-h" className="mb-2 text-3xl font-medium tracking-tight">What would Pro cost for my model?</h2>
        <p className="mb-8 max-w-[64ch] text-mute">
          The same formula checkout uses: the GPU your model needs, the AI work to write its data, and a fixed margin.
          More languages need more examples, so they cost more.
        </p>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <fieldset>
              <legend className="label">What it does</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(USE_CASES) as UseCase[]).map((u) => (
                  <button key={u} type="button" aria-pressed={useCase === u} onClick={() => setUseCase(u)} className={`chip ${useCase === u ? "chip-on" : ""}`}>
                    {USE_CASES[u].label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Base model</legend>
              <div className="flex flex-wrap gap-2">
                {BASE_MODELS.map((m) => (
                  <button key={m.id} type="button" aria-pressed={model === m.id} onClick={() => setModel(m.id)} className={`chip ${model === m.id ? "chip-on" : ""}`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Languages it must speak</legend>
              <div className="flex flex-wrap gap-2">
                {LANG_OPTIONS.map((n) => (
                  <button key={n} type="button" aria-pressed={languages === n} onClick={() => setLanguages(n)} className={`chip tabular-nums ${languages === n ? "chip-on" : ""}`}>
                    {n === 5 ? "5+" : n}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={sensitive} onChange={(e) => setSensitive(e.target.checked)} className="h-4 w-4 accent-accent" />
              Gives legal, medical or financial information (adds the strict quality check)
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
            {(["standard", "extreme"] as const).map((k) => {
              const q = prices[k];
              return (
                <div key={k} className={`rounded-xl border p-5 ${k === "extreme" ? "border-accent/60" : "border-line"}`}>
                  <p className="text-sm text-mute">{k === "standard" ? "Pro" : "Pro Extreme"}</p>
                  {"error" in q ? (
                    <p className="mt-2 text-sm">{q.error}</p>
                  ) : (
                    <>
                      <p className="mt-1 text-4xl font-medium tabular-nums tracking-tight">{usd(q.price)}</p>
                      <p className="text-sm text-mute tabular-nums">{Math.round(q.price * 100).toLocaleString()} credits</p>
                      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-mute">Examples</dt><dd className="tabular-nums">{q.examples.toLocaleString()}</dd>
                        <dt className="text-mute">GPU</dt><dd>{q.gpu.count > 1 ? `${q.gpu.count} × ` : ""}{q.gpu.name}</dd>
                        <dt className="text-mute">Training</dt><dd className="tabular-nums">about {Math.max(1, Math.round(q.gpu.hours * 60))} min</dd>
                      </dl>
                    </>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-mute sm:col-span-2">
              Estimates without uploaded documents. Your exact price, including your documents, is shown before you pay,
              and you're never charged more. Once a run starts it can't be refunded, including if you cancel it.
            </p>
          </div>
        </div>
      </section>

      <section id="credits" aria-labelledby="credits-h" className="scroll-mt-4 border-t border-line py-10">
        <h2 id="credits-h" className="mb-2 text-3xl font-medium tracking-tight">Credits</h2>
        <p className="mb-6 max-w-[64ch] text-mute">
          Pro models are paid from your wallet. Buy a pack once and use it across as many models as it covers. Prices are
          in US dollars; buyers in India pay in rupees with 18% GST added (UPI, cards, netbanking).
        </p>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <li key={p.id} className="bg-ink p-5">
              <p className="text-3xl font-medium tabular-nums tracking-tight">${p.usd}</p>
              <p className="mt-1 tabular-nums">{(p.credits + p.bonus).toLocaleString()} credits</p>
              <p className="text-sm text-mute">{p.bonus ? `includes ${p.bonus} bonus` : "no bonus"}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm"><Link href="/wallet" className="link">Open your wallet</Link></p>
      </section>

      <section id="chat" aria-labelledby="chat-h" className="scroll-mt-4 border-t border-line py-10">
        <h2 id="chat-h" className="mb-2 text-3xl font-medium tracking-tight">Chatting with your model</h2>
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
          <div className="bg-ink p-5">
            <p className="text-sm text-mute">Now</p>
            <h3 className="mt-1 text-lg font-semibold">Free on your Kaggle GPU</h3>
            <p className="mt-2 text-sm text-mute">
              For personal use. Zebrain starts your model on your own Kaggle GPU for the hours you choose, with a chat on
              this site and an API. Works for every plan, including Pro.
            </p>
          </div>
          <div className="bg-ink p-5">
            <p className="text-sm text-mute">Coming soon</p>
            <h3 className="mt-1 text-lg font-semibold">Always-on hosting</h3>
            <p className="mt-2 text-sm text-mute">
              Your model running all the time on Zebrain&apos;s servers, for your customers and your app. A monthly plan
              priced by model size. Prices will be shown here before it opens.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="change-h" className="border-t border-line py-10">
        <h2 id="change-h" className="mb-2 text-3xl font-medium tracking-tight">What training changes</h2>
        <p className="mb-5 max-w-[64ch] text-sm text-mute">
          The same question for a shoe shop&apos;s support bot, before and after training on the shop&apos;s own answers.
          An illustration: your model learns from the examples it&apos;s trained on.
        </p>
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
          <figure className="bg-ink p-5">
            <figcaption className="mb-3 text-[13px] text-mute">A ready-made model</figcaption>
            <p className="mb-3 font-mono text-[13px] text-mute">Can I return shoes I bought 20 days ago?</p>
            <p className="text-sm">
              Return policies vary from store to store. Many retailers accept returns within 14 to 30 days if the item is
              unused. Please check the store&apos;s website for details.
            </p>
          </figure>
          <figure className="bg-ink p-5">
            <figcaption className="mb-3 text-[13px] text-mute">After training on the shop&apos;s answers</figcaption>
            <p className="mb-3 font-mono text-[13px] text-mute">Can I return shoes I bought 20 days ago?</p>
            <p className="text-sm">
              Yes. You have 30 days from delivery, so you&apos;re still in time. Go to My Orders, choose the pair and tap
              Return. We&apos;ll email you a free pickup slip.
            </p>
          </figure>
        </div>
      </section>

      <section id="business" aria-labelledby="business-h" className="scroll-mt-4 border-t border-line py-10">
        <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
          <div>
            <h2 id="business-h" className="mb-2 text-3xl font-medium tracking-tight">Business: we build it for you</h2>
            <p className="max-w-[60ch] text-mute">
              For shops, clinics, colleges and companies that want their own AI assistant without doing any of this. Tell
              us what it should do and share what it should know: FAQs, documents, product lists. We build it, test it on
              your real questions and set it up for you.
            </p>
          </div>
          <div className="border-t border-paper pt-5 md:self-start">
            <p className="text-3xl font-medium tracking-tight">Priced per project</p>
            <p className="mb-5 mt-2 text-sm text-mute">Depends on the model size and how much it will be used.</p>
            <a href={BOOK_MEETING_URL} className="btn w-full">Email us</a>
            <p className="mt-2 break-all text-xs text-mute">{CONTACT_EMAIL}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-h" className="border-t border-line py-10">
        <h2 id="compare-h" className="mb-2 text-3xl font-medium tracking-tight">Why not just use ChatGPT or Gemini?</h2>
        <p className="mb-8 max-w-[64ch] text-mute">
          For a general assistant for yourself, use them. Zebrain is for when the AI has to do one job your way, or be part
          of your product.
        </p>
        <div role="table" aria-label="ChatGPT or Gemini compared with your own Zebrain model">
          <div role="row" className="hidden border-b border-line pb-3 text-[13px] text-mute md:grid md:grid-cols-[13rem_1fr_1fr] md:gap-x-6">
            <span role="columnheader" />
            <span role="columnheader">ChatGPT or Gemini</span>
            <span role="columnheader">Your Zebrain model</span>
          </div>
          {COMPARE.map(([q, them, us]) => (
            <div key={q} role="row" className="grid gap-y-2 border-b border-line py-4 md:grid-cols-[13rem_1fr_1fr] md:gap-x-6">
              <span role="rowheader" className="font-semibold">{q}</span>
              <span role="cell" className="text-sm text-mute"><span className="block text-xs md:hidden">ChatGPT or Gemini</span>{them}</span>
              <span role="cell" className="text-sm"><span className="block text-xs text-mute md:hidden">Your Zebrain model</span>{us}</span>
            </div>
          ))}
        </div>

        <h3 className="mb-4 mt-12 text-lg font-semibold">Words on this page</h3>
        <dl className="grid max-w-4xl gap-x-10 gap-y-1 md:grid-cols-[13rem_1fr] md:gap-y-4">
          {WORDS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="mt-3 font-semibold md:mt-0">{k}</dt>
              <dd className="text-sm text-mute md:text-base">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
