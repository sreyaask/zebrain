# Dataset size for task-specific LoRA fine-tunes of small instruct models (1.5B–14B): Standard vs Extreme tiers, and synthetic-generation token budgets

Scope note: about 15 tool calls. Several primary sources (Google Vertex docs, LIMA figure values, the Deita tables, the LoRA Learns Less recommendations section) came back only as abstracts or navigation pages, so a few numbers below are flagged as gaps or labelled as my own inference. Peer-reviewed or arXiv results are marked [paper]. Vendor docs are [vendor]. Practitioner write-ups are [anecdote].

## 1. What the literature and guides say about example counts vs quality

### Takeaway
For style, format and alignment-type behaviour, roughly 1,000 high-quality, diverse examples is enough, and adding more gives little. Narrow classification and extraction tasks show gains from about 50–100 examples (vendor guidance). Skill-heavy tasks (code, math, SQL) keep improving with more data, into the tens of thousands. Quality and diversity filtering repeatedly beats raw volume: 6K–9K curated examples match or beat 52K+ uncurated ones.

### Cited Findings
- [paper] LIMA: a 65B LLaMa fine-tuned on "only 1,000 carefully curated prompts and responses", with no RLHF. Its responses were equivalent to or preferred over GPT-4's in 43% of cases, over Bard in 58% and over DaVinci003 in 65%. — [LIMA, arXiv 2305.11206](https://arxiv.org/abs/2305.11206)
- [paper] LIMA quantity ablation: performance plateaus across a 16x increase in (Stack Exchange) training data, and doubling the training set does not improve response quality. At an equal 2,000 examples, the diverse Stack Exchange set significantly beats the homogeneous wikiHow set. Quality filtering is worth about 0.5 points on a 1–6 helpfulness scale. — [LIMA full text](https://arxiv.org/html/2305.11206)
- [paper] LIMA: adding just 30 multi-turn dialogue examples (1,030 in total) raised excellent responses from 45.2% to 76.1% in dialogue. A small number of targeted examples can unlock a whole behaviour. — [LIMA full text](https://arxiv.org/html/2305.11206)
- [paper] AlpaGasus: a ChatGPT judge filtered Alpaca's 52k examples down to 9k (about 17% kept). The filtered model significantly outperforms the original Alpaca. The 13B version reaches over 90% of its teacher's (Text-Davinci-003) performance. 7B training time fell from 80 to 14 minutes. — [AlpaGasus, arXiv 2307.08701](https://arxiv.org/abs/2307.08701)
- [paper] Deita: 6K automatically selected SFT samples (plus 10K DPO samples for the Mistral variant) match or beat open alignment models trained on more than 10x as much data. MT-Bench 7.55, AlpacaEval 90.06%. — [Deita, arXiv 2312.15685](https://arxiv.org/abs/2312.15685)
- [paper] Dong et al., "How Abilities in LLMs are Affected by SFT Data Composition": math reasoning and code generation keep improving as SFT data grows, but general abilities plateau after "roughly a thousand samples". Larger models do better with the same data. Mixing data sources helps in low-data regimes but causes conflicts in high-data regimes. Learning skills sequentially risks catastrophic forgetting. — [arXiv 2310.05492](https://arxiv.org/abs/2310.05492)
- [paper] Self-Instruct: on the user-oriented eval, performance improves with data but plateaus at about 16K instructions. On SuperNI (more narrow, task-like), gains plateau much earlier, at hundreds of instructions. Regenerating outputs with a stronger model gave a 10% improvement, so output quality matters as much as count. — [Self-Instruct, arXiv 2212.10560](https://arxiv.org/html/2212.10560)
- [paper] "When Scaling Meets LLM Finetuning" (1B–16B models): fine-tuning quality follows a power-law joint scaling between fine-tuning data size and model size. Scaling LoRA parameters is "generally ineffective", and the best method depends on the task and the amount of data. — [arXiv 2402.17193](https://arxiv.org/abs/2402.17193)
- [vendor] OpenAI: the minimum is 10 examples. "We see improvements from fine-tuning on 50–100 examples." Start with 50 well-crafted demonstrations. If 50 has no effect, rethink the task or prompt before adding data. — [OpenAI SFT guide](https://developers.openai.com/api/docs/guides/supervised-fine-tuning)
- [paper/vendor] Predibase LoRA Land: 310 LoRA (rank 8, 4-bit) fine-tunes of 2B–7B models on 31 tasks averaged 0.756 versus GPT-4's 0.661, about +38.7 points over base. Narrow classification tasks reached about 90%+ accuracy. GPT-4 kept the lead on broad knowledge (MMLU, by 18.5 points) and coding (Magicoder, by 39.6 points). Narrow, low-output-variability tasks benefit most. Note that these used full public train splits (for example WikiSQL 56k, Magicoder 75k, MNLI 393k) and fixed 40k steps at batch 16 (about 640k sequences seen), so this is not a small-data study. — [LoRA Land, arXiv 2405.00732](https://arxiv.org/html/2405.00732v1)
- [vendor blog] Anyscale Llama-2-13B full fine-tunes: ViGGO structured output rose from 58% to 98%. SQL rose from 42% to 89% on a set filtered from about 70k to 45k examples. GSM8k (about 8k examples) rose from 28% to 47%, and a further ~10 points came from pre-training on 30k MathQA. Training ran up to 10 epochs, with the checkpoint chosen by validation perplexity. — [Anyscale case study](https://www.anyscale.com/blog/fine-tuning-llama-2-a-comprehensive-case-study-for-tailoring-models-to-unique-applications)
- [anecdote] A Qwen2.5-1.5B text-to-SQL QLoRA run used 1,000 samples (about 30 minutes), with no formal benchmark. A 2026 NL2SQL paper reports fine-tuning lifted a small Qwen model from 36% to 45%, while large Gemini models gained little and overfit. — [ReadyTensor write-up](https://app.readytensor.ai/publications/fine-tuning-qwen25-15b-for-text-to-sql-generation-kaa6DwgRemd5); [arXiv 2603.22942](https://arxiv.org/html/2603.22942v1)

### Inferences
Proposed tiers, synthesized from the evidence above. These are my recommendations, not figures from any single source.

| Use case | Standard (kept examples) | Extreme (kept examples) | Rationale |
|---|---|---|---|
| Classification / extraction / JSON output | 500–1,000 | 3,000–5,000 (balanced per label, plus hard negatives) | OpenAI sees gains from 50–100; SuperNI-style tasks plateau at hundreds; LoRA Land shows ~90%+ on narrow tasks |
| Persona / style / tone | 300–1,000 | 2,000–3,000 | LIMA/Dong plateau at ~1k; diversity matters more than count |
| Support bot (multi-turn, policy-grounded) | 1,000–2,000 | 5,000–8,000 (incl. ~10–20% multi-turn and refusal/escalation cases) | LIMA's 30 dialogues had an outsized effect; coverage of intents drives quality |
| Domain Q&A (on top of RAG, or knowledge-light) | 1,000–2,000 | 5,000–10,000 | Knowledge comes mostly from pretraining (LIMA); SFT teaches format and grounding |
| Text-to-SQL (single schema family) | 2,000–3,000 | 10,000–20,000 | Skill-type task that keeps scaling (Dong); Anyscale used 45k |
| Coding (narrow: a library, DSL or repo style) | 2,000–5,000 | 10,000–30,000 | Code keeps scaling with data (Dong); LoRA underperforms full fine-tuning on code (Biderman) |

- Quality filtering effectively divides the needed count by roughly 3–6x. Examples: AlpaGasus 9k vs 52k; Deita 6K vs 60K+.
- Standard can be pitched at "plateau for format and behaviour". Extreme buys coverage of edge cases, more diversity and hard examples, plus judge filtering and rewrites, rather than simply more of the same.

### Gaps
- No peer-reviewed study gives clean accuracy-vs-N curves at exactly 500/1k/2k/5k/10k for 1.5B–14B LoRA models per use case. The LIMA ablation values exist only in a figure the fetch could not read.
- Predibase and Unsloth do not publish minimum example counts.
- The Google Vertex "prepare data" page did not render. The commonly cited Gemini guidance (100–500 examples) could not be verified here.

## 2. Diminishing-returns curves, and how filtering and diversity change them

### Takeaway
Behavioural and format learning flattens around 1k examples. Narrow, task-like benchmarks flatten in the hundreds. Generative skills (code, math, SQL) follow a power law and keep rising past 10k, at decreasing marginal gain. Diversity and quality shift the curve upward rather than extending it.

### Cited Findings
- General abilities plateau at about 1k samples, while math and code keep scaling. — [Dong et al. 2310.05492](https://arxiv.org/abs/2310.05492)
- LIMA: flat across 16x more data. Diverse data beats homogeneous data at equal N. — [LIMA](https://arxiv.org/html/2305.11206)
- Self-Instruct: plateau at about 16K for open-ended tasks and at hundreds for SuperNI. — [Self-Instruct](https://arxiv.org/html/2212.10560)
- Power-law fine-tuning scaling with data size, model size more valuable than PET parameters. — [arXiv 2402.17193](https://arxiv.org/abs/2402.17193)
- Self-Instruct used a ROUGE-L < 0.7 similarity filter against all existing instructions to enforce diversity. — [Self-Instruct](https://arxiv.org/html/2212.10560)

### Inferences
- For Zebrain's pricing: going from Standard to Extreme roughly 3–5x's the data. Expect only a small gain on behaviour and format tasks, but a meaningful gain on SQL and code. Deduplication with a similarity filter (ROUGE-L or embedding cosine) is a cheap, high-value pipeline step.

### Gaps
- No exact plateau points by use case for Qwen-class 1.5B–14B models in the sources fetched.

## 3. Tokens per example and synthetic-generation overhead (rejection rates, per-kept-example cost)

### Takeaway
Typical chat-SFT examples run a few hundred to about 1k tokens (LIMA averages about 750). Synthetic pipelines discard a large share of output: 46% of Self-Instruct outputs had a flaw, AlpaGasus kept only 17%, and a 2026 judge-filter study removed 26–32%. Budget roughly 1.5–3x generation per kept example.

### Cited Findings
- LIMA: about 750,000 tokens across 1,000 examples, so roughly 750 tokens per example. — [LIMA](https://arxiv.org/html/2305.11206)
- Self-Instruct averages: instruction 15.9 words, input 12.7, output 18.9, so very short examples (about 50–70 tokens). In the quality audit, only 54% of generated examples had all fields valid and 58% had correct outputs. — [Self-Instruct](https://arxiv.org/html/2212.10560)
- AlpaGasus kept 9k of 52k (17%) after LLM-judge scoring. — [AlpaGasus](https://arxiv.org/abs/2307.08701)
- DKL (2026): a Llama-3.1-70B judge filter removed about 26% (425 to 313) and 32% (2,269 to 1,554) of generated QA pairs. It caught about 71% of the ill-formed pairs humans flagged. — [DKL, arXiv 2609.02685](https://arxiv.org/pdf/2609.02685)
- FineInstructions keeps pairs scoring at least 4 of 5 from a judge. REFED keeps only refinements that beat the original in a judge comparison. — [FineInstructions 2601.22146](https://arxiv.org/pdf/2601.22146); [REFED 2502.04511](https://arxiv.org/pdf/2502.04511)
- Anyscale filtered SQL data from about 70k to 45k (about 36% removed) for label noise. GSM8k came to about 3.7M tokens per epoch at 8k examples, roughly 460 tokens per example. — [Anyscale](https://www.anyscale.com/blog/fine-tuning-llama-2-a-comprehensive-case-study-for-tailoring-models-to-unique-applications)

### Inferences
These are my estimates, built from the figures above. Typical kept-example size (prompt + answer, including a system prompt):

| Use case | Prompt tokens | Answer tokens | Total |
|---|---|---|---|
| Classification / extraction | 200–600 | 20–150 | ~300–700 |
| Persona / style | 100–300 | 150–400 | ~300–700 |
| Support bot (2–4 turns) | 400–1,200 | 300–600 | ~800–1,800 |
| Domain Q&A (with context passage) | 300–1,000 | 150–400 | ~500–1,400 |
| Text-to-SQL (schema in prompt) | 300–1,500 | 50–200 | ~400–1,700 |
| Coding | 200–800 | 300–1,000 | ~600–1,800 |

Synthetic pipeline cost per generated candidate, using Qwen as the generator:

1. **Topic and persona planning.** Batched: one call yields about 20–50 seeds. That amortizes to about 50–100 input tokens and 20–50 output tokens per candidate.
2. **Generation.** Input is the system prompt, task spec, few-shot examples and seed: about 600–1,500 tokens. Output is the example itself: about 300–1,500 tokens (generate the user turn and the answer).
3. **LLM-judge filtering.** Input is the rubric plus the example: about 800–2,000 tokens. Output is a score plus a short rationale: about 50–200 tokens. A reasoning judge costs more.
4. **Rewrite or repair** of about 20–30% of candidates. Input about 1,000–2,000 tokens, output about 300–1,000.
5. **Rejection rate.** Assume 30–50% discarded for Standard (light filter) and 50–70% for Extreme (strict judge, dedup, possibly two judges). This range is bracketed by DKL's 26–32%, Self-Instruct's 46% flawed and AlpaGasus's 83% discarded.

Per kept example, the generated-candidate cost multiplies by 1/(keep rate):
- **Standard** (keep ~60%, one judge, ~20% rewrites): about **3k–6k input and 1k–2.5k output tokens** per kept example for typical 500–1,000-token examples.
- **Extreme** (keep ~35%, stricter judge or two judges, ~30% rewrites, more few-shot context): about **8k–15k input and 2.5k–5k output tokens** per kept example. For long examples (support or coding, about 1.5k tokens), scale up roughly 1.5–2x.
- **Worked example:** Standard support bot, 1,500 kept, at about 5k input and 2k output each, is about 7.5M input and 3M output tokens. Extreme support bot, 6,000 kept, at about 15k input and 5k output each, is about 90M input and 30M output tokens.
- **Prompt caching:** shared system prompts, rubrics and few-shot blocks make up most of the input tokens. With prefix caching, the effective input cost can drop substantially.

### Gaps
- No primary source gives a measured end-to-end token count per kept example for an LLM-judge pipeline. The figures above are derived.
- No Qwen-specific generation pipeline cost report was found.

## 4. Epochs, learning rate and LoRA rank by dataset size; overfitting; forgetting and replay

### Takeaway
Use a LoRA learning rate of about 2e-4 with rank 16–32 and alpha equal to r or 2r. Train 1–3 epochs, or more (3–5) for very small sets, with early stopping on eval loss. LoRA forgets less than full fine-tuning but also learns less on code and math. Mix in general instruction data to limit forgetting.

### Cited Findings
- Unsloth recommends:
  - Rank 16 or 32 (default 16), with alpha equal to r or 2r.
  - Learning rate 2e-4 (range 2e-4 to 5e-6), 1–3 epochs ("beyond 3 … diminishing returns and increases overfitting risk").
  - Effective batch 16 (range 4–16), warmup 5–10%, weight decay 0.01–0.1, dropout 0–0.1.
  - Treat training loss below 0.2 as a likely sign of overfitting, and use early stopping on eval loss.
  - [Unsloth LoRA hyperparameters guide](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide)
- LIMA (full fine-tune, 1k examples): 15 epochs at learning rate 1e-5 decaying to 1e-6, with a checkpoint chosen between epochs 5 and 10 on a 50-example dev set. Small, curated data tolerated many epochs with checkpoint selection. — [LIMA](https://arxiv.org/html/2305.11206)
- LoRA Land: rank 8, learning rate 2e-3 (unusually high), cosine schedule, 3% warmup, effective batch 16, 40k steps. — [LoRA Land](https://arxiv.org/html/2405.00732v1)
- LoRA Learns Less and Forgets Less: LoRA substantially underperforms full fine-tuning on code and math, but better preserves out-of-domain abilities, more so than weight decay or dropout do. Full fine-tuning learns perturbations of 10–100x higher rank than typical LoRA. — [Biderman et al., arXiv 2405.09673](https://arxiv.org/abs/2405.09673)
- Forgetting in continual instruction tuning (1B–7B):
  - Domain-knowledge forgetting grows with model size, from 9.5% at 1.1B to 18.4% at 7.1B.
  - Mixing 10,000 Alpaca general samples partly restored performance (MMLU-human: 34.7% initially, 26.8% after tuning, 30% with mixing).
  - [Luo et al., arXiv 2308.08747](https://arxiv.org/html/2308.08747)
- Dong et al.: sequential multi-skill SFT causes forgetting. Their DMT (dual-stage mixed fine-tuning) mixes general data back in. — [arXiv 2310.05492](https://arxiv.org/abs/2310.05492)
- "Scaling PET parameters is generally ineffective", so raising LoRA rank is not a substitute for more or better data. — [arXiv 2402.17193](https://arxiv.org/abs/2402.17193)

### Inferences
Suggested defaults by dataset size (my synthesis):

| Kept examples | Rank / alpha | Learning rate | Epochs | Notes |
|---|---|---|---|---|
| < 1k | r 8–16, alpha 16–32 | 1e-4 to 2e-4 | 3–5 | Early stopping, dropout 0.05–0.1 |
| 1k–5k | r 16–32 | 2e-4 | 2–3 | |
| 5k–20k+ | r 32–64 (higher for code/SQL) | 1e-4 to 2e-4 | 1–2 | |

- **Replay mix:** add about 10–20% general chat or instruction data (or self-distilled outputs from the base model) for support, persona and Q&A tiers, where general chat ability must survive. It matters less for pure classifiers.

### Gaps
- The specific LR and rank recommendations from the LoRA Learns Less paper were not retrieved (abstract only).
- No source gave an optimal replay ratio. The 10–20% figure is an inference.

## 5. Held-out eval set size

### Takeaway
Vendors give no fixed number. Papers commonly use small dev sets (50) for checkpoint selection and a few hundred for reported evals. For product decisions, about 100–200 held-out examples is a practical Standard target and 300–500 for Extreme. Hold-out data should match the training distribution's diversity.

### Cited Findings
- OpenAI: hold out examples from the same dataset as a control, with roughly the same diversity of inputs and responses. No ratio is given. — [OpenAI SFT guide](https://developers.openai.com/api/docs/guides/supervised-fine-tuning)
- LIMA used a 50-example dev set for checkpoint selection and a 300-prompt test set. — [LIMA](https://arxiv.org/html/2305.11206)
- Self-Instruct used 252 user-oriented instructions for human evaluation and 200 samples for its data-quality audit. — [Self-Instruct](https://arxiv.org/html/2212.10560)

### Inferences
- Binomial standard error at n=200 and p≈0.8 is about ±2.8 points; at n=500 it is about ±1.8 points.
- So a Standard eval set of about 150–200 can detect roughly 6-point-or-larger differences, and Extreme's 400–500 can detect about 4-point differences. For classification, stratify per label with at least 30 per class.
- Generate the eval split from separate seeds or topics, not just a random split, to avoid near-duplicate leakage from synthetic generation.

### Gaps
- The LIMA 300-prompt test-set size is from my recollection of the paper body, not confirmed in this session's fetch. Verify before citing.
- The Google Vertex validation-set limits could not be retrieved.
