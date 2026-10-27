# Zebrain

Make your own LLM. Pick a base model, describe the job and choose data. Zebrain sends a training job to the
user's own Kaggle account, where it runs on a free T4 GPU, and publishes the result to their Hugging Face account.

Each run:

1. Checks the GPU, the Hugging Face token and access to gated base models before doing anything slow
2. Loads the data with time limits, detects question/answer columns, drops duplicate, broken and off-brand rows,
   converts SQL to the dialect the job asks for, and doubles the harder examples
3. Tests the untouched base model, trains with QLoRA, and tests again on held-back questions plus identity and
   off-topic checks
4. Trains up to two more rounds, continuing from the same adapter, if the tester isn't satisfied
5. Publishes the best version as `v1`, `v2`, … with a model card showing before/after scores
6. Optionally opens a chat and `/ask` API on the same Kaggle GPU for an hour (Gradio share link + API key), and
   points a free **static** Space (`<user>/<model>-chat`, plain HTML + `@gradio/client`) at it. Gradio and Docker
   Spaces need Hugging Face PRO, so Zebrain doesn't create them

The model's identity and job are built into its chat template, so it answers as itself even when an app sends no
system prompt (Qwen's template otherwise inserts "You are Qwen, created by Alibaba Cloud"). Training and the tester
cover identity, "what can you do" questions, greetings and a wide set of off-topic questions, all without a system
prompt, plus the same under generic system prompts.

A **fix run** takes questions the model got wrong plus the right answers, turns each into ~20 examples
(reworded by Zebrain AI), mixes in earlier data so it doesn't forget, continues training the
latest adapter, and publishes only if the fix passes and the old test questions don't get worse.

## Run the site

```bash
npm install
npm run dev
```

Open http://localhost:3000. It deploys to Vercel with no environment variables: users' keys stay in their browser
and are sent to the API routes only when a run starts or checks in.

## Zebrain AI as the engine

All AI work goes through Zebrain's own AI gateway (`/api/qwen`), never a user key or a third-party key in a job:

- **Let AI choose** (`/api/plan`, Basic): the AI writes Hugging Face search phrases, Zebrain fetches two real rows from
  each open-licensed candidate (datasets-server API), and the AI picks 1–3 that fit the job.
- **Free trial and Pro**: the AI plans the model, writes the dataset from documents or web research, checks every
  answer, and writes the held-back exam.
- **Fix and Testify**: a small AI budget per run rewords corrections, writes exams, grades and writes practice.
- Jobs get only a short-lived run token tied to a token budget; the AI key stays on the server.

## Accounts and data (Supabase)

Supabase project `zebrain` (`svzlutjbsthhxbhpuaef`, Mumbai). `.env.local` holds its URL and publishable key.

- Sign-in: email + password (no confirmation email) and Google. `middleware.ts` sends signed-out visitors on
  `/new`, `/runs`, `/chat`, `/fix`, `/connect` to `/login?next=…`; Google returns through `/auth/callback`
- Tables (row-level security: users only ever see their own rows): `profiles` (made on sign-up), `connections`
  (Kaggle/Hugging Face tokens, encrypted, read only by the API routes), `runs`
- API routes read the signed-in user's keys server-side (`lib/supabase/server.ts`), so keys never travel from the
  browser after they're saved once on `/connect`
- Dashboard switches the code can't set: Authentication → Sign In / Providers → Email → turn **Confirm email**
  off; Google provider (client ID/secret from Google Cloud, redirect `https://svzlutjbsthhxbhpuaef.supabase.co/auth/v1/callback`);
  Authentication → URL Configuration → add `http://localhost:3100/auth/callback` (and your domain's) to Redirect URLs

## Using it

1. `/connect`: Kaggle username + API key (phone-verified account, for GPU and internet) and a Hugging Face write token
2. `/new`: the wizard. The last step, **Train on Kaggle**, starts the run
3. `/runs`: live progress (stages, training step and loss, tester scores, log), and "start again" from the last checkpoint
4. `/chat`: open a chat for any version on Kaggle for 1–8 hours; shows the share link, API key and a
   `gradio_client` example. "Teach it the right one" in the chat saves corrections to the state repo
5. `/fix`: corrections (pre-filled from the chat), name/maker changes, versions

## Where things live

- `lib/zebrain_train.py`: the training job. Plain Python so it can be tested on its own; `/api/runs` fills in its config
- `<user>/<model>-zebrain` (private HF repo): `progress.json`, checkpoints, every version's adapter, test set, reports,
  `corrections.json` (from the chat) and `chat.json` (the open chat's link and API key)
- `<user>/<model>` (HF repo): the merged model, tagged per version
- `app/api/runs`: pushes the job to Kaggle (`kernels.KernelsApiService/SaveKernel`); `app/api/runs/status` reads
  Kaggle's status and `progress.json`; `app/api/models` lists versions, saved corrections and the open chat
- `lib/models.ts`, `lib/hf.ts`: base models, templates, dataset search

## Notes

- The Hugging Face token is embedded in the user's private Kaggle script so the job can publish. Suggest a token
  they can revoke.
- Package versions in the job are pinned (`PINS` in `lib/zebrain_train.py`). If Kaggle's image changes and an install
  fails, update them there.
- Gated models (Gemma, Llama) need their terms accepted first; `/api/runs` checks before pushing.
- Base models (`lib/models.ts`) are open-source chat models that already converse well: Qwen3.5 4B/9B, Qwen3 4B
  Instruct, Phi-4 mini, Gemma 4 E4B and Granite 4.2 8B (Apache 2.0 or MIT, none gated). They need transformers 5.
  Thinking modes are switched off in every prompt (`enable_thinking=False`), LoRA targets text layers only
  (`LORA_TARGETS`), and models over 5B parameters are served in 4-bit so they fit the T4. Check any new base model
  with `tests/test_base_models.py` (transformers 5 + peft + torch, CPU only, tiny random-weight copies).
- GPU memory (the T4 has ~14.5 GiB usable). Rules in `lib/zebrain_train.py`, checked by `tests/test_memory.py`:
  - `prepare_kbit` replaces peft's `prepare_model_for_kbit_training`, which upcast the embeddings and output layer to
    fp32 (2 × 3.8 GiB for Qwen3.5's 248k vocabulary) and crashed 9B runs. Never call peft's version.
  - Models over 6B parameters spread over both of Kaggle's T4s (`use_gpus`, `device_map="balanced"`) and serve in
    fp16 across both; with one T4 they still fit (4-bit, examples capped at 1,024 tokens).
  - The tester batches by a token budget and halves on out-of-memory; training retries a round on shorter examples;
    chat answers "too long" instead of crashing. `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True` is set.
- Llama fine-tunes get a `llama-` name prefix and "Built with Llama" on the card, as its licence requires.

## Switching on the free trial, Pro and Qwen

Everything is built; each part switches on when its keys are in `.env.local` (restart the server after adding them):

| Key | Switches on |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Free trial, payments and token budgets (server-only writes) |
| `QWEN_API_KEY` (optional `QWEN_BASE_URL`, `QWEN_MODEL`) | Qwen writing datasets and testing, through `/api/qwen` |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Pro checkout (test-mode keys first) |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook backup at `/api/webhooks/razorpay` (events: payment.captured, order.paid) |
| `RUNPOD_API_KEY` (optional `RUNPOD_IMAGE`, `RUNPOD_CLOUD`) | Pro training on Zebrain's GPUs |
| `PUBLIC_URL` | Zebrain's public address; jobs on Kaggle/RunPod reach the Qwen gateway there (not localhost) |
| `PRICE_CURRENCY`, `USD_INR` | Charge in INR (default, rate 88) or USD |

Plans: Free trial (once, Qwen-written data, tested, Kaggle, ≤9B) · Basic (free, AI-picked datasets, no tests, Kaggle,
≤9B) · Pro / Pro Extreme (paid per model, priced by `lib/quote.ts`, RunPod, ≤9B / ≤14B).
