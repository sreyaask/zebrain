# Guards against the T4 out-of-memory crash seen with Qwen3.5 9B ("Tried to allocate 3.79 GiB"): preparing a
# 4-bit model for training must not upcast the embeddings/output layer to fp32, every base model's fixed memory
# must fit the T4 with room for training, and the tester must recover from out-of-memory instead of crashing.
# Run: python tests/test_memory.py   (needs transformers 5, peft, torch; CPU only, no big downloads)
import importlib.util
import json
import os
import re
import sys
import urllib.request

os.environ["ZEBRAIN_IMPORT_ONLY"] = "1"
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("zt", os.path.join(here, "..", "lib", "zebrain_train.py"))
zt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zt)

import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoConfig, AutoModelForCausalLM

T4 = 14.56 * 2**30  # usable bytes on Kaggle's T4, from the crash message
fails = 0


def check(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    fails += 0 if cond else 1


class Prog:
    def update(self, *a, **k):
        self.last = k.get("message")


zt.PROG = Prog()
zt.CFG = {"max_len": 1536}

# 1. prepare_kbit keeps big tensors in half precision and only upcasts small ones.
cfg = AutoConfig.from_pretrained("Qwen/Qwen3.5-9B")
tc = cfg.text_config
tc.layer_types = list(dict.fromkeys(tc.layer_types))
tc.num_hidden_layers = len(tc.layer_types)
model = AutoModelForCausalLM.from_config(cfg, dtype=torch.bfloat16)
model = zt.prepare_kbit(model)
emb, head = model.get_input_embeddings().weight, model.get_output_embeddings().weight
check("embeddings stay half precision (no 3.8 GiB fp32 copy)", emb.dtype == torch.bfloat16, emb.dtype)
check("output layer stays half precision (no 3.8 GiB fp32 copy)", head.dtype == torch.bfloat16, head.dtype)
small = [p for n, p in model.named_parameters() if "norm" in n]
check("norms upcast to fp32 for stable training", small and all(p.dtype == torch.float32 for p in small))
check("gradient checkpointing on", model.is_gradient_checkpointing)

# 2. Training still works after prepare_kbit (autocast stands in for the GPU's fp16 mixed precision).
pm = get_peft_model(model, LoraConfig(r=8, lora_alpha=16, target_modules=zt.LORA_TARGETS, task_type="CAUSAL_LM"))
pm.train()
ids = torch.randint(0, 1000, (1, 32))
with torch.autocast("cpu", dtype=torch.bfloat16):
    loss = pm(input_ids=ids, labels=ids).loss
loss.backward()
grads = [p.grad for n, p in pm.named_parameters() if p.requires_grad]
check("LoRA weights get gradients through the half-precision layers", grads and all(g is not None for g in grads))
del pm, model

# 3. Fixed memory of every base model on the T4 (4-bit layers + half-precision embeddings/output layer).
models_ts = open(os.path.join(here, "..", "lib", "models.ts")).read()
found = re.findall(r'id: "([\w.-]+/[\w.-]+)",[^}]*?size: "([\d.]+)B"', models_ts.split("export const TEMPLATES")[0], re.S)
for m in [mid for mid, size in found if float(size) <= 9]:  # bigger ones train only on Zebrain's GPUs (Pro Extreme)
    info = json.load(urllib.request.urlopen(f"https://huggingface.co/api/models/{m}"))
    total = (info.get("safetensors") or {}).get("total") or 0
    c = AutoConfig.from_pretrained(m)
    t = getattr(c, "text_config", None) or c
    vh = t.vocab_size * t.hidden_size
    tied = getattr(t, "tie_word_embeddings", False) or getattr(c, "tie_word_embeddings", False)
    big = vh * (1 if tied else 2)
    rest = max(total - big, 0)
    before = rest * 0.5 + big * 4  # old: peft upcast to fp32
    after = rest * 0.5 + big * 2
    room = T4 - after
    print(f"     {m}: fixed {after / 2**30:.1f} GiB (was {before / 2**30:.1f}), {room / 2**30:.1f} GiB left for training")
    check(f"{m} leaves ≥ 4 GiB of the T4 for activations", room >= 4 * 2**30, f"{room / 2**30:.1f} GiB")

# 4. The tester shrinks batches on out-of-memory and never crashes.
class Enc(dict):
    def to(self, _):
        return self


class Tok:
    pad_token_id, padding_side = 0, "right"

    def __len__(self):
        return 248320

    def __call__(self, texts, **kw):
        if isinstance(texts, str):
            return {"input_ids": [0] * len(texts.split())}
        n = max(len(t.split()) for t in texts)
        return Enc(input_ids=torch.zeros((len(texts), n), dtype=torch.long))

    def decode(self, row, **kw):
        return "answer"


class FakeModel:
    config = type("C", (), {"use_cache": False})()
    calls = []

    def parameters(self):
        return iter([torch.zeros(10)])

    def eval(self):
        pass

    def generate(self, input_ids, max_new_tokens, **kw):
        self.calls.append(input_ids.shape[0])
        if input_ids.shape[0] > 2 or input_ids.shape[1] > 900:
            raise torch.cuda.OutOfMemoryError("CUDA out of memory. Tried to allocate 3.79 GiB")
        return torch.zeros((input_ids.shape[0], input_ids.shape[1] + 3), dtype=torch.long)


zt.render = lambda tok, c, add_generation_prompt=False: " ".join(["w"] * c[0]["content"])
fm = FakeModel()
outs = zt.generate(fm, Tok(), [[{"content": 50}]] * 7 + [[{"content": 1000}]], max_new=10)
check("out-of-memory batches are halved and retried until they fit",
      outs[:7] == ["answer"] * 7 and fm.calls[0] > fm.calls[1] > fm.calls[2], (fm.calls, outs))
check("a question too big even alone is skipped, not a crash", outs[7] == "" and "too long" in (zt.PROG.last or ""), outs[7])

# 5. Two T4s for big models only, chosen before CUDA starts.
check("9B with two T4s uses both", zt.gpu_plan(9.65e9, 2) == ("0,1", 2))
check("8B with two T4s uses both", zt.gpu_plan(8.2e9, 2) == ("0,1", 2))
check("9B with one T4 stays on it (fixes above keep it fitting)", zt.gpu_plan(9.65e9, 1) == ("0", 1))
check("4B stays on one T4 even when two exist (faster, no copying)", zt.gpu_plan(4.2e9, 2) == ("0", 1))
check("unknown size stays on one T4", zt.gpu_plan(0, 2) == ("0", 1))
zt.CFG = {"base_model": "Qwen/Qwen3.5-9B", "hf_token": None}
zt.count_gpus = lambda: 2
os.environ["CUDA_VISIBLE_DEVICES"] = "0"
zt.use_gpus()
check("startup opens both GPUs for Qwen3.5 9B (real size from Hugging Face)",
      os.environ["CUDA_VISIBLE_DEVICES"] == "0,1" and zt.device_map() == "balanced" and "both T4" in (zt.PROG.last or ""),
      (os.environ["CUDA_VISIBLE_DEVICES"], zt.CFG))
zt.CFG = {"base_model": "Qwen/Qwen3.5-4B", "hf_token": None}
zt.use_gpus()
check("startup keeps Qwen3.5 4B on one GPU", os.environ["CUDA_VISIBLE_DEVICES"] == "0" and zt.device_map() == {"": 0})

# 6. The real split: big models in fp16 (chat after training) laid out over two 14.5 GiB T4s.
from accelerate import infer_auto_device_map, init_empty_weights
from accelerate.utils import get_balanced_memory
for m in ["Qwen/Qwen3.5-9B", "ibm-granite/granite-4.2-8b"]:
    with init_empty_weights():
        meta = AutoModelForCausalLM.from_config(AutoConfig.from_pretrained(m), dtype=torch.float16)
    caps = {0: int(T4) - 2 * 2**30, 1: int(T4) - 2 * 2**30}  # 2 GiB per GPU kept for the conversation's cache
    bal = get_balanced_memory(meta, max_memory=caps, no_split_module_classes=meta._no_split_modules, dtype=torch.float16)
    dmap = infer_auto_device_map(meta, max_memory=bal, no_split_module_classes=meta._no_split_modules, dtype=torch.float16)
    used = {}
    for name, dev in dmap.items():
        mod = meta.get_submodule(name) if name else meta
        used[dev] = used.get(dev, 0) + sum(p.numel() * 2 for p in mod.parameters())
    print(f"     {m} fp16 split: " + ", ".join(f"GPU {d}: {b / 2**30:.1f} GiB" for d, b in sorted(used.items(), key=str)))
    check(f"{m} fp16 fits across two T4s, both used, nothing on CPU",
          set(used) == {0, 1} and all(b < caps[d] for d, b in used.items()), used)
    del meta

print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
