# RunPod GPU Pricing and LoRA/QLoRA Fine-Tuning Speed and Memory (researched 2026-10-27)

## Q1. Current RunPod prices (Pods: Community vs Secure; Serverless flex vs active; storage; spot)

### Takeaway
RunPod's pricing page says it was updated 8 October 2026. The cheapest cards that can train these models are the RTX A5000 (24 GB, $0.16/h Community) and the A40 or RTX A6000 (48 GB, $0.33 to $0.35/h Community). T4 is no longer on the Pod price list. Serverless costs roughly 1.5 to 4x the Community Pod rate, so on-demand Pods (or spot Pods with checkpointing) are the cheaper way to run training jobs.

### Cited Findings
- **Pod prices, on-demand, USD per hour. The page says "Updated October 8, 2026" (dateModified 2026-10-08).** [RunPod pricing](https://www.runpod.io/pricing)

| GPU | VRAM | Secure Cloud | Community Cloud |
|---|---|---|---|
| RTX A5000 | 24 GB | $0.27 | $0.16 |
| RTX 3090 | 24 GB | $0.50 | $0.22 |
| RTX 4090 | 24 GB | $0.89 | $0.34 |
| L4 | 24 GB | $0.59 | $0.44 |
| Pro 6000 MIG 24GB | 24 GB | $0.69 | $0.50 |
| RTX 5090 | 32 GB | $1.19 | $0.69 |
| RTX A6000 | 48 GB | $0.59 | $0.33 |
| A40 | 48 GB | $0.59 | $0.35 |
| L40 | 48 GB | $0.82 | $0.69 |
| RTX 6000 Ada | 48 GB | $0.99 | $0.74 |
| L40S | 48 GB | $1.09 | $0.79 |
| Pro 6000 MIG 48GB | 48 GB | $1.29 | $1.00 |
| A100 PCIe 80GB | 80 GB | $1.79 | $1.19 |
| A100 SXM 80GB | 80 GB | $1.79 | $1.39 |
| H100 PCIe | 80 GB | $2.89 | $1.99 |
| H100 SXM | 80 GB | $3.99 | $2.69 |
| H100 NVL | 94 GB | $3.19 | $2.59 |
| RTX Pro 6000 | 96 GB | $2.49 | $1.69 |
| H200 | 141 GB | $5.29 | $3.59 |
| B200 | 180 GB | $7.99 | $5.98 |

- **T4 is not on the October 2026 Pod price list.** No T4 row appears among the Pod or Serverless tiers. [RunPod pricing](https://www.runpod.io/pricing)
- **Serverless, per GPU-hour, from the same page dated 2026-10-08.** The page shows one rate per tier and does not break out flex and active:
  - L4, A5000, 3090 or MIG 24GB: $0.69
  - 4090: $1.10
  - 5090: $1.58
  - A6000 or A40: $1.22
  - L40, L40S, 6000 Ada or MIG 48GB: $1.75
  - A100: $2.72
  - H100: $4.79
  - H200: $5.93
  - 16 GB tier (A4000, A4500, RTX 4000, RTX 2000): $0.58

  [RunPod pricing](https://www.runpod.io/pricing)
- **Serverless flex vs active, per second.** A search summary of RunPod docs and the pricing page gave these figures:
  - 4090 PRO: $0.00031 flex, $0.00021 active (about $1.12/h and $0.76/h)
  - A100: $0.00076 flex, $0.00060 active (about $2.74/h and $2.16/h)
  - H100 PRO: $0.00116 flex, $0.00093 active (about $4.18/h and $3.35/h)

  When I fetched the docs page, it no longer had a per-second table and only linked to the pricing page, so treat these as unverified. They roughly match the hourly serverless figures above, and active runs about 20 to 30% below flex. [RunPod serverless pricing docs](https://docs.runpod.io/serverless/pricing)
- **Serverless billing rules:**
  - Billing runs from worker start to full stop, rounded up to the nearest second.
  - Cold start (loading the model into GPU memory) is billed. Pulling the container image and downloading cached models while scaled down is not.
  - The default idle timeout is 5 s.
  - Flex workers scale to zero. Active workers are always on, and discounts for them go through sales.
  - The docs state no minimum billing duration.
  - The default account spend limit is $80/h.

  [RunPod serverless pricing docs](https://docs.runpod.io/serverless/pricing)
- **Storage (2026-10-08):**
  - Container disk: $0.10/GB/month
  - Volume disk: $0.10/GB/month while running, $0.20/GB/month while idle
  - Network storage: $0.07/GB/month under 1 TB, $0.05/GB/month over 1 TB
  - High-performance network storage: $0.14/GB/month

  [RunPod pricing](https://www.runpod.io/pricing)
- **Spot or interruptible pricing.** The official page lists no spot prices. A third party (DeployBase, March 2026) reported spot at about 64 to 70% below on-demand: H100 PCIe $0.72 vs $1.99, H100 SXM $0.81 vs $2.69, A100 PCIe $0.42 vs $1.19. Other 2026 guides give 30 to 70% savings. Spot capacity can be reclaimed, so jobs need checkpoint and resume. [DeployBase spot pricing](https://deploybase.ai/articles/spot-gpu-pricing); [Hivenet RunPod pricing guide](https://www.hivenet.com/post/runpod-pricing-complete-guide-to-gpu-cloud-costs)
- **Clusters:** H200 SXM $6.35/h and A100 SXM $2.15/h. [RunPod pricing](https://www.runpod.io/pricing)

### Inferences
- **Storage cost for one run is negligible.** A 30 to 60 GB container disk held for 2 hours costs well under $0.01. A persistent network volume caching base models costs, for example, 200 GB × $0.07 = $14/month.
- **Community vs Secure.** Community is 30 to 60% cheaper but runs on third-party hosts with variable reliability. Secure is the safer default for a paid product. The cost model should use Secure prices as the default and Community as the "economy" option.
- **Pods vs Serverless.** Serverless per-hour prices are 1.5 to 4x the Community Pod rate for the same GPU: A5000 $0.69 vs $0.16, A6000 $1.22 vs $0.33, A100 $2.72 vs $1.19. Serverless is only worth it for its operational simplicity (scale to zero, no orchestration). Training jobs of 20 minutes or more are cheaper on Pods started via the API and terminated at the end.

### Gaps
- I could not confirm current per-second flex and active rates on an official page. The docs page now only links to the pricing page.
- I found no official RunPod spot price list for October 2026. The spot figures above come from a third party and are older (March 2026).
- I found no per-GPU breakdown of PCIe vs SXM pricing for serverless A100 and H100.

## Q2. VRAM needed for QLoRA (4-bit) and bf16 LoRA at 1.5B, 4B, 8 to 9B, and 14B (sequence length 1.5K to 2K, batch 1 to 2)

### Takeaway
With Unsloth plus gradient checkpointing, QLoRA fits comfortably in 16 GB at every size up to 14B. bf16 LoRA needs about 10 GB at 4B, about 22 GB at 8 to 9B and about 33 GB at 14B, so a 9B model on a 24 GB card is borderline and a 14B model needs a 48 GB card. Unsloth explicitly recommends not using QLoRA for Qwen3.5, which matters a great deal for Zebrain's default config.

### Cited Findings
- **Unsloth's minimum VRAM (QLoRA vs bf16 LoRA)** [Unsloth requirements](https://docs.unsloth.ai/get-started/beginner-start-here/unsloth-requirements):
  - 7B: 5 GB vs 19 GB
  - 8B: 6 GB vs 22 GB
  - 14B: 8.5 GB vs 33 GB
  - 70B: 41 GB vs 164 GB

  Unsloth describes these as floors that rise with batch size and context length.
- **Qwen3.5 bf16 LoRA VRAM, from Unsloth's Qwen3.5 guide:**
  - 0.8B: 3 GB
  - 2B: 5 GB
  - 4B: 10 GB
  - 9B: 22 GB
  - 27B: 56 GB

  The same guide says it is "not recommended to do QLoRA (4-bit) training on the Qwen3.5 models, no matter MoE or dense," because quantization differences are higher than normal. It claims Qwen3.5 trains 1.5x faster with 50% less VRAM than FA2 setups, and notes that Mamba-style Triton kernel compilation is slow on T4. [Unsloth Qwen3.5 fine-tune guide](https://unsloth.ai/docs/models/qwen3.5/fine-tune)
- **Measured:** Llama 3.1 8B QLoRA with Unsloth (2026.6.9) at max sequence length 2048, batch 2, grad accumulation 4, peaked at 6.6 GB reserved on an RTX 4090. The LoRA adapter was 185 MB and the merged 16-bit checkpoint about 16 GB. [ComputingForGeeks (updated Aug 2026)](https://computingforgeeks.com/fine-tune-llm-unsloth-qlora/)
- **Maximum context, Llama 3.1 8B QLoRA, rank 32, batch 1 (Unsloth vs plain HF+FA2):** [Unsloth benchmarks](https://unsloth.ai/docs/basics/unsloth-benchmarks.md)
  - 8 GB: 2,972 vs OOM
  - 12 GB: 21,848 vs 932
  - 16 GB: 40,724 vs 2,551
  - 24 GB: 78,475 vs 5,789
- **torchtune QLoRA 8B on a 4090:** about 7.4 GiB peak, as reported secondhand. [buildmvpfast](https://www.buildmvpfast.com/blog/fine-tune-llm-laptop-qlora-local-gpu-2026)

### Inferences
These are VRAM planning numbers for r=16, sequence length about 1.5K, batch 1 and gradient checkpointing. QLoRA sizes are interpolated from Unsloth's table, and the 1.5B figures are interpolated from Qwen3.5 0.8B and 2B.

| Size | QLoRA, Unsloth | QLoRA, plain HF+PEFT | bf16 LoRA, Unsloth | Smallest card for bf16 LoRA |
|---|---|---|---|---|
| 1.5B | ~3 to 4 GB | ~5 to 6 GB | ~4 to 5 GB | any 16 to 24 GB |
| 4B | ~4 to 5 GB | ~7 to 9 GB | ~10 GB | 16 GB, comfortable on 24 GB |
| 8 to 9B | ~6 to 8 GB | ~11 to 14 GB (fits 16 GB at 1.5K per the HF+FA2 2,551-token figure) | ~22 GB | 24 GB is tight, 32 GB (5090) or 48 GB is safe |
| 14B | ~9 to 11 GB | ~16 to 20 GB | ~33 GB | 48 GB (A40, A6000, L40S) |

- **Implications for Zebrain's config.** For the Qwen3.5 4B and 9B targets, Zebrain should probably switch to bf16 LoRA, following Unsloth's guidance. That moves 9B training from a 16 GB card to a card with at least 24 GB, preferably 32 to 48 GB. QLoRA remains reasonable for Qwen3, Phi-4 mini, Granite and 14B models.
- **Gemma 4 E4B.** Its raw parameter count is larger than its "effective 4B" because of per-layer embeddings. Budget VRAM like a 6 to 8B model in bf16 and compute like a 4B model. This is an inference, not verified.

### Gaps
- I found no published VRAM figures specific to Gemma 4 E4B, Granite 4.2 8B, Phi-4 mini or Qwen3 4B Instruct. The figures above are interpolated from model size.
- I found no measured VRAM for bf16 LoRA at 1.5K tokens with batch 2 for a 14B model.

## Q3. Realistic training throughput by size and GPU, plus Unsloth speedup

### Takeaway
Published absolute throughput figures for QLoRA are sparse and inconsistent. The best approach is a FLOPs model: about 6·N FLOPs per token for LoRA with gradient checkpointing, at roughly 15 to 30% of peak dense bf16 (model FLOPs utilization, MFU). This model reproduces both Zebrain's Kaggle T4 measurement and the one published 4090 figure. Expect roughly ±40% error, and calibrate with a 20-step smoke run per GPU type.

### Cited Findings
- **Unsloth vs plain HF:**
  - On an A100 40GB, Unsloth was 1.87 to 1.94x faster than HF on 7B and 34B models (2.74x on TinyLlama 1.1B) and used 23 to 66% less VRAM.
  - On a T4, Unsloth was 1.56 to 1.95x faster on 7B models and 3.87x faster on 1.1B.
  - These figures are from January 2024 and are older. [HF blog: Unsloth + TRL (Jan 2024)](https://huggingface.co/blog/unsloth-trl)
  - Current Unsloth docs claim about 2x speed and more than 70% VRAM reduction for Llama 3.1 8B vs HF+FA2 (batch 2, grad accumulation 4, rank 32, Alpaca). The page is undated and does not name the GPU. [Unsloth benchmarks](https://unsloth.ai/docs/basics/unsloth-benchmarks.md)
  - The Qwen3.5 page claims 1.5x. [Unsloth Qwen3.5](https://unsloth.ai/docs/models/qwen3.5/fine-tune)
- **Absolute throughput, Llama 3.1 8B QLoRA with Unsloth:** about 520 tok/s on an RTX 4090 and about 720 tok/s on an RTX 5090. With Axolotl, 13B QLoRA ran at about 400 tok/s (4090) and 480 tok/s (5090). Sequence length and batch size were not stated, and this is a vendor blog (published May 2026, modified Oct 2026). [Spheron](https://www.spheron.network/blog/rtx-5090-vs-rtx-4090/)
- **H100:** about 6,500 tok/s for Llama 3.1 8B at 4K context with Unsloth vs about 3,200 with vanilla HF+PEFT. This comes from an unverified third-party knowledge base, via a search summary. [Yobitel KB](https://yobitel.com/knowledge-base/unsloth)
- **Small end-to-end runs:**
  - 55 Q/A pairs × 3 epochs took 33.5 s (4.9 samples/s) for 8B QLoRA on a 4090. The examples were very short, so this is not useful for tokens/s. [ComputingForGeeks](https://computingforgeeks.com/fine-tune-llm-unsloth-qlora/)
  - A Gemma 4 31B LoRA run (8 GPUs, sequence length 2048, packed) reached 4,746 tok/s on A100 and 9,559 tok/s on H100. It is unclear whether these are aggregate or per-GPU figures. H100 cost per token was about the same as A100 (1.04x), and B200 was about 1.6x faster than H100. [VESSL (June 2026)](https://vessl.ai/en/blog/lora-finetuning-cost-a100-h100-b200)
- **Generic estimate:** fine-tuning 7B on 1K to 10K examples takes about 15 to 60 minutes on a free T4. The source gives no basis for this. [Menon Lab](https://themenonlab.blog/blog/unsloth-studio-colab-finetune-500-models)

### Inferences
**The throughput model.** The script for the table below (`calc.py`) was in a temporary scratchpad and was not saved with these notes. Its parameters are listed here.

- Formula: tok/s = MFU × peak dense fp16/bf16 TFLOPs / (6 × params).
- Peak dense TFLOPs used:
  - T4: 65
  - L4: 121
  - A5000: 111
  - A40: 150
  - A6000: 155
  - 4090: 165 (fp32 accumulate)
  - 5090: about 209
  - L40S: 362
  - A100: 312
  - H100 PCIe: 756
- MFU used:
  - 0.22 on most cards
  - 0.15 on L4 (72 W power cap)
  - 0.28 on A100
  - 0.25 on H100
  - 1.5B models get 0.6x these values, because small models are overhead-bound at batch 1.

**Sanity check against Zebrain's Kaggle T4 measurement.** Qwen3.5-9B QLoRA took about 40 s per step with 1 × 16 sequences. If real sequences average about 600 tokens, that is 9,600 tokens / 40 s ≈ 240 tok/s, or 6 × 9e9 × 240 ≈ 13 TFLOPs, which is about 20% MFU on a T4. That is consistent with the model. If sequences were padded to the full 1.5K, it would imply 600 tok/s, about 50% MFU, which is implausible for a T4. So 240 tok/s at 9B is the right T4 anchor.

**Second check.** The Spheron figure of 520 tok/s for 8B on a 4090 implies about 15% MFU. The model gives 756 tok/s for 8B and 672 tok/s for 9B on a 4090, about 30% above Spheron. Treat the 24 GB consumer-card figures as optimistic by up to 30%.

**Estimated throughput (tokens/s), QLoRA with Unsloth, batch 1, sequence about 1.5K, gradient checkpointing:**

| GPU | 1.5B | 4B | 9B | 14B |
|---|---|---|---|---|
| T4 (Kaggle anchor) | ~900 | ~550 | ~240 (measured) | ~150 |
| L4 | 1,210 | 756 | 336 | 216 |
| A5000 | 1,628 | 1,018 | 452 | 291 |
| RTX 4090 | 2,420 | 1,512 | 672 | 432 |
| RTX 5090 | 3,065 | 1,916 | 851 | 547 |
| A40 / A6000 | ~2,240 | ~1,400 | ~620 | ~400 |
| L40S | 5,309 | 3,318 | 1,475 | 948 |
| A100 80GB | 5,824 | 3,640 | 1,618 | 1,040 |
| H100 PCIe | 12,600 | 7,875 | 3,500 | 2,250 |

The T4 row for 1.5B, 4B and 14B is extrapolated from the 9B measurement.

- **Minutes per 1,000 examples of about 600 tokens (600K tokens).**
  - 4B: about 10 min (A5000), 6.6 min (4090), 3 min (A100 or L40S)
  - 9B: about 22 min (A5000), 15 min (4090), 6.5 min (A100)
  - 14B: about 34 min (A5000), 10 min (A100)
- **bf16 LoRA vs QLoRA.** bf16 LoRA skips the per-matmul dequantization, so on a card where it fits it is typically somewhat faster than QLoRA (I estimate 10 to 30%; no source found). The numbers above are therefore a conservative estimate for bf16 LoRA.
- **Plain HF Trainer + PEFT.** Expect about 1.5 to 2x slower than Unsloth (sources above). If Zebrain does not use Unsloth, roughly double the training minutes.
- **Packing.** Packing short examples into 1.5K sequences can raise effective throughput further, because batch-1 unpacked training underuses large GPUs.

### Gaps
- I found no rigorous, like-for-like published tokens/s benchmark across GPUs at 4B, 9B and 14B for the 2026 models. The per-GPU figures above are modeled, not measured.
- I found no L4 or A5000 fine-tuning throughput data.
- Qwen3.5's hybrid linear-attention layers may change speed relative to standard transformers; the T4 kernel compilation note in Unsloth's guide hints at this.

## Q4. Overhead per run (startup, Hugging Face download, merge, upload) and total billed minutes

### Takeaway
I found no measured RunPod figures. A reasonable planning estimate of fixed overhead is about 7 min at 1.5B, 10 min at 4B, 15 min at 9B and 20 min at 14B. Merging and uploading the fp16 model is the largest part, and it scales with model size.

### Cited Findings
- **RunPod network:** RunPod marketing cites 200 Gbps networking, but this is not a Hugging Face download benchmark. Pods can be created with a minimum download speed filter. Trustpilot users report slow transfers on some data centers. [RunPod article](https://www.runpod.io/articles/guides/bare-metal-gpus-for-ai-workloads); [Trustpilot](https://dk.trustpilot.com/review/runpod.io)
- **Download sizes:** the 4-bit pre-quantized 8B download is about 5 GB, vs 16 GB at full precision. The merged 16-bit 8B checkpoint is about 16 GB, and GGUF Q4_K_M conversion takes about 3 min. [ComputingForGeeks](https://computingforgeeks.com/fine-tune-llm-unsloth-qlora/)
- **Model loading:** on a free T4 the model-load cell typically finishes in under 2 minutes, mostly weight download. [Towards AI tutorial](https://pub.towardsai.net/how-i-fine-tuned-an-8-b-parameter-ai-model-on-a-free-gpu-and-you-can-too-06d44f246b5a)
- **torch.compile:** warm-up can take 5 minutes or more. [Unsloth benchmarks](https://unsloth.ai/docs/basics/unsloth-benchmarks.md)
- **Serverless:** image pull and cached-model download while scaled down are not billed, but cold-start model loading is. [RunPod serverless docs](https://docs.runpod.io/serverless/pricing)

### Inferences
These are planning estimates, not measured. They assume 100 to 300 MB/s download from Hugging Face and 50 to 150 MB/s upload to the Hugging Face Hub.

| Phase | 1.5B | 4B (8 GB fp16) | 9B (18 GB fp16) | 14B (28 GB fp16) |
|---|---|---|---|---|
| Pod boot + image pull (cached image) | 1 to 2 min | 1 to 2 min | 1 to 2 min | 1 to 2 min |
| Hugging Face base download (bf16) + load/quantize | 1 min | 1.5 to 2 min | 2 to 4 min | 3 to 5 min |
| Eval/tokenize dataset | <1 min | <1 min | <1 min | <1 min |
| Merge LoRA → fp16 (dequantize + save) | 1 min | 1 to 2 min | 2 to 4 min | 3 to 5 min |
| Upload merged fp16 to Hugging Face | 1 to 2 min | 1 to 3 min | 2 to 6 min | 4 to 9 min |
| **Planning overhead** | **~7 min** | **~10 min** | **~15 min** | **~20 min** |

- **Ways to cut overhead:**
  - Bake dependencies into a custom image.
  - Cache base models on a network volume ($0.07/GB/month) in the same data center as the pods.
  - Upload only the LoRA adapter (about 100 to 200 MB) and merge lazily or on the inference side.
  - Skip torch.compile for short jobs.
  - Terminate the pod programmatically right after the upload finishes.

### Gaps
- I found no measured Hugging Face download or upload throughput from RunPod pods.
- I found no measured merge time for 4B to 14B models.

## Q5. Recommendation table, cost math for 2,000- and 5,000-example runs, and when 2 GPUs make sense

### Takeaway
On RunPod Community prices (2026-10-08), the RTX A5000 at $0.16/h is the cheapest per run at every size whose memory fits. The A6000 or A40 ($0.33 to $0.35/h, 48 GB) is the cheapest safe choice for 9B bf16 LoRA and for 14B. The L40S or A100 is the "fast" tier at 1.5 to 3x the cost. Even a 14B, 5,000-example, 3-epoch run costs about $1.50 to $3.50 in GPU time on Community, or up to about $5 on Secure. Two GPUs rarely make sense for these sizes.

### Cited Findings
- All prices are from [RunPod pricing (updated 2026-10-08)](https://www.runpod.io/pricing). Throughput comes from the Q3 model, calibrated against the Zebrain Kaggle T4 measurement and [Spheron](https://www.spheron.network/blog/rtx-5090-vs-rtx-4090/).
- H100 cost per token was about equal to A100 (1.04x) on a VESSL LoRA benchmark, so faster GPUs do not cut cost per token, only wall-clock time. [VESSL](https://vessl.ai/en/blog/lora-finetuning-cost-a100-h100-b200)

### Inferences
**Cost formula.** Use this per (model, GPU):

`billed_min = overhead_min(size) + (examples × avg_tokens × epochs) / tok_per_s(size, gpu) / 60`

`cost = billed_min / 60 × price_per_hour`

**Training tokens per run** (600 tokens per example):

| Run | Tokens |
|---|---|
| 2,000 examples × 3 epochs | 3.6M |
| 2,000 examples × 1 epoch | 1.2M |
| 5,000 examples × 3 epochs | 9.0M |
| 5,000 examples × 1 epoch | 3.0M |

**Worked examples:**

- 9B, 2,000 examples × 3 epochs on an A6000 (631 tok/s):
  - Training: 3.6M / 631 / 60 = 95 min
  - Billed: 95 + 15 overhead = 110 min
  - Cost: 110/60 × $0.33 = $0.61 (Community), or × $0.59 = $1.08 (Secure)
- 4B, 5,000 examples × 1 epoch on an A5000 (1,018 tok/s):
  - Training: 3.0M / 1,018 / 60 = 49 min
  - Billed: 49 + 10 = 59 min
  - Cost: 59/60 × $0.16 = $0.16 (Community), or × $0.27 = $0.27 (Secure)

**Billed minutes and cost per run.** Each cell shows total billed minutes, then the Community cost and the Secure cost.

**1.5B** (overhead 7 min):

| GPU | 2k×3 | 2k×1 | 5k×3 | 5k×1 |
|---|---|---|---|---|
| A5000 | 44m, $0.12 / $0.20 | 19m, $0.05 / $0.09 | 99m, $0.26 / $0.45 | 38m, $0.10 / $0.17 |
| 4090 | 32m, $0.18 / $0.47 | 15m, $0.09 / $0.23 | 69m, $0.39 / $1.02 | 28m, $0.16 / $0.41 |
| A6000 | 33m, $0.18 / $0.33 | 16m, $0.09 / $0.16 | 73m, $0.40 / $0.72 | 29m, $0.16 / $0.29 |
| L40S | 18m, $0.24 / $0.33 | 11m, $0.14 / $0.20 | 35m, $0.46 / $0.64 | 16m, $0.22 / $0.30 |
| A100 | 17m, $0.34 / $0.52 | 10m, $0.21 / $0.31 | 33m, $0.65 / $0.98 | 16m, $0.31 / $0.46 |

**4B** (overhead 10 min):

| GPU | 2k×3 | 2k×1 | 5k×3 | 5k×1 |
|---|---|---|---|---|
| A5000 | 69m, $0.18 / $0.31 | 30m, $0.08 / $0.13 | 157m, $0.42 / $0.71 | 59m, $0.16 / $0.27 |
| L4 | 89m, $0.66 / $0.88 | 36m, $0.27 / $0.36 | 208m, $1.53 / $2.05 | 76m, $0.56 / $0.75 |
| 4090 | 50m, $0.28 / $0.74 | 23m, $0.13 / $0.34 | 109m, $0.62 / $1.62 | 43m, $0.24 / $0.64 |
| A6000 | 52m, $0.29 / $0.51 | 24m, $0.13 / $0.24 | 116m, $0.64 / $1.14 | 45m, $0.25 / $0.44 |
| L40S | 28m, $0.37 / $0.51 | 16m, $0.21 / $0.29 | 55m, $0.73 / $1.00 | 25m, $0.33 / $0.46 |
| A100 | 26m, $0.53 / $0.79 | 15m, $0.31 / $0.46 | 51m, $1.02 / $1.53 | 24m, $0.47 / $0.71 |
| H100 PCIe | 18m, $0.58 / $0.85 | 13m, $0.42 / $0.60 | 29m, $0.96 / $1.40 | 16m, $0.54 / $0.79 |

**9B** (overhead 15 min):

| GPU | 2k×3 | 2k×1 | 5k×3 | 5k×1 |
|---|---|---|---|---|
| A5000 (QLoRA only) | 148m, $0.39 / $0.66 | 59m, $0.16 / $0.27 | 347m, $0.92 / $1.56 | 126m, $0.33 / $0.57 |
| 4090 | 104m, $0.59 / $1.55 | 45m, $0.25 / $0.66 | 238m, $1.35 / $3.53 | 89m, $0.51 / $1.33 |
| 5090 | 85m, $0.98 / $1.70 | 38m, $0.44 / $0.76 | 191m, $2.20 / $3.79 | 74m, $0.85 / $1.46 |
| A6000 | 110m, $0.61 / $1.08 | 47m, $0.26 / $0.46 | 253m, $1.39 / $2.48 | 94m, $0.52 / $0.93 |
| A40 | 113m, $0.66 / $1.11 | 48m, $0.28 / $0.47 | 260m, $1.52 / $2.56 | 97m, $0.56 / $0.95 |
| L40S | 56m, $0.73 / $1.01 | 29m, $0.38 / $0.52 | 117m, $1.54 / $2.12 | 49m, $0.64 / $0.89 |
| A100 | 52m, $1.03 / $1.55 | 27m, $0.54 / $0.82 | 108m, $2.14 / $3.21 | 46m, $0.91 / $1.37 |
| H100 PCIe | 32m, $1.07 / $1.55 | 21m, $0.69 / $1.00 | 58m, $1.92 / $2.79 | 29m, $0.97 / $1.41 |

**14B** (overhead 20 min):

| GPU | 2k×3 | 2k×1 | 5k×3 | 5k×1 |
|---|---|---|---|---|
| A5000 (QLoRA only) | 226m, $0.60 / $1.02 | 89m, $0.24 / $0.40 | 536m, $1.43 / $2.41 | 192m, $0.51 / $0.86 |
| A6000 | 168m, $0.92 / $1.65 | 69m, $0.38 / $0.68 | 390m, $2.14 / $3.83 | 143m, $0.79 / $1.41 |
| L40S | 83m, $1.10 / $1.51 | 41m, $0.54 / $0.75 | 178m, $2.35 / $3.24 | 73m, $0.96 / $1.32 |
| A100 | 78m, $1.54 / $2.32 | 39m, $0.78 / $1.17 | 164m, $3.26 / $4.90 | 68m, $1.35 / $2.03 |
| H100 PCIe | 47m, $1.55 / $2.25 | 29m, $0.96 / $1.39 | 87m, $2.87 / $4.17 | 42m, $1.40 / $2.03 |

**Recommended auto-selection.** The first choice is cheapest per run. The fallback covers lack of stock or a customer paying for speed.

| Size | Method | Cheapest (Community) | Cheapest (Secure) | Fast tier | Notes |
|---|---|---|---|---|---|
| 1.5B | bf16 LoRA | A5000 | A5000 | L40S | All runs under ~$0.50. |
| 4B (Qwen3.5-4B, Qwen3-4B, Phi-4 mini, Gemma 4 E4B) | bf16 LoRA (Qwen3.5); QLoRA or bf16 for others | A5000 (24 GB) | A5000 or A6000 | L40S | Gemma E4B in bf16: prefer 48 GB if 24 GB OOMs. |
| 8 to 9B (Qwen3.5-9B, Granite 4.2 8B) | bf16 LoRA for Qwen3.5 (22 GB, so use 48 GB); QLoRA for Granite | A6000 or A40 (48 GB) | A6000 or A40 | L40S | A5000 or 4090 only with QLoRA. |
| 14B | QLoRA (bf16 needs about 33 GB) | A6000 (48 GB) | A6000 or A40 | L40S or A100 | A5000 is fine for QLoRA but slow (3.5 to 9 h for 3 epochs). |

**Planning per-run GPU cost** (Secure, 5,000 examples × 3 epochs, the worst of the four runs):

| Size | Cost |
|---|---|
| 1.5B | ~$0.45 |
| 4B | ~$0.70 to $1.15 |
| 9B | ~$1.50 to $2.50 |
| 14B | ~$2.40 to $3.80 |

Add a 1.5 to 2x safety margin for throughput uncertainty and for failed or retried runs. Plain HF (no Unsloth) roughly doubles the training portion.

**When 2 GPUs make sense:**
- Rarely at these sizes. Multi-GPU QLoRA via DDP gives each GPU a full model copy. Since the model fits on one card, the gain is only data-parallel speedup, about 1.7 to 1.9x for 2 GPUs. Cost per run stays the same or rises slightly (communication overhead plus the fixed overhead billed on 2 GPUs).
- Use 2 GPUs only for a wall-clock SLA, for example a 14B or 9B run with 5,000 examples × 3 epochs that would exceed about 2 to 3 hours on one A6000. Even then, a single L40S or A100 is usually a simpler way to get the same speedup.
- Unsloth's open-source multi-GPU support has historically been limited. Accelerate or DeepSpeed with plain PEFT is slower per GPU, which erases most of the benefit. This is an inference; I did not verify Unsloth's current multi-GPU status.
- Spot instances (if available, ~60% cheaper) suit long 14B runs that save checkpoints every N steps.

**Serverless alternative.** Using RunPod Serverless instead of Pods multiplies these costs by about 2 to 4x. For example, the 9B 5,000 × 3 run on serverless A6000/A40 is 253 min × $1.22/h ≈ $5.14, vs $1.39 to $2.48 on Pods.

### Gaps
- All throughput-derived minutes are modeled with about ±40% uncertainty. The right next step is a 20-to-50-step timing run per (model, GPU) on RunPod to replace the MFU assumptions with measured tokens/s.
- I did not verify current GPU availability or stock levels per data center. The A5000, A40 and A6000 Community supply can be thin, so the selector needs a fallback list.
- I found no data on Unsloth's current multi-GPU performance.
