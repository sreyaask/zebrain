# Alibaba Cloud Model Studio (DashScope international) — Qwen pricing and limits for Zebrain dataset generation

All prices in USD per 1M tokens, International (Singapore) deployment scope, standard list price unless stated otherwise. Pages were read on 2026-10-27. Each finding gives the "Last Updated" date the page showed. Endpoint for Singapore: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` — [Qwen-Long doc search snippet](https://www.alibabacloud.com/help/en/model-studio/long-context-qwen-long).

## Q1. Token prices per model (tiers, thinking vs non-thinking)

### Takeaway
The earlier numbers check out: qwen3.7-flash is $0.03/$0.13 for requests up to 32K input tokens (tiered higher above that), qwen3.8-flash is $0.15/$0.47, qwen3.7-plus is $0.40/$1.60, and qwen-max is $1.60/$6.40. The current flagship is **qwen3.8-max at $2/$6**. None of the recommended models charges a separate thinking-output price, but reasoning tokens are billed as output tokens. The legacy qwen-plus is the exception, with thinking output at $4 against $1.2 non-thinking.

### Cited Findings
- Pricing page "Model inference pricing", Last Updated Oct 27, 2026: "Model API calls are billed on a pay-as-you-go basis by default." — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
- **qwen3.7-flash** (snapshot qwen3.7-flash-2026-07-15), tiered by input tokens per request:
  - 0–32K: $0.03 in / $0.13 out
  - 32K–256K: $0.10 in / $0.40 out
  - 256K–1M: $0.20 in / $0.80 out
  - No separate thinking price.
  - Sources: [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026); [qwen3.7-flash model page](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-flash) (Oct 11, 2026)
- **qwen3.8-flash**: a single tier from 0 to 1M tokens, $0.15 in / $0.47 out. No thinking/non-thinking split is listed. — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing); [qwen3.8-flash model page](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash) (Oct 11, 2026)
- **qwen-flash** (legacy, snapshot qwen-flash-2025-07-28):
  - 0–256K: $0.05 in / $0.40 out
  - 256K–1M: $0.25 in / $2.00 out
  - Source: [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026)
- **qwen3.7-plus** (snapshot qwen3.7-plus-2026-05-26), list prices:
  - ≤256K: $0.40 in / $1.60 out
  - 256K–1M: $1.20 in / $4.80 out
  - Thinking and non-thinking output are priced the same.
  - The pricing page shows a "Limited-time 20% off" label for Singapore. The model page shows only original prices, "excluding any limited-time promotions".
  - Sources: [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing); [qwen3.7-plus model page](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-plus) (Oct 11, 2026)
- **qwen-plus** (legacy, snapshot qwen-plus-2025-12-01):
  - ≤256K: $0.40 in; output $1.20 non-thinking / $4.00 thinking
  - 256K–1M: $1.20 in; output $3.60 non-thinking / $12.00 thinking
  - Source: [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026)
- **qwen-max** (legacy): $1.60 in / $6.40 out, with no tiers. It is non-thinking only. — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026)
- **qwen3.8-max** (current flagship): $2 in / $6 out for 0–1M tokens. It supports both thinking and non-thinking. — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026)
- The "Recommended models" page leads Text generation with qwen3.8-max ("Complex reasoning and coding"), qwen3.7-plus ("Balanced performance, speed, and cost") and qwen3.8-flash ("Fast and cost-effective"). qwen3.7-flash, qwen-flash, qwen-plus and qwen-max are not on that page. — [Models](https://www.alibabacloud.com/help/en/model-studio/models) (Oct 27, 2026)
- Thinking tokens "are billed at the output token price, thereby increasing costs". — [Batch inference](https://www.alibabacloud.com/help/en/model-studio/batch-inference) (Oct 26, 2026)
- The qwen3.8 series has thinking turned on by default. It is toggled with `enable_thinking`. — [OpenAI Batch API doc, via search snippet](https://www.alibabacloud.com/help/en/model-studio/batch-interfaces-compatible-with-openai) (not fetched in full)
- No Singapore entry was found on the pricing page for qwen3-max or qwen3.8-plus. — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

### Inferences
- **qwen3.7-flash is the cheapest generator when requests stay under 32K input tokens.** It costs about 5x less than qwen3.8-flash on input and about 3.6x less on output. Keeping prompts under 32K matters, because the 32K–256K tier costs 3.3x more for input and about 3x more for output.
- **Thinking mode on qwen3.8-flash and qwen3.8-max can multiply output-token cost.** Chain-of-thought can run up to 262,144 tokens. Zebrain should set `enable_thinking=false` explicitly for bulk generation.
- **The 20% promo on qwen3.7-plus would give about $0.32 / $1.28.** Those numbers are calculated here, not stated on the page. The promo is time-limited, so cost models should use list prices.

### Gaps
- Whether qwen3.7-flash or qwen3.8-flash charges a different output price in thinking mode. Neither the pricing page nor the model pages split the prices, which suggests a single price, but none says so explicitly.
- The end date of the qwen3.7-plus 20% promotion.
- The pricing page did not render clear column labels for qwen3.7-plus. The thinking-equals-non-thinking reading is backed by the model page, which lists a single output price.

## Q2. Context window, max output, and rate limits

### Takeaway
The current Qwen3.7/3.8 models have a 1M-token context window and 131,072 max output tokens. qwen3.7-flash and qwen3.7-plus get 15,000 RPM / 5M TPM in Singapore. qwen3.8-flash and qwen3.8-max use "dynamic" limits tiered by monthly spend. Legacy qwen-max, qwen-plus and qwen-flash get 600 RPM. The docs give no separate tier for new accounts.

### Cited Findings
- qwen3.7-flash limits:
  - Context 1,000,000; max input 991,808 (983,616 in thinking mode)
  - Max output 131,072 in both modes; max chain-of-thought 262,144
  - Singapore: 15,000 RPM / 5,000,000 TPM
  - Source: [qwen3.7-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-flash) (Oct 11, 2026)
- qwen3.7-plus limits:
  - Same context and output limits as qwen3.7-flash
  - Singapore: 15,000 RPM / 5,000,000 TPM
  - The dated snapshot qwen3.7-plus-2026-05-26 gets only 60 RPM / 1,000,000 TPM
  - Source: [qwen3.7-plus](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-plus) (Oct 11, 2026)
- qwen3.8-flash limits:
  - Context 1,000,000; max input 991,808 (983,616 thinking); max output 131,072; max chain-of-thought 262,144
  - "The TPM limit is tiered by your monthly Model Studio spend, and the RPM limit is high enough that normal use does not trigger throttling." No numbers are published.
  - Source: [qwen3.8-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash) (Oct 11, 2026)
- Rate-limit page, Singapore:
  - qwen3.8-max and qwen3.8-flash: "Dynamic Rate Limiting"
  - qwen3.7-max: 600 RPM / 1M TPM
  - qwen3.7-plus: 15,000 RPM / 5M TPM
  - qwen-max: 600 RPM / 1M TPM
  - qwen-plus: 600 RPM / 1M TPM
  - qwen-flash: 600 RPM / 5M TPM
  - text-embedding-v4: 1,800 RPM / 1M TPM
  - Limits are set per account, and "Top Up does not change the model's default RPM and TPM rate limit thresholds". Higher quotas require contacting a business manager.
  - Source: [Rate limits](https://www.alibabacloud.com/help/en/model-studio/rate-limit) (Oct 27, 2026)
- Context windows on the text-generation overview: qwen3.8-max 1M, qwen3.8-flash 1M, qwen3.7-plus 1M, qwen3.7-flash 1M, qwen-flash 1M, qwen-plus 1M, qwen-max 128K, qwen-long 10M. — [Text generation models](https://www.alibabacloud.com/help/en/model-studio/text-generation-model/) (Oct 15, 2026)

### Inferences
- At 5M TPM, one account can push roughly 5M tokens a minute through qwen3.7-flash. Throughput is unlikely to be the bottleneck for a single dataset.
- Zebrain should call the alias `qwen3.7-plus`, not the dated snapshot, because the snapshot is limited to 60 RPM.

### Gaps
- Max output and max chain-of-thought for qwen3.8-max, qwen-flash, qwen-plus and qwen-max. The model detail pages for these were not fetched.
- The numeric dynamic TPM tiers for the qwen3.8 series. They are not published.
- No differentiated new-account rate limits were found.

## Q3. Web search and document/file parsing pricing

### Takeaway
Built-in web search (`enable_search`) costs **$10.00 per 1,000 successful searches in Singapore**, which is about $0.01 per search. This confirms the earlier figure from an official page. The China and other regions pay about $0.57 per 1,000. Retrieved web content is also billed as input tokens. File upload and parsing for Qwen-Long are free, but Qwen-Long's documentation covers only the Beijing region.

### Cited Findings
- Web search, Singapore:
  - The `agent` policy costs "For the Singapore region: $10.00" per 1,000 calls.
  - The `agent_max` policy (limited-time offer) also costs $10.00 per 1,000 for the web search tool; the web extractor tool is "free for a limited time".
  - Billing trigger: "A call is billed when the search service actually completes retrieval and returns a successful result."
  - Retrieved content adds input tokens, which are billed at the model's standard rate.
  - The page lists no free quota.
  - Source: [Web search](https://www.alibabacloud.com/help/en/model-studio/web-search) (Oct 27, 2026)
- No fee is given for the `turbo` and `max` strategies. — [Web search](https://www.alibabacloud.com/help/en/model-studio/web-search)
- Web search model support in Singapore:
  - Supported: the qwen3.8 series (qwen3.8-max, qwen3.8-flash and others) and the qwen3.7 series (qwen3.7-plus, qwen3.7-flash, qwen3.7-max).
  - The qwen3.8 models "do not support `search_strategy: agent`" on Chat Completions.
  - Source: [Web search](https://www.alibabacloud.com/help/en/model-studio/web-search)
- Other regions pay $0.573411 per 1,000 calls for the agent policy (Beijing, Virginia, Hong Kong, Tokyo, Frankfurt). — [Web search, via search snippet](https://www.alibabacloud.com/help/en/model-studio/web-search)
- The separate Web Search MCP service has 2,000 free calls, then CNY 29 per 1,000. Web search fees are not covered by savings plans. If `enable_search` is left on in existing code, every call incurs the fee. — [Web search, via search snippet](https://www.alibabacloud.com/help/en/model-studio/web-search) (not confirmed on a full fetch)
- Qwen-Long:
  - "This document applies only to the Chinese mainland (Beijing) region."
  - Price: $0.072 in / $0.287 out per 1M; Batch at 50%
  - Context 10M; max output 32,768
  - File limits: 150 MB per file (20 MB for images); account quota of 10,000 files or 100 GB
  - "No fees are charged for file upload, storage, or parsing."
  - Source: [Qwen-Long](https://www.alibabacloud.com/help/en/model-studio/long-context-qwen-long) (Oct 23, 2026)
- Qwen-Long, qwen3-max and qwen3.8-plus have no Singapore rows on the pricing page. — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)
- Search snippets mention:
  - A $0.0033/page PDF parsing charge on the Singapore console page for qwen3.8-max
  - Free document parsing for Qwen-Doc-Turbo
  - Singapore qwen-vl-ocr at $0.07/$0.16
  - Source: [search results incl. Qwen-Doc-Turbo](https://www.alibabacloud.com/help/en/model-studio/data-mining-qwen-doc) (unverified; not fetched)

### Inferences
- A dataset build that runs N searches costs about $0.01 × N in search fees, plus the input tokens the results add.
- For user-uploaded PDFs in Singapore, Qwen-Long cannot be relied on. Extracting text locally (for example with pypdf) and sending it as ordinary input tokens to qwen3.7-flash or qwen3.8-flash (1M context) is the safest cost path.

### Gaps
- Fees for the `turbo` and `max` search strategies in Singapore. The docs list fees only for agent and agent_max.
- Whether Qwen-Long is available in Singapore at all.
- The $0.0033/page PDF parsing fee for qwen3.8-max, which was not verified on a fetched page.

## Q4. Batch discount, context caching, and free quota

### Takeaway
- **Batch:** Input and output are both billed at 50% of real-time. Batch is officially available in Singapore only for qwen-max, qwen3.7-plus, qwen-plus and qwen-flash (qwen3.8-max for multimodal input only). It cannot be combined with caching or the free quota.
- **Cache:** Implicit cache hits cost about 20% of input on the overview page, but the per-model pages show about 10–20%. Explicit cache costs 125% to create and 10% to read.
- **Free quota:** New accounts get 1M tokens per model in Singapore, valid for 90 days.

### Cited Findings
- Batch terms:
  - "both input and output tokens are priced at 50% of the real-time inference price"
  - Singapore text models: qwen-max, qwen3.7-plus, qwen-plus, qwen-flash
  - Waiting time: 1–14 days in the console; the API example uses `completion_window="24h"`
  - Limits: up to 50,000 requests and 500 MB per file, 1 MB per line
  - Not eligible for context caching, prepaid plans or new-user free quotas; does support the AI Universal Savings Plan
  - Source: [Batch inference](https://www.alibabacloud.com/help/en/model-studio/batch-inference) (Oct 26, 2026)
- In batch jobs, the per-request context limit is 256K. — [Batch inference, via search snippet](https://www.alibabacloud.com/help/en/model-studio/batch-inference)
- **Conflict over qwen3.7-flash batch support.** The pricing page marks qwen3.7-flash with a 50% batch discount. The qwen3.7-flash model page says "Batch Inference: Unsupported", and qwen3.7-flash is missing from the batch page's Singapore list. qwen3.8-flash batch is "Unsupported". — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) vs [qwen3.7-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-flash) and [qwen3.8-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash)
- The rate-limit page says batch calls on qwen-max, qwen-plus and qwen-flash are "not subject to rate limiting". — [Rate limits](https://www.alibabacloud.com/help/en/model-studio/rate-limit)
- Context cache rules:
  - Explicit cache: creation "Typically 125%" of input, hits "Typically 10%", TTL "5 minutes (resets on hit)"
  - Implicit cache: creation 100%, hits "Typically 20%", TTL indeterminate
  - Minimum 1,024 tokens to cache
  - Explicit cache is supported in Singapore on qwen3.8-max, qwen3.7-plus, qwen-plus, qwen3.8-flash, qwen3.7-flash and qwen-flash, among others
  - Source: [Context cache](https://www.alibabacloud.com/help/en/model-studio/context-cache) (Oct 27, 2026)
- Per-model cache prices, Singapore:

  | Model and tier | Implicit hit | Explicit create | Explicit read |
  |---|---|---|---|
  | qwen3.7-flash ≤32K | $0.006 | $0.038 | $0.003 |
  | qwen3.7-flash 32K–256K | $0.02 | $0.125 | $0.01 |
  | qwen3.7-flash 256K–1M | $0.04 | $0.25 | $0.02 |
  | qwen3.8-flash | $0.016 | $0.20 | $0.016 |
  | qwen3.7-plus ≤256K | $0.08 | $0.50 | $0.04 |
  | qwen3.7-plus 256K–1M | $0.24 | $1.50 | $0.12 |

  Sources: [qwen3.7-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-flash); [qwen3.8-flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash); [qwen3.7-plus](https://www.alibabacloud.com/help/en/model-studio/qwen3-7-plus) (all Oct 11, 2026)
- Free quota:
  - 1M tokens each for qwen3.7-flash, qwen3.8-flash, qwen-flash, qwen3.7-plus, qwen-plus and qwen-max in Singapore
  - "Valid for 90 days from the date of Model Studio activation, model release, or application approval, whichever is later."
  - "No free quota is available in other regions."
  - Source: [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026)

### Inferences
- qwen3.8-flash's implicit-hit price of $0.016 is about 10.7% of input, not the generic "20%". Cost models should use the per-model price.
- **A shared system prompt or seed context of 1,024 tokens or more, repeated across many generation calls, gets cache hits at 10–20% of the input price.** For prompt-heavy dataset jobs this is the main input-cost lever.
- **Batch currently helps only the plus, max and legacy flash models.** For qwen3.7-flash, the batch discount should not be counted on until the conflicting pages are resolved.

### Gaps
- Batch support and price for qwen3.7-flash, because the official pages conflict.
- Whether the 1M free tokens apply once per model or per account in total. The page lists them per model.

## Q5. Embedding model prices

### Takeaway
text-embedding-v4 and text-embedding-v3 both cost **$0.07 per 1M input tokens** in Singapore, and output is free. That is negligible for dedupe and retrieval.

### Cited Findings
- text-embedding-v4 costs $0.07 per 1M input tokens with a free quota of 1M tokens. text-embedding-v3 costs $0.07 per 1M with a free quota of 500,000 tokens. Both are "billed by input tokens", and output is free. — [Model pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) (Oct 27, 2026)
- text-embedding-v4 in Singapore is limited to 1,800 RPM / 1M TPM. — [Rate limits](https://www.alibabacloud.com/help/en/model-studio/rate-limit) (Oct 27, 2026)
- Only text-embedding-v4 appears on the "Recommended models" page; v3 is not listed. — [Models](https://www.alibabacloud.com/help/en/model-studio/models)

### Inferences
- Embedding 10,000 samples of about 500 tokens each (5M tokens) costs about $0.35 before the free quota.

### Gaps
- The batch discount for embeddings in Singapore is not stated.

## Q6. Payment model, spending limits, and budget alerts

### Takeaway
Pay-as-you-go is postpaid: usage is reserved against the balance and settled monthly. Spending can be capped in Budget Management with "Stop Service When Budget Reached", and bill alerts can be set by email. Prepaid options exist: Coding Plan, Token Plan, provisioned throughput and savings plans.

### Cited Findings
- Pay-as-you-go is the default and "does not grant token quotas in advance". Alibaba Cloud "reserve[s] and settle[s] monthly".
- Spending controls:
  - A monthly budget can be set in Budget Management with "Stop Service When Budget Reached" enabled.
  - Bill alerts on the Cost Overview page support a monthly limit, a threshold and email notifications.
  - Available-credit alerts are sent by email.
- Overdue behavior: an account is overdue below a zero balance, and services under the overdue commodity code stop until settled.
- AI general-purpose savings plans cover 3, 6, 12 or 24-month commitments. Discounts are applied in this order: free quota, then model-specific plan, then general plan, then pay-as-you-go.
- Source for all of the above: [Bill query and cost management](https://www.alibabacloud.com/help/en/model-studio/bill-query-and-cost-management) (Oct 20, 2026)
- Web search fees are billed separately and are not covered by savings plans. — [Web search, via search snippet](https://www.alibabacloud.com/help/en/model-studio/web-search)

### Inferences
- Zebrain should advise users to set a budget with "Stop Service When Budget Reached" before running large jobs. The docs do not describe a per-API-key spend cap; only account-level budgets are documented.

### Gaps
- Per-API-key or per-workspace spending caps were not found.
- The minimum top-up or prepayment needed for a new international account was not found.
- How quickly the budget stop takes effect (its latency) is not documented.
