# Price by job, not by model

A flat **$10 per Pro model covers Standard-sized jobs but loses money on Extreme ones**. At October 2026 list prices, a Standard run (800 to 3,000 kept examples) costs Zebrain roughly **$0.80 to $7.20** before buffers, so $10 leaves $2.40 to $8.80 after card fees. An Extreme run (2,500 to 10,000 kept examples, strict filtering) costs **$2.15 to $23.50**, and support, coding, SQL and larger domain-Q&A jobs lose up to about $14 each at $10. The surprise is where the money goes. **Qwen tokens, not GPUs, are the largest cost in most Extreme jobs**: an Extreme 9B support bot is about $8.60 of Qwen3.7 Flash against about $3.50 of GPU time. The formula below replaces the flat price. It turns parameter size and use case into a dataset size, picks the GPU automatically, prices Qwen tokens and web searches, adds a 1.3 to 1.5x error buffer and Razorpay fees, and sets Standard at cost plus $3 and Extreme at cost plus $7. Worked prices run from **$4.99 to $13.99 for Standard and $10.99 to $40.99 for Extreme**. One engineering constraint changes the GPU choice: Unsloth advises against QLoRA on Qwen3.5. That pushes Qwen3.5-9B Pro jobs onto 48 GB cards and makes 9B training on the free Kaggle T4 tier hard to support.

## Which numbers are official, measured or estimated

Every price in this report rests on three kinds of input, and they deserve different levels of trust.

**Official list prices (high confidence).** RunPod's pricing page, dated 8 October 2026, gives Secure Cloud on-demand rates. These are $0.27/h for an RTX A5000 (24 GB), $0.59/h for an RTX A6000 or A40 (48 GB), $1.09/h for an L40S (48 GB), $1.79/h for an A100 80GB and $2.89/h for an H100 PCIe. Community Cloud rates are 30 to 60% lower. T4 no longer appears on the list ([RunPod pricing](https://www.runpod.io/pricing)). Qwen3.7 Flash in Singapore costs **$0.03 per million input tokens and $0.13 per million output tokens for requests up to 32K input tokens**, rising to $0.10/$0.40 above that, and thinking tokens bill as output ([Alibaba Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)). Built-in web search costs **$10.00 per 1,000 successful searches in Singapore**, about $0.01 each ([Alibaba web search](https://www.alibabacloud.com/help/en/model-studio/web-search)). text-embedding-v4 costs $0.07 per million input tokens ([Alibaba Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)). The Razorpay rates (about 2% on domestic cards, about 3% on international cards) are assumptions from the brief, not verified here. Razorpay in India normally adds 18% GST on its fee, so the formula uses an effective 2.36% or 3.54%; confirm both against your merchant agreement.

**Measured (medium confidence, one data point each).** Zebrain's own Kaggle run of Qwen3.5-9B QLoRA took about 40 s per step at 16 sequences. With sequences averaging about 600 tokens, that is roughly 240 tokens/s, or about 20% model-FLOPs utilization on a T4. That figure anchors the throughput model. A published Llama 3.1 8B QLoRA run with Unsloth peaked at 6.6 GB on an RTX 4090 ([ComputingForGeeks](https://computingforgeeks.com/fine-tune-llm-unsloth-qlora/)).

**Estimates (low to medium confidence, ±40% or worse).** Most of the formula's variables are modeled, not measured. GPU throughput on RunPod cards uses tokens/s = MFU × peak TFLOPs / (6 × parameters), cross-checked against a vendor figure of about 520 tok/s for 8B on a 4090 ([Spheron](https://www.spheron.network/blog/rtx-5090-vs-rtx-4090/)). The model overshoots that figure by about 30%. Fixed per-run overhead (boot, download, merge, upload) is also modeled, as are tokens per training example, Qwen tokens per kept example and the dataset sizes per tier. The formula therefore carries explicit buffers, and the first engineering task is to replace the modeled throughput with a 20-to-50-step timing run per (model, GPU) pair.

## Flat $10 fails on Extreme jobs because of Qwen tokens

