import Link from "next/link";
import DescribeForm from "./DescribeForm";
import { Decode, Reveal, Rise, RunDemo, Track } from "./Motion";
import { BASE_MODELS } from "@/lib/models";
import { paramsOf, quote, USE_CASES, type UseCase } from "@/lib/quote";
import { CONTACT_EMAIL } from "@/lib/pricing";

// The cheapest Pro price the formula gives, so the FAQ never quotes a stale number.
function proFrom() {
  let min = Infinity;
  for (const m of BASE_MODELS) for (const u of Object.keys(USE_CASES) as UseCase[]) {
    try {
      min = Math.min(min, quote({ plan: "standard", useCase: u, params: paramsOf(m.size) }).price);
    } catch {}
  }
  return `$${min.toFixed(2)}`;
}

// The steps of a run, with what each looks like for a shoe shop's support bot.
const RUN = [
  { step: "Describe it", detail: "Plain English, any language. Mention your languages, your documents, and whether you want best quality or speed.", example: "“A support bot for my shoe store, in English and Hindi.”" },
  { step: "Our AI plans it", detail: "Zebrain AI reads your words and plans the job: languages, topics to cover, what to refuse. Zebrain picks the base model that fits and shows the price.", example: "Qwen3.5 4B · 2 languages · 8 topics" },
  { step: "Our AI writes the data", detail: "From your documents, or from web research if you have none. Every answer is checked against the source; anything it can't back up is thrown out.", example: "2,250 checked examples from faq.pdf" },
  { step: "Train", detail: "Free on your own Kaggle GPU, or on Zebrain's GPUs with Pro. Progress saves as it goes, so a stopped run picks up where it left off.", example: "about 1–2 hours on a free T4" },
  { step: "Test, then publish", detail: "A tester asks questions it never trained on. If it falls short, it trains again. The best version goes to your own Hugging Face account.", example: "27 of 30 right · you/stepup-support-4b" },
  { step: "Chat and fix", detail: "Chat with it here and call its API. If it gets something wrong, type the right answer and Zebrain retrains from that version.", example: "/chat · /fix" },
];

export default function Home() {
  const FAQ = [
    ["What is Zebrain?", "A website that makes your own AI model. You describe the job; Zebrain AI plans it and writes the training data; Zebrain fine-tunes an open model, tests it and publishes it to your own Hugging Face account."],
    ["Do I need to code or own a GPU?", "No. Free models train on your own free Kaggle GPU, which Zebrain starts for you. Pro models train on Zebrain's GPUs. You never open a notebook."],
    ["Is it free?", `Your first model is a free trial, with Zebrain AI writing its data. Basic is always free on your Kaggle GPU. Pro starts at ${proFrom()} per model, priced from your exact job before you pay.`],
    ["Which languages does it speak?", "The models Zebrain uses cover English and many more, including Hindi, Tamil and Telugu on their model cards. Tell us your languages and the planner picks a model that lists them."],
    ["Who owns the model?", "You do. It's published to your own Hugging Face account, private by default. You can download it and run it anywhere."],
    ["Can my app use it?", "Yes. While it runs on your Kaggle GPU it has an API with a key, which your website or app can call."],
  ];
  return (
    <>
      <section className="beam beam-drift -mt-[60px] px-4 pb-16 pt-[60px]">
        <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center pt-24 text-center">
          <h1 className="mb-6 text-[36px] font-medium leading-[1.12] tracking-tight sm:text-5xl md:text-[68px]">
            <Rise words={["Make", "your", "own"]} /> <span className="zb-word whitespace-nowrap" style={{ animationDelay: "210ms" }}><Decode text="LLM" delay={350} />.</span>
            <br />
            <span className="zb-word" style={{ animationDelay: "420ms" }}><Decode text="Keep" delay={600} /></span> <Rise words={["it."]} delay={500} />
          </h1>
          <p className="zb-fade mb-10 max-w-[50ch] text-base text-paper/75 sm:text-lg" style={{ animationDelay: "650ms" }}>
            Say what your model should do. Our AI plans it and writes its training data, it trains on a free GPU or ours,
            gets tested, and lands in your own Hugging Face account.
          </p>
          <div className="zb-fade w-full max-w-xl" style={{ animationDelay: "800ms" }}>
            <DescribeForm />
          </div>
        </div>
        <div className="zb-fade mx-auto flex max-w-xl justify-center" style={{ animationDelay: "1000ms" }}>
          <RunDemo />
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4">
        <section className="border-t border-line py-14 md:py-20" aria-labelledby="run">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2 id="run" className="text-3xl font-medium tracking-tight">How a model gets <span className="pixel">made</span></h2>
            <p className="text-sm text-mute">Example: a support bot for a shoe shop</p>
          </div>
          <ol className="relative">
            <Track />
            {RUN.map((r, i) => (
              <Reveal as="li" key={r.step} index={i} className="grid grid-cols-[1.5rem_1fr] gap-x-3 gap-y-1 border-t border-line py-5 md:grid-cols-[2rem_13rem_1fr_17rem] md:gap-x-6">
                <span className="relative pt-0.5 font-pixel text-sm text-accent">{i + 1}</span>
                <h3 className="font-medium">{r.step}</h3>
                <p className="col-start-2 max-w-[56ch] text-sm text-mute md:col-start-auto">{r.detail}</p>
                <p className="col-start-2 mt-2 font-mono text-[13px] md:col-start-auto md:mt-0">{r.example}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/new" className="btn">Make your model</Link>
            <Link href="/pricing" className="btn-ghost">See prices</Link>
          </div>
        </section>

        <section className="grid gap-10 border-t border-line py-14 md:grid-cols-[1fr_1.4fr] md:py-20" aria-labelledby="faq">
          <div>
            <h2 id="faq" className="mb-3 text-3xl font-medium tracking-tight">Questions? We&apos;ve got <span className="pixel">answers</span>.</h2>
            <p className="max-w-[40ch] text-sm text-mute">
              Anything else, or want us to build a model for your business? <Link href="/pricing#business" className="link text-paper">Get in touch</Link>.
            </p>
          </div>
          <div>
            {FAQ.map(([q, a]) => (
              <details key={q} className="group border-t border-line py-4 last:border-b">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="text-accent transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-[60ch] text-sm text-mute">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-mute">
          <p><span className="text-paper">Zebrain.</span> Made in Hyderabad.</p>
          <nav className="flex flex-wrap gap-5">
            <Link href="/pricing" className="hover:text-paper">Pricing</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-paper">Contact</a>
            <Link href="/login?mode=signup" className="hover:text-paper">Sign up</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
