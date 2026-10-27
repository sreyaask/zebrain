# Turning user documents into SFT datasets (Zebrain, generator = Qwen3.7 Flash)

Scope note: about 16 searches and fetches. Primary sources fetched in full: RAFT (arXiv 2403.10131), Ovadia et al. (arXiv 2312.05934), LAB/InstructLab (arXiv 2403.01081), and the Meta synthetic-data-kit README. The other findings come from search-result abstracts or snippets and are marked as such where it matters. I found nothing published about "Qwen3.7 Flash" itself. Everything below assumes only that it is a cheap, instruction-following API model.

## 1. Parsing and chunking

### Takeaway
Use a layout-aware parser that outputs structured Markdown/JSON (Docling as the default, Marker as a fallback for multi-column PDFs, PyMuPDF for fast text-only PDFs). Chunk by structure (heading-aware, tables and code kept whole) and not by fixed character counts. Plan for roughly 1–2k-token "generation units" with the heading path attached. These are generation units, not small RAG-sized chunks.

### Cited Findings
- Docling's paper benchmarks conversion speed against Unstructured, Marker and MinerU on 89 PDFs. It measures speed only, not accuracy — [Docling paper](https://arxiv.org/pdf/2501.17887)
- IBM self-reports 97.9% table extraction accuracy for Docling. In a third-party benchmark Marker scored best on multi-column layout (96.1%) but had the least reliable header/footer handling, and Docling sometimes assigned borderless-table cells to the wrong columns. These figures are vendor-adjacent and should be treated as directional — [Ertas benchmark](https://www.ertas.ai/blog/pdf-parsing-accuracy-benchmark-docling-unstructured)
- On a dense academic PDF with merged cells, Docling hallucinated headers and lost merged cells, while Marker merged columns in borderless tables. The author warns that the results don't generalise — [CodeCut](https://newsletter.codecut.ai/p/pdf-table-extraction-docling-vs-marker)
- Docling's HybridChunker keeps headings, tables and figures as structure. `max_tokens` is tied to a tokenizer, and `merge_peers=True` merges adjacent undersized chunks that share the same heading context — [ai4rag docs](https://ibm.github.io/ai4rag/api-reference/rag/chunking/), [Docling hybrid chunking example](https://docling-project.github.io/docling/_generated/examples/hybrid_chunking/)
- Users report that PDF chunks stay very small even with `max_tokens` set and `merge_peers=True`. The discussion has no resolution — [Docling discussion #1207](https://github.com/docling-project/docling/discussions/1207)
- Meta synthetic-data-kit defaults to 4000-character chunks with 200-character overlap. Documents under 8000 characters are processed in a single call. Ingest supports PDF, HTML, DOCX, PPTX, TXT and YouTube — [synthetic-data-kit](https://github.com/meta-llama/synthetic-data-kit)

### Inferences
- Recommended parsing by input type:
  - **PDF/DOCX/PPTX:** Docling → Markdown, with tables as Markdown or HTML.
  - **Scanned PDFs:** OCR through Docling.
  - **Web pages:** readability-style main-content extraction (e.g. trafilatura), then Markdown.
  - **Code:** parse per file and per function/class (tree-sitter) and keep the file path as the "heading".
  - **CSV:** do not chunk rows as prose. Generate a schema card (column names, types, sample rows, simple stats) and treat the table as a queryable source for SQL/analytics-style questions.
- Recommended chunking:
  - Split on headings first. Never split inside a table, code block or list.
  - Target about 800–2000 tokens per generation unit, with 10–15% overlap only when a section has to be split.
  - Prepend `doc title > H1 > H2` breadcrumbs to every chunk.
  - Merge undersized sibling chunks; this works around the Docling small-chunk issue.
  - synthetic-data-kit's 4000 chars (~1k tokens) is a reasonable lower anchor.
- Keep a second, smaller chunking (~300–500 tokens) only if Zebrain also ships RAG or RAFT-style distractor training (see §6).

### Gaps
- I found no independent, methodology-sound benchmark that compares Docling, Marker, Unstructured and PyMuPDF on accuracy at once. Zebrain should run a small in-house test on representative uploads.
- I found no empirical study of the chunk size that is optimal for *question generation*, as opposed to RAG retrieval.

## 2. Topic extraction and coverage planning

### Takeaway
Build an explicit topic tree, as InstructLab does with its taxonomy. Fill it from the documents with LLM outlining: summarise each chunk, then cluster and merge into a hierarchy. Allocate example budgets per leaf in proportion to content length and importance, with a minimum per leaf so that small topics still get covered.

### Cited Findings
- LAB/InstructLab organises generation around a hierarchical taxonomy with three branches (knowledge, foundational skills, compositional skills). Knowledge is split by document type and then by domain. Each leaf holds 1–3 hand-written seed examples, and generation runs per leaf — [LAB paper](https://arxiv.org/html/2403.01081)
- LAB's knowledge-SDG grounds the teacher in source documents rather than its internal knowledge, and uses the teacher again to check faithfulness — [LAB paper](https://arxiv.org/html/2403.01081)
- EntiGraph (synthetic continued pretraining) extracts entities from a small corpus and generates text about relations between sampled entity pairs and triples, which "fills in" the corpus's knowledge graph — [Yang et al. 2024](https://arxiv.org/html/2409.07431v2)
- synthetic-data-kit's QA prompt takes a `{summary}` (document summary) together with the chunk `{text}`. This is document-level context injected into chunk-level generation — [synthetic-data-kit](https://github.com/meta-llama/synthetic-data-kit)

### Inferences
- A practical algorithm that fits a few-million-token budget:
  1. For each chunk, one cheap call returns: a summary of 2–3 sentences, 3–8 key facts or claims, named entities, the "kind" of content (concept/procedure/reference table/policy/code API/FAQ), and an importance score from 1 to 5.
  2. Embed the chunk summaries, cluster them (e.g. agglomerative or HDBSCAN), and have the LLM name the clusters and arrange them into a two- or three-level tree (topic → subtopic → chunk IDs). Use the document's own heading hierarchy as the prior, and let the LLM only fix and merge across documents.
  3. Show the tree to the user for edit and approval. This is the InstructLab "taxonomy" step, made automatic, and it costs little.
  4. Coverage budget: N_leaf = max(min_per_leaf, N_total × w_leaf), where w_leaf ∝ tokens_leaf^0.5–0.7 × importance. The sublinear exponent keeps a huge appendix from swamping everything else.
  5. Track coverage at fact level as well: every extracted key fact should be targeted by at least k questions (k = 2–5, phrased differently). See §6 for why repetition and paraphrase matter.
- Store the entity list for multi-hop and comparison question generation (pairs of chunks that share entities), in the spirit of EntiGraph.

### Gaps
- I found no paper that directly compares LLM outlining with embedding clustering for SFT coverage. The recommendation is an engineering synthesis.
- The weighting exponent is a heuristic, not an empirically validated value.

## 3. Question generation

### Takeaway
Generate per leaf or chunk using a type × difficulty × persona matrix. Force questions to be self-contained, written as a real user who has never seen the document would ask them. Include multi-hop, comparison, edge-case, unanswerable/out-of-scope and multi-turn items. Use document-free generators (Magpie, personas) only for general and conversational filler.

### Cited Findings
- In LAB's Skills-SDG pipeline the teacher generates questions per leaf, then filters out off-domain, harmful or beyond-capability questions before generating answers — [LAB paper](https://arxiv.org/html/2403.01081)
- Bonito converts unannotated domain text into task-specific instruction data (yes/no QA, extractive QA, NLI). It improved zero-shot performance by 22.1 F1 on average across 7 specialised datasets, while plain next-word prediction on the same text *reduced* performance by 0.8 F1 — [Bonito paper (search abstract)](https://arxiv.org/html/2402.18334v2)
- PersonaHub conditions generation on personas (1B personas built from web text) to diversify instructions, problems and knowledge-rich texts. The reported result is a 7B model comparable to gpt-4-turbo-preview on MATH; this is the paper's own claim — [PersonaHub](https://arxiv.org/html/2406.20094v1)
- Magpie gets user queries from an aligned model by feeding only the pre-query chat template. It generated 4M pairs, kept 300K after filtering, and a Llama-3-8B-Base fine-tuned on them was comparable on some tasks to Llama-3-8B-Instruct — [Magpie](https://arxiv.org/html/2406.08464v1)
- RAFT uses HotpotQA (multi-hop) and shows chain-of-thought answers add about 9.7 points on HotpotQA — [RAFT](https://arxiv.org/html/2403.10131)
- Augmentoolkit's factual pipeline has separate stages for checking questions, answer accuracy and answer relevancy. The details come from directory names only, not verified — [augmentoolkit data](https://huggingface.co/datasets/enikeev/tns_augmentoolkit/tree/main)

### Inferences
- **Question-type mix (default, adjustable per use case):**
  - Factual/definitional: 25%
  - How-to/procedural: 20%
  - Reasoning/why/apply-to-scenario: 15%
  - Multi-hop across 2–3 chunks: 10%
  - Comparison: 5%
  - Edge cases/exceptions/"what if": 10%
  - Unanswerable/out-of-scope: 10%
  - Multi-turn follow-ups: 5%
- **Difficulty:** about 30% easy, 50% medium and 20% hard, labelled at generation time.
- **Personas:** derive 5–15 personas from the use-case description (e.g. novice customer, power user, admin, angry customer, non-native speaker) and assign one per question. Vary phrasing, typos and length.
- **"No-peeking" rule in the prompt:**
  - Never mention "the text", "the document" or "according to the passage".
  - Questions must make sense to someone who has never seen the source.
  - Include the necessary context, such as the product name, in the question.
  - Enforce the rule again with a regex filter (e.g. `/\b(the|this) (text|passage|document|article|excerpt|section)\b/i`) and a judge check.
- **Multi-hop:** sample chunk pairs that share an entity, or that sit in sibling subtopics, and ask a question that needs both.
- **Unanswerable:** generate plausible questions on adjacent topics the documents do *not* cover, and verify absence by retrieving the top-k chunks and having the judge confirm that none answers the question.
- **Multi-turn:** chain 2–4 turns from one leaf: clarification, then follow-up, then a correction or edge case.
- Bonito's +22 F1 against −0.8 F1 for raw next-token training is evidence that task-formatted data beats raw text for *task* behaviour.

### Gaps
- I did not fetch the Evol-Instruct or Self-Instruct papers in this session. Evol-style "make harder/deeper/add constraints" rewriting is well known, but its numbers are not verified here.
- I found no quantitative study of the "according to the text" leakage rate or of the best type mix.

## 4. Grounded answer generation

### Takeaway
Generate answers in a separate call from questions. Give that call the oracle chunk(s) plus the document summary, and require it to answer only from them. Optionally add quoted evidence (RAFT style) and a reasoning step before the final answer. For unanswerable questions, train a calibrated "I don't have that information" answer with a redirect. The output must match the target format and voice, set by a per-use-case style spec and 3–5 gold examples.

### Cited Findings
- RAFT trains with chain-of-thought answers that quote the source verbatim between `##begin_quote##`/`##end_quote##`, using the format `##Reason: … ##Answer: …`. CoT plus quotes adds about 9.7 points on HotpotQA and 14.9 on HuggingFace APIBench over no-CoT — [RAFT](https://arxiv.org/html/2403.10131)
- RAFT training mixes oracle and distractor documents: one golden document plus four distractors, with the golden document included in a fraction P of examples. The best P varied by dataset (40–100%), and the paper also reports P=80% improving RAG. RAFT-LLaMA2-7B beat domain-specific fine-tuning (DSF), DSF+RAG and GPT-3.5+RAG on most of PubMed, HotpotQA and Gorilla (e.g. HuggingFace 74.0 against DSF 61.1) — [RAFT](https://arxiv.org/html/2403.10131)
- LAB uses two response "personas": creative (writing/role-play) and precise (STEM/extraction) — [LAB paper](https://arxiv.org/html/2403.01081)
- Fine-tuning on examples the model doesn't already know is learned slowly, and once learned it linearly increases hallucination. The authors conclude that fine-tuning mostly teaches the model to *use* existing knowledge — [Gekhman et al. 2024](https://arxiv.org/abs/2405.05904v3)

### Inferences
- Answer prompt inputs:
  - The use-case style spec (tone, length, format, disclaimers, citation style)
  - The question
  - The oracle chunks with breadcrumbs
  - The document summary
  - An instruction to answer only from the sources, and if they do not contain the answer, to say so and suggest where to look or whom to contact
- Two answer formats:
  - **(a) Closed-book target** (the deployed model has no RAG): a natural answer with no "according to the document", optionally preceded in training data by hidden reasoning. If the deployment is Qwen-style with thinking mode, the RAFT reason/quote can go into a think block.
  - **(b) RAG target:** RAFT format with context in the prompt, citations to chunk IDs, and 1 oracle + 2–4 distractors at P≈0.6–0.8.
- Because of Gekhman et al.'s finding, expect closed-book SFT on genuinely new facts to raise hallucination risk. Mitigate with:
  - Unanswerable/"I don't know" examples (~10%)
  - Repetition and paraphrase of each fact (see §6)
  - Early stopping
  - Preferring RAG plus a RAFT-style SFT whenever facts must be exact

### Gaps
- I found no source that measures the best fraction of "I don't know" examples for SFT. 10% is a heuristic.
- The RAFT oracle fraction P is dataset-dependent, and no universal value exists.

## 5. Quality control, dedupe and contamination

### Takeaway
Filter in stages:
1. Cheap rule filters
2. Question filter
3. Answer judge on faithfulness, helpfulness/completeness, format/style and standalone-ness, with numeric thresholds
4. Optional self-consistency check
5. MinHash near-dup removal
6. Embedding near-dup removal
7. Train/eval split by source chunk, so that no chunk feeds both

Expect to reject roughly 20–40%, and over-generate to compensate.

### Cited Findings
- LAB filters with the teacher as judge on a 3-point rubric: 1 = incorrect/irrelevant/unsafe/incomplete, 2 = correct but brief, 3 = comprehensive, expert and safe. It filters at both the instruction stage and the pair stage — [LAB paper](https://arxiv.org/html/2403.01081)
- synthetic-data-kit's `curate` uses an LLM judge with a numeric threshold: 7.0 by default in the example config, with examples at 7.5–8.5 and batch size 8. The rating scale isn't stated (presumably 1–10) — [synthetic-data-kit](https://github.com/meta-llama/synthetic-data-kit)
- Magpie generated 4M pairs and kept 300K (~7.5%) after filtering, an example of aggressive filtering for general data — [Magpie](https://arxiv.org/html/2406.08464v1)
- NeMo Curator fuzzy dedup uses MinHash+LSH, with a Jaccard threshold default of 0.8 in its connected-components step. Its semantic dedup (SemDedup) uses an epsilon on embedding distance (eps 0.01 default, all-MiniLM-L6-v2 default model) and the docs recommend tuning per dataset — [NeMo Curator docs 24.07](https://docs.nvidia.com/nemo-framework/user-guide/24.07/datacuration/api/deduplication.html), [SemDedup docs 25.04](https://docs.nvidia.com/nemo-framework/user-guide/25.04/datacuration/semdedup.html)
- Augmentoolkit runs separate question-check, answer-accuracy and answer-relevancy stages — [augmentoolkit dataset](https://huggingface.co/datasets/enikeev/tns_augmentoolkit/tree/main)

### Inferences
- **Concrete QC stack:**
  1. **Rules:** JSON parses; length bounds; no "the text/passage" phrases; language matches; no empty or duplicate turns.
  2. **Question judge** (cheap, batched): is it standalone, in scope (or correctly marked out-of-scope), and natural for the persona? Score 1–3 or pass/fail.
  3. **Answer judge,** a 1–5 score per criterion with the source chunks visible:
     - faithfulness (every claim supported)
     - completeness
     - helpfulness
     - format/style compliance with the use-case spec
     - safety/disclaimer compliance (regulated domains)
     - Keep only faithfulness = 5 and the others ≥ 4. Use a different model or family as judge than the generator if the budget allows; self-judging inflates scores.
  4. **Self-consistency** (for hard and multi-hop questions only): regenerate the answer once and have the judge check agreement. Drop disagreements.
  5. **Dedupe:**
     - MinHash (5-gram shingles, Jaccard ≥ 0.8) on question text
     - Then embedding cosine ≥ ~0.92–0.95 on questions *within the same leaf*, keeping the higher-scored item
     - Also cap examples per chunk to keep the dataset diverse
  6. **Eval split:**
     - Hold out ~5–10% (min ~50, max ~500) *by chunk or subtopic group*, not by row, so paraphrased siblings don't leak.
     - Then run a contamination check: remove train items with cosine ≥ 0.9 or high n-gram overlap against any eval question.
     - Also keep a small "general ability" eval to detect catastrophic forgetting.
- **Expected rejection:** this is an inference. LAB and synthetic-data-kit don't publish rates. Plan to over-generate by about 1.5× and log reject reasons per stage.

### Gaps
- I found no published rejection rates for doc-grounded QA pipelines (LAB, synthetic-data-kit, augmentoolkit).
- Embedding-similarity thresholds for SFT question dedupe are not standardised. The 0.92–0.95 range is a practitioner heuristic I could not source.
- I found no source on judge-model agreement with humans specifically for faithfulness in this setting.

## 6. Raw-text continued pretraining vs Q&A vs RAG

### Takeaway
For exact, up-to-date facts, RAG beats fine-tuning, and naive training on raw text barely injects knowledge. If closed-book knowledge is required, train on *many diverse restatements* of each fact (paraphrases, QA in many forms, entity-relation texts) and not on the raw document once. The best default is RAG plus a RAFT-style SFT. Use synthetic continued pretraining only for a premium "memorise my corpus" tier.

### Cited Findings
- Ovadia et al. (Llama2-7B, Mistral-7B, Orca2-7B) found RAG beat unsupervised fine-tuning on both MMLU subsets and a 910-question current-events set:
  - Mistral went from 0.481 base to 0.875 with RAG, against 0.504 with fine-tuning.
  - Llama2 *dropped* to 0.219 after fine-tuning, from 0.353 base.
  - Fine-tuning + RAG was generally worse than RAG alone.
  - — [Ovadia et al.](https://arxiv.org/html/2312.05934v3)
- In the same paper, training on 10 paraphrases per chunk improved fine-tuning: Mistral went from 0.504 to 0.588 and Llama2 from 0.219 to 0.392. Accuracy rose monotonically with the number of paraphrases — [Ovadia et al.](https://arxiv.org/html/2312.05934v3)
- Physics of LMs 3.1: knowledge seen without augmentation can be memorised but not extracted, giving 0% QA accuracy "regardless of subsequent instruction fine-tuning". Augmentation (paraphrasing, sentence shuffling) during pretraining makes knowledge extractable. The authors recommend rewriting data for augmentation and mixing instruction data into pretraining — [Allen-Zhu & Li, ICML 2024](https://arxiv.org/abs/2309.14316v3)
- Synthetic continued pretraining with EntiGraph scaled closed-book QA up to a 455M-token synthetic corpus, while continued pretraining on the raw small corpus or on paraphrases plateaued early. The gains compound with RAG — [Yang et al. 2024](https://arxiv.org/html/2409.07431v2)
- Bonito: next-word prediction on unannotated domain text −0.8 F1, against +22.1 F1 for generated task data — [Bonito](https://arxiv.org/html/2402.18334v2)
- LAB trains knowledge first (short then long answers), then skills, with replay buffers against forgetting — [LAB paper](https://arxiv.org/html/2403.01081)
- Fine-tuning on unknown facts increases hallucination linearly once they are learned — [Gekhman et al.](https://arxiv.org/abs/2405.05904v3)

### Inferences
- Zebrain should **not** offer raw-document continued pretraining on its own as a knowledge feature. It costs tokens and gives weak or negative returns at this scale.
- Recommended tiers:
  - **(1) Default — behaviour/skill SFT + RAG at inference:** teaches format, voice and how to use retrieved context (RAFT data).
  - **(2) "Knows my docs" closed-book:**
    - Each key fact covered by ≥ 5–10 diverse QA/paraphrase variants
    - About 10% unanswerable examples
    - Plus 10–30% general/replay data to limit forgetting
  - **(3) Premium:** EntiGraph-style synthetic CPT (millions of tokens), followed by SFT.
- Communicate to users that fine-tuning learns style and skills reliably but facts only approximately. Precise facts (prices, policies) should stay in RAG.

### Gaps
- All the knowledge-injection results come from 7B-class models (or smaller, in Physics of LMs) and are mostly from 2023–2024. I found no comparable study on Qwen3-family models or on LoRA vs full fine-tuning for knowledge injection.
- I did not fetch the EntiGraph token-to-gain curve, so I can't say how many synthetic tokens per source token are needed at a "few million tokens" budget.

## 7. Use-case variations

### Takeaway
Keep one pipeline and swap a per-use-case "recipe": parsing emphasis, question-type mix, answer style spec, judge criteria, and the share of refusals and disclaimers. Without documents, generate the topic tree from the description (and optionally web search), then use persona-driven and Magpie-style generation with stronger fact-checking.

### Cited Findings
- LAB separates knowledge (document-grounded) from skills (seed-example-driven) and uses response personas: precise for STEM/extraction, creative for writing — [LAB paper](https://arxiv.org/html/2403.01081)
- RAFT was evaluated on API documentation (Gorilla: HuggingFace, Torch Hub, TensorFlow), where fine-tuning helped most (74.0 against 29.1 for GPT-3.5+RAG on HuggingFace). Code/API docs are a strong use case for fine-tuning — [RAFT](https://arxiv.org/html/2403.10131)
- Bonito targets task formats such as extractive QA, yes/no and NLI from domain text, which is relevant to classification/extraction recipes — [Bonito](https://arxiv.org/html/2402.18334v2)
- Magpie needs no seed data and has extensions for multi-turn, domain-specific and multilingual data, which suits the no-documents case — [Magpie](https://arxiv.org/html/2406.08464v1)
- PersonaHub persona conditioning diversifies prompts, and it covers tool/function synthesis — [PersonaHub](https://arxiv.org/html/2406.20094v1)

### Inferences (recipes)

**Customer support**
- Parse FAQs, policies and help-centre pages.
- Mix: 40% how-to, 15% troubleshooting multi-turn, 15% policy edge cases, 15% out-of-scope/escalation ("I'll connect you to an agent"), plus angry and confused personas.
- Style: brand voice, short answers, steps.
- Judge: policy faithfulness and tone.

**Coding assistant**
- Parse code per symbol plus README/API docs.
- Question types: "how do I call X", write a snippet using the API, explain an error, migrate between versions.
- Answers contain code blocks.
- Filter: execute or lint generated code where possible (syntax check at minimum) and check API names against the symbol table to catch hallucinated functions.

**SQL**
- Input is schema/DDL plus CSV samples.
- Generate natural-language questions → SQL. Validate by running each query against an SQLite/DuckDB load of the CSVs, and drop queries that error or return empty when a result was expected.
- Vary the difficulty: joins, aggregates, window functions.

**Tutoring**
- Mix: explanations at multiple levels, worked examples, Socratic multi-turn, misconception correction, quiz generation.
- Judge: pedagogy and correctness.

**Legal, medical and finance**
- Raise the faithfulness threshold. Require citations to the source section.
- Include about 15–20% refusal or "consult a professional" items.
- Add jurisdiction and date caveats, and never invent figures.
- Add a mandatory disclaimer in the style spec and judge compliance with it.
- Prefer RAG + RAFT over closed-book for these.

**Persona and brand voice**
- Documents are mostly style guides and example conversations.
- Generate diverse user prompts (Magpie/persona), then rewrite answers into the voice.
- The judge scores voice adherence against gold examples.
- Include off-topic and adversarial prompts so the bot stays in character safely.

**Extraction and classification (JSON)**
- Inputs are documents with the label schema.
- Generate varied inputs (real chunks plus synthetic perturbations) and gold JSON outputs.
- Validate against a JSON Schema.
- Balance classes, add hard negatives and "none/unknown" labels.
- The eval uses exact match or field-level F1.

**No documents (prompt-only)**
1. The LLM builds a topic tree from the description.
2. Optional web search per leaf collects 3–5 sources, which are parsed like uploads. This becomes grounded generation again, and it's the preferred route.
3. Otherwise run persona × leaf question generation with the generator's own knowledge, and add a stricter self-consistency and judge pass, flagged "ungrounded" in the UI.

### Gaps
- I found no primary-source benchmark for per-use-case mixes. The recipes are engineering judgement built on the cited methods.
- I could not verify the internals of NVIDIA NeMo SDG pipelines, distilabel or the Evol-Instruct and Self-Instruct papers in this session, because the tool budget ran out. They are well-known references, but their claims are not cited here.

## 8. Open-source implementations to learn from

### Takeaway
synthetic-data-kit (simple ingest→create→curate→save-as CLI), InstructLab/LAB (taxonomy + knowledge/skills SDG + 3-point judge + phased training), RAFT (oracle/distractor CoT-with-quotes format), Bonito (task generation from raw text), augmentoolkit (multi-stage validation of factual QA), and Magpie/PersonaHub (diversity without seeds) together cover every stage. Zebrain can borrow prompts and structure from each.

### Cited Findings
- **synthetic-data-kit:** stages ingest/create(qa, cot, summary, multimodal-qa)/curate(LLM judge, threshold ~7)/save-as(alpaca, chatml, OpenAI ft); vLLM or API backends; 4000/200 chunking — [GitHub](https://github.com/meta-llama/synthetic-data-kit)
- **InstructLab/LAB:**
  - About 1.2M samples (617k knowledge, 588k skills) from a Mixtral-8x7B teacher.
  - Training proceeds knowledge short → knowledge long + foundational skills → compositional skills, with replay buffers, constant LR after warmup (cosine destabilised later phases), and early-checkpoint selection.
  - Merlinite-7B scored 7.66 on MT-Bench.
  - — [LAB paper](https://arxiv.org/html/2403.01081), [Red Hat blog](https://www.redhat.com/en/blog/how-instructlabs-synthetic-data-generation-enhances-llms)
- **RAFT:** code and format above — [RAFT](https://arxiv.org/html/2403.10131)
- **Bonito:** 7B model (Mistral-based) trained on 1.65M remixed examples; code at github.com/BatsResearch/bonito — [Bonito](https://arxiv.org/html/2402.18334v2)
- **Augmentoolkit:** MIT-licensed. Factual QA pipeline with question/accuracy/relevancy checks, plus RAG-data and correction pipelines. Notes that small datasets need enough optimizer steps — [augmentoolkit overview](https://www.sourcepulse.org/projects/1833675)
- **NeMo Curator:** MinHash fuzzy dedup and SemDedup — [NeMo docs](https://docs.nvidia.com/nemo-framework/user-guide/25.04/datacuration/semdedup.html)

### Inferences
- **End-to-end Zebrain pipeline (implementable):**
  1. **Parse:** Docling/Marker/trafilatura/tree-sitter/CSV schema card → normalised Markdown with breadcrumbs.
  2. **Chunk:** heading-aware, 800–2000-token units; tables and code atomic; sibling merge.
  3. **Annotate** each chunk (1 call): summary, key facts, entities, content kind, importance.
  4. **Topic tree:** cluster summaries plus document headings → LLM-named tree → user review → per-leaf and per-fact budgets.
  5. **Question gen:** per leaf, with the recipe's type/difficulty/persona matrix; multi-hop from entity-linked chunk pairs; unanswerables from adjacent topics; multi-turn chains. Over-generate 1.5×.
  6. **Question filter:** regex + judge (standalone, in-scope, natural).
  7. **Answer gen:** oracle chunks + summary + style spec. Closed-book or RAFT format (P≈0.7, 2–4 distractors). Reasoning and quotes optional.
  8. **Answer judge:** faithfulness=5, the rest ≥4; self-consistency on hard items; per-domain safety and disclaimer checks; code/SQL execution checks.
  9. **Dedupe:** MinHash 0.8, then embedding within leaf; cap per chunk.
  10. **Split:** eval 5–10% by chunk group, plus a contamination scrub and a general-capability replay/eval set.
  11. **Export:** ChatML/JSONL with metadata (leaf, chunk IDs, type, difficulty, persona, scores) for analytics and re-balancing.
- **Rough token budget for a 200-page corpus (~150k tokens, ~100 chunks, 2,000 final examples):**
  - Annotation: ~0.3M
  - Question gen: ~0.6M
  - Answer gen with context: ~3M (2,000 × 1.5 × ~1k input tokens)
  - Judging: ~1.5M
  - Total: ~5–6M tokens, which fits "a few million" only if answer context is trimmed or judging is batched.
  - This is an estimate, not sourced.

### Gaps
- I did not inspect the current GitHub READMEs of distilabel, NeMo SDG, Evol-Instruct or Self-Instruct.
- I could not confirm augmentoolkit's exact 9-step validation from a primary source.