The dataset is the biggest cost driver, and the literature gives a clear basis for tiering it. General behaviour and format learning plateau at roughly **1,000 high-quality examples**. LIMA matched or beat GPT-4 in 43% of comparisons with 1,000 curated pairs, and doubling the data did not help ([LIMA](https://arxiv.org/html/2305.11206)). Code and math keep improving with more data well past that point ([Dong et al.](https://arxiv.org/abs/2310.05492)). Curation beats volume: AlpaGasus kept 9k of 52k Alpaca examples and outperformed the full set ([AlpaGasus](https://arxiv.org/abs/2307.08701)). This supports pitching **Standard at the plateau for format and behaviour** and **Extreme as more coverage, hard cases and stricter filtering**. Extreme should not mean more of the same data.

Synthetic pipelines throw away a lot of what they generate. A 2026 judge filter removed 26 to 32% of generated QA pairs ([DKL](https://arxiv.org/pdf/2609.02685)), and AlpaGasus discarded 83% ([AlpaGasus](https://arxiv.org/abs/2307.08701)). So the cost of each kept example includes planning, generation, judging, partial rewrites and the rejected candidates. The research estimate, which is derived rather than measured, is about **6× the example length in input tokens and 2.5× in output tokens per kept example for Standard** (about 60% keep rate, one judge). For Extreme it is **about 15× input and 5× output** (about 35% keep rate, stricter judging, more rewrites). Applied to an Extreme support bot with 6,000 kept examples of about 1,300 tokens, that comes to 117M input and 39M output tokens. The cost is $3.52 + $5.08 = **$8.60 of Qwen spend**, more than twice the GPU bill. Output tokens are the larger half, so the cheapest lever is keeping judge outputs short (a score, no essay) and setting `enable_thinking=false`. Prompt caching helps less than expected. Explicit cache reads on Qwen3.7 Flash cost $0.003 per million ([Alibaba qwen3.7-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-flash)), but they only discount input.

GPU cost, by contrast, is small and flat. On Secure prices, every Standard job in the grid below costs under $5 of GPU time, and most cost under $2.50. That matches the independent estimate that even a 14B, 5,000-example, 3-epoch run costs at most about $5 on Secure (modeled from [RunPod pricing](https://www.runpod.io/pricing)). Applying the formula's raw costs to a $10 price gives this profit after a 3.54% fee:

| Use case | Standard profit at $10 (1.5B → 14B) | Extreme profit at $10 (1.5B → 14B) |
|---|---|---|
| Support bot | $7.82 → $5.88 | −$0.32 → −$4.93 |
| Coding | $6.72 → $2.41 | −$5.41 → −$13.82 |
| SQL | $7.44 → $5.05 | −$3.03 → −$8.84 |
| Domain Q&A | $8.20 → $6.75 | $2.54 → −$0.75 |
| Persona chat | $8.83 → $8.23 | $7.50 → $6.14 |
| Extraction | $8.83 → $8.23 | $6.54 → $4.56 |

The verdict is that **$10 works as a Standard price for small and mid models, and fails as soon as a user wants Extreme quality on a skill-heavy task**. Once the estimate-error buffer is included, 14B Standard coding also loses money at $10 (buffered cost $10.22).

## The pricing formula

The formula has nine steps. The constants are starting values to recalibrate monthly against real job logs.

**Inputs:** base-model parameters *P* (billions), use case *u*, tier *t* ∈ {Standard, Extreme}, uploaded-document tokens *D*, whether web search is used, and card region.

**Step 1: dataset size.** The number of kept examples *N* and average training tokens per example *L* come from the use-case table below. Epochs *e* = 3 if *N* ≤ 5,000, otherwise 2, following Unsloth's 1 to 3 epoch guidance ([Unsloth hyperparameters](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide)). Training tokens *T* = *N* × *L* × *e*.

| Use case | *L* (tokens/example) | *N* Standard | *N* Extreme |
|---|---|---|---|
| Support bot (multi-turn) | 1,300 | 1,500 | 6,000 |
| Coding (library/repo) | 1,200 | 3,000 | 10,000 |
| Text-to-SQL | 1,000 | 2,500 | 10,000 |
| Domain Q&A from documents | 900 | 1,500 | 6,000 |
| Persona chat | 500 | 800 | 2,500 |
| Extraction / JSON | 500 | 800 | 4,000 |

**Step 2: VRAM requirement.** Assume bf16 LoRA (see the QLoRA section). VRAM_need = 1.25 × (2.4*P* + 2) GB. The inner term reproduces Unsloth's published bf16 LoRA floors of 10 GB at 4B, 22 GB at 9B and 33 GB at 14B with a small margin ([Unsloth Qwen3.5 guide](https://unsloth.ai/docs/models/qwen3.5/fine-tune); [Unsloth requirements](https://docs.unsloth.ai/get-started/beginner-start-here/unsloth-requirements)). The 1.25 factor is headroom for longer sequences.

**Step 3: GPU choice and count.** For each RunPod GPU *g* with VRAM ≥ VRAM_need, compute:

- throughput_g = MFU_g × TFLOPs_g × 10¹² / (6 × *P* × 10⁹), multiplied by 0.6 when *P* < 2
- training hours t_g = *T* / throughput_g / 3600
- overhead hours h = (5 + 1.1*P*) / 60
- cost_g = (t_g + h) × Secure price_g

Pick the cheapest *g* whose t_g ≤ T_max, where T_max is 3 h for Standard and 6 h for Extreme. If no single GPU meets T_max, use 2 GPUs of the cheapest type: training time ÷ 1.8, and both GPUs are billed for the overhead. Use these constants: A5000 111 TFLOPs, MFU 0.22; A6000 155, 0.22; L40S 362, 0.22; A100 312, 0.28; H100 PCIe 756, 0.25. The overhead term reproduces the planning estimates of about 7, 10, 15 and 20 minutes at 1.5B, 4B, 9B and 14B. Two GPUs rarely win at these sizes: data-parallel LoRA gives about 1.7 to 1.9x speedup for twice the hourly rate, so it only buys wall-clock time.

**Step 4: Qwen tokens.**

- Input = *N* × *L* × k_in + 2*D*
- Output = *N* × *L* × k_out + 0.3*D*
- k_in/k_out are 6/2.5 for Standard and 15/5 for Extreme.
- The *D* terms cover chunk annotation and topic extraction.
- C_qwen = Input × $0.03/M + Output × $0.13/M.

Every request must stay under 32K input tokens to hold the cheapest price tier. Above 32K, Qwen3.7 Flash's input price rises 3.3x ([Alibaba Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)). **For Standard, these token counts are the hard cap.** The pipeline stops generating at the cap and trains on whatever has been kept.

**Step 5: web search.** C_search = $0.01 × S, where S = 30 searches for Standard and 150 for Extreme, charged only when the user supplies no documents or turns on web augmentation. Retrieved text is billed as input tokens and is already inside the Step 4 buffer.

**Step 6: embeddings for deduplication.** C_emb = *N* × 2 × 150 tokens × $0.07/M. This is under $0.25 even at Extreme scale.

**Step 7: operations.** Add a fixed $0.50 per job for storage, the held-out evaluation pass, Hugging Face upload and a share of failed jobs. This is an assumption to replace with logged data.

**Step 8: buffered cost.** C* = 1.5 × C_gpu + 1.3 × (C_qwen + C_emb) + C_search + $0.50. The 1.5 covers the ±40% throughput error and retried runs. The 1.3 covers keep rates below plan.

**Step 9: price.** Price = round up to the next .99 of (C* + Π_t) / (1 − f).

- Π_Standard = $3.00, with a floor price of $4.99.
- Π_Extreme = $7.00.
- f = card fee × 1.18 GST: 0.0354 for international cards, 0.0236 for domestic cards.

The worked prices below use the international rate. Because profit is added to the buffered cost, Extreme is guaranteed $7 after fees even when GPU time runs 50% and Qwen tokens 30% over plan. At expected costs the margin is larger.

## Worked prices across sizes and use cases

All prices assume documents are uploaded (no web search), Secure Cloud and international card fees. "8 to 9B" is computed at 9B. The selected GPU appears in brackets.

**Standard tier**

| Use case | 1.5B | 4B | 8–9B | 14B |
|---|---|---|---|---|
| Support bot | $5.99 [A5000] | $5.99 [A5000] | $7.99 [L40S] | $8.99 [L40S] |
| Coding | $7.99 [A5000] | $7.99 [A5000] | $10.99 [L40S] | $13.99 [H100 PCIe] |
| SQL | $6.99 [A5000] | $6.99 [A5000] | $8.99 [L40S] | $9.99 [L40S] |
| Domain Q&A | $4.99 [A5000] | $5.99 [A5000] | $6.99 [L40S] | $7.99 [L40S] |
| Persona chat | $4.99 [A5000] | $4.99 [A5000] | $4.99 [A6000] | $5.99 [A6000] |
| Extraction | $4.99 [A5000] | $4.99 [A5000] | $4.99 [A6000] | $5.99 [A6000] |

**Extreme tier ($7 minimum profit)**

| Use case | 1.5B | 4B | 8–9B | 14B |
|---|---|---|---|---|
| Support bot | $20.99 | $21.99 | $24.99 | $27.99 |
| Coding | $27.99 | $29.99 | $33.99 | $40.99 |
| SQL | $24.99 | $25.99 | $29.99 | $33.99 |
| Domain Q&A | $16.99 | $17.99 | $19.99 | $21.99 |
| Persona chat | $10.99 | $10.99 | $11.99 | $12.99 |
| Extraction | $11.99 | $11.99 | $13.99 | $14.99 |

Here is one example traced in full: a **9B support bot**. On Standard it has 1,500 examples × 1,300 tokens × 3 epochs = 5.85M training tokens. The selector picks an L40S, which runs 1.35 h including overhead, for a GPU cost of $1.47. Qwen uses 12.0M input and 4.9M output tokens, costing $1.00. With $0.50 of ops, the raw cost is $3.00. The buffered cost is $4.05, and ($4.05 + $3) / 0.9646 = $7.31, which rounds to **$7.99**. On Extreme it has 6,000 examples × 2 epochs = 15.6M training tokens. The L40S runs 3.2 h for $3.47, and Qwen uses 117M input and 39M output tokens for $8.60. The buffered cost is $17.05, giving **$24.99**. Without uploaded documents, web search adds $0.30 (Standard) or $1.50 (Extreme) before buffers. For a 9B domain-Q&A model that moves the price from $6.99 to $6.99 (absorbed by rounding) and from $19.99 to $21.99.

Three patterns are worth acting on. First, **use case moves the price more than parameter count**. Going from 1.5B to 14B adds $1 to $13, while going from persona to coding adds $3 to $28. A price driven by size alone would mis-charge most users. Second, on Secure prices the modeled throughput makes the **L40S cheaper per run than the A6000 for 9B and 14B** ($1.09/h at an estimated 1,475 tok/s against $0.59/h at about 620 tok/s for 9B). On Community prices the A6000 wins. The selector handles this automatically, but the L40S advantage rests entirely on modeled throughput, so calibrate both before relying on it. Third, the A5000 is the cheapest card for everything at 4B and below. Switching to Community Cloud would cut a 9B Standard support run's GPU cost from $1.47 to about $0.93, at the price of less reliable hosts ([RunPod pricing](https://www.runpod.io/pricing)).

## The QLoRA warning reshapes both tiers' hardware

Unsloth's Qwen3.5 fine-tuning guide says it is **"not recommended to do QLoRA (4-bit) training on the Qwen3.5 models, no matter MoE or dense,"** because quantization differences are higher than normal ([Unsloth Qwen3.5 guide](https://unsloth.ai/docs/models/qwen3.5/fine-tune)). The same guide lists bf16 LoRA VRAM of **10 GB at 4B and 22 GB at 9B**. QLoRA on other 8B to 14B models needs only 6 to 8.5 GB ([Unsloth requirements](https://docs.unsloth.ai/get-started/beginner-start-here/unsloth-requirements)). Zebrain's current setup is 9B QLoRA on Kaggle T4s, and it has three consequences.

For Pro, a Qwen3.5-9B job needs at least 24 GB, and 24 GB is tight once sequence length and batch size grow. The formula's VRAM rule (29.5 GB for 9B) therefore rules out the A5000 and 4090 and lands on 48 GB cards (A6000, A40, L40S). That roughly doubles 9B GPU cost compared with QLoRA on an A5000. The cost is still small next to the Qwen bill. Other base models (Qwen3, Granite 8B, Phi-4, 14B models) can keep QLoRA. The selector can add QLoRA-on-A5000 as a candidate for them, which is cheaper per hour but about 1.5 to 2x slower at 14B.

For the free tier, bf16 LoRA on Qwen3.5-9B (22 GB) does not fit a 16 GB T4. Unsloth also notes that its Triton kernels for Qwen3.5's linear-attention layers compile slowly on T4 ([Unsloth Qwen3.5 guide](https://unsloth.ai/docs/models/qwen3.5/fine-tune)). The T4 also lacks native bf16, so training would run in fp16, which is general hardware knowledge rather than something the research notes cite. The defensible options are to cap free Qwen3.5 models at 4B, where bf16 LoRA at about 10 GB fits, or to keep 9B QLoRA on Kaggle but label it lower-fidelity. A third option is to offer non-Qwen3.5 9B-class models for free training. The quality gap this creates also makes a natural reason to upgrade to Pro.

Unsloth's warning is qualitative. No one has published how much QLoRA actually degrades a Qwen3.5-9B LoRA on a narrow task. A side-by-side eval of the same dataset trained with QLoRA on a T4 and with bf16 LoRA on an A6000 would settle whether the free tier is merely slower or genuinely worse.

## A document pipeline that plans topics before writing questions

The pipeline you described (Qwen extracts topics, builds a dataset per topic, writes example questions from the documents) matches the structure of IBM's InstructLab/LAB. LAB generates data per leaf of a hierarchical taxonomy, grounds the teacher in source documents rather than its own memory, and uses the teacher again to check faithfulness ([LAB paper](https://arxiv.org/html/2403.01081)). The recommended version has eleven stages, all run with Qwen3.7 Flash except parsing and deduplication.

**Parsing and chunking.** Parse uploads with a layout-aware tool. Docling is the default and Marker the fallback for multi-column PDFs. Docling self-reports 97.9% table accuracy, while a third-party test found Marker best on multi-column layouts ([Ertas benchmark](https://www.ertas.ai/blog/pdf-parsing-accuracy-benchmark-docling-unstructured)). Chunk by heading into **800 to 2,000-token generation units**, keep tables and code blocks whole, and prefix every chunk with a `doc > H1 > H2` breadcrumb. Meta's synthetic-data-kit default of 4,000 characters (about 1K tokens) is a reasonable lower bound ([synthetic-data-kit](https://github.com/meta-llama/synthetic-data-kit)).

**Annotation and topic planning.** One cheap call per chunk returns a summary, 3 to 8 key facts, entities, a content type and an importance score from 1 to 5. Embed the summaries, cluster them, and have Qwen name the clusters into a two- or three-level topic tree, using the documents' own headings as the starting structure. Show the tree to the user for approval. Allocate examples per leaf as max(minimum, *N* × *w*), with *w* proportional to leaf tokens^0.5–0.7 × importance, so one huge appendix cannot crowd out small topics. Then require every key fact to be targeted by 2 to 5 differently phrased questions. The exponent and repetition count are engineering heuristics, not validated values.

**Question generation.** Generate per leaf across a type × difficulty × persona matrix. The default type mix is:

| Question type | Share |
|---|---|
| Factual | 25% |
| Procedural | 20% |
| Reasoning | 15% |
| Multi-hop across chunks that share an entity | 10% |
| Comparison | 5% |
| Edge case | 10% |
| Unanswerable | 10% |
| Multi-turn | 5% |

Each question also gets 5 to 15 personas derived from the use-case prompt. Enforce a "no-peeking" rule: questions must never say "according to the document". Check it with a regex and with the judge. Converting domain text into task-formatted data is what makes this work. Bonito gained 22.1 F1 from generated task data, while plain next-word training on the same text lost 0.8 F1 ([Bonito](https://arxiv.org/html/2402.18334v2)).

**Answers, filtering and splitting.** Answers are generated in a separate call, given the oracle chunks, the document summary and a per-use-case style spec. Optionally use RAFT's quote-then-answer format, which added about 9.7 points on HotpotQA ([RAFT](https://arxiv.org/html/2403.10131)). Then filter in order:

1. Rule filters.
2. A question judge.
3. An answer judge that keeps only items with faithfulness of 5/5 and every other criterion at 4 or above.
4. Self-consistency checks on hard items.
5. MinHash deduplication at Jaccard 0.8, then embedding deduplication within each leaf. The MinHash threshold follows NVIDIA NeMo Curator's default ([NeMo Curator](https://docs.nvidia.com/nemo-framework/user-guide/24.07/datacuration/api/deduplication.html)).

Finally, hold out 5 to 10% for evaluation, split by chunk group rather than by row so that paraphrases cannot leak.

**Standard and Extreme run the same pipeline at different settings.** Standard uses one judge pass, skips self-consistency and multi-hop beyond the default share, and stops at the token cap. Extreme over-generates harder, applies a stricter judge (optionally a second model family, because self-judging inflates scores), runs self-consistency on all hard items, and uses a larger eval set of about 400 to 500. A 200-item set detects only differences of about 6 points or more; 500 items detect about 4.

**Per-use-case recipes swap the question mix, judge criteria and validators.** The research recipes are engineering judgement built on the cited methods:

| Use case | Inputs emphasized | Question/answer mix | Validator |
|---|---|---|---|
| Support bot | FAQs, policies, help pages | 40% how-to, 15% multi-turn troubleshooting, 15% policy edge cases, 15% escalation/out-of-scope; angry and confused personas | Judge on policy faithfulness and tone |
| Coding | Code split per symbol (tree-sitter), README, API docs | "How do I call X", write a snippet, explain an error, migrate versions | Syntax check or run code; check API names against the symbol table |
| SQL | DDL plus CSV schema cards | Natural language to SQL across joins, aggregates and window functions | Execute against DuckDB/SQLite; drop queries that error or return empty when a result is expected |
| Domain Q&A | Any documents | Default mix, about 10% unanswerable, every fact covered by 5 to 10 paraphrases | Faithfulness = 5; RAFT format if deployed with RAG |
| Persona chat | Style guides, sample conversations | Magpie/persona-generated prompts with answers rewritten in the persona's voice; off-topic and adversarial prompts | Judge voice against gold examples |
| Extraction | Documents plus label schema | Real chunks plus perturbations; balanced classes, hard negatives, "none" labels | JSON Schema validation; exact-match or field-F1 eval |

When the user uploads nothing, Qwen builds the topic tree from the prompt and runs a few web searches per leaf. Those results are parsed like uploads, so the data is grounded again, and this is where the Step 5 search fee comes from. Data that is not grounded this way gets a stricter judge pass and is flagged "ungrounded" in the UI.

## Fine-tuning teaches skills reliably and facts only approximately

The largest product risk is user expectation, not cost. Users who upload documents expect the model to "know" them, and the evidence says closed-book fine-tuning does that poorly. Ovadia et al. compared the two on 7B models. Retrieval took Mistral from **0.481 to 0.875** on current-events questions, while unsupervised fine-tuning reached only 0.504, and Llama 2 *fell* from 0.353 to 0.219 after fine-tuning. Training on 10 paraphrases per chunk recovered part of the gap, lifting Mistral to 0.588 ([Ovadia et al.](https://arxiv.org/html/2312.05934v3)). Gekhman et al. found that once a model learns facts it did not already know, its hallucination rate rises linearly. Fine-tuning mostly teaches a model to *use* knowledge it already has ([Gekhman et al.](https://arxiv.org/abs/2405.05904v3)). And knowledge seen without augmentation can be memorized but not extracted by question answering ([Allen-Zhu & Li](https://arxiv.org/abs/2309.14316v3)).

Zebrain should therefore make **"fine-tune for behaviour, retrieve for facts" the default for document-heavy models**. Train RAFT-style examples so that the model learns to answer from retrieved context: one oracle chunk plus 2 to 4 distractors, with the oracle present in about 60 to 80% of examples. In the RAFT paper this beat both domain fine-tuning and GPT-3.5 with RAG on most benchmarks ([RAFT](https://arxiv.org/html/2403.10131)). Offer "knows my docs" closed-book training only as an Extreme option, and only with 5 to 10 varied restatements per fact, about 10% unanswerable examples and 10 to 30% general replay data to limit forgetting. Precise, changing facts such as prices and policies should stay in retrieval. The UI should say so plainly before payment, because a user who pays $25 expecting perfect recall will churn.

## Conclusion

The flat price fails for a reason that is easy to miss: the expensive part of an Extreme model is the data, not the GPU. That makes **Qwen output tokens per kept example the variable Zebrain most needs to measure and squeeze**. Short judge outputs, thinking disabled, strict 32K request limits and an honest keep-rate log will move margins more than any GPU negotiation. The formula's buffers (1.5x on GPU, 1.3x on Qwen) are deliberately generous because three of its inputs are modeled rather than measured. After a few hundred real jobs they can shrink, which turns safety margin into either lower prices or more profit.

The QLoRA warning matters most for the free tier. If Qwen3.5-9B cannot train well on a T4, Zebrain should make free models smaller or different rather than worse, and it should run the QLoRA-versus-bf16 comparison itself. That eval doubles as evidence for the Pro upgrade. Pricing by use case rather than by size also changes how the product is presented. Users choose "a support bot that handles escalations" rather than "a 9B model", and the formula can quote that job's real cost.
