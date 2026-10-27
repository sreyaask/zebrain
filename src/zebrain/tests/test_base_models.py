# Checks every base model in lib/models.ts against the job's own code on CPU, with transformers 5: identity and
# quality rules built into the chat template, answer-only training labels, LoRA on the text layers, a few real
# Trainer steps with the job's settings, then save → reload → merge → save → reload → generate.
# Uses each model's real tokenizer and config, but a 2-layer random-weight copy, so nothing large is downloaded.
# Run: python tests/test_base_models.py   (needs transformers 5, peft, torch, datasets)
import importlib.util
import os
import re
import shutil
import sys
import tempfile

os.environ["ZEBRAIN_IMPORT_ONLY"] = "1"
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("zt", os.path.join(here, "..", "lib", "zebrain_train.py"))
zt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zt)

import torch
from peft import LoraConfig, PeftModel, get_peft_model
from transformers import (AutoConfig, AutoModelForCausalLM, AutoTokenizer, DataCollatorForSeq2Seq, Trainer,
                          TrainingArguments)

models_ts = open(os.path.join(here, "..", "lib", "models.ts")).read()
BASE = re.findall(r'^\s+id: "([\w.-]+/[\w.-]+)"', models_ts.split("export const TEMPLATES")[0], re.M)
fails = 0


def check(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    fails += 0 if cond else 1


class Prog:  # the job's progress writer, minus Hugging Face
    def update(self, *a, **k):
        pass


zt.PROG = Prog()


def tiny(cfg):
    for c in [cfg, getattr(cfg, "text_config", None)]:
        if c is None:
            continue
        n = 2
        if getattr(c, "layer_types", None):
            kinds = list(dict.fromkeys(c.layer_types))
            c.layer_types = kinds
            n = len(kinds)
        c.num_hidden_layers = n
        if hasattr(c, "num_kv_shared_layers"):
            c.num_kv_shared_layers = 0
    return cfg


BASE = [m for m in BASE if m in sys.argv[1:]] or BASE
print("base models in lib/models.ts:", BASE)
for m in BASE:
    print("=" * 16, m)
    zt.CFG = {"base_model": m, "hf_token": None, "max_len": 1536, "identity": {"name": "zebby"},
              "system_prompt": "You are zebby, an AI model built by Acme. You write SQL."}
    work = tempfile.mkdtemp()
    try:
        tok = zt.load_tokenizer()
        sys_text = zt.full_system(zt.CFG)
        prompt = zt.render(tok, [{"role": "user", "content": "Who are you?"}], add_generation_prompt=True)
        check(f"{m}: identity + quality rules built in without a system message",
              "You are zebby" in prompt and "Follow every instruction" in prompt, prompt[:300])
        check(f"{m}: thinking switched off", "<think>\n" not in prompt.split("Who are you?")[-1].replace("<think>\n\n</think>", ""),
              prompt[-120:])
        rows = [[{"role": "user", "content": f"Count users in table t{i}."},
                 {"role": "assistant", "content": f"SELECT COUNT(*) FROM t{i};"}] for i in range(8)]
        ds = zt.encode_dataset(tok, rows)
        lab = [t for t in ds[0]["labels"] if t != -100]
        answer = tok.decode(lab, skip_special_tokens=True).strip()
        check(f"{m}: only the answer is trained", answer.startswith("SELECT COUNT(*) FROM t0;"), answer)

        model = AutoModelForCausalLM.from_config(tiny(AutoConfig.from_pretrained(m)), dtype=torch.float32)
        model = get_peft_model(model, LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, task_type="CAUSAL_LM",
                                                 target_modules=zt.LORA_TARGETS))
        lora = [n for n, _ in model.named_modules() if n.endswith("lora_A")]
        check(f"{m}: LoRA only on text layers", lora and not any(re.search("vision|audio|visual", n) for n in lora), lora[:3])
        args = TrainingArguments(output_dir=f"{work}/out", per_device_train_batch_size=2, gradient_accumulation_steps=2,
                                 max_steps=2, learning_rate=2e-4, lr_scheduler_type="cosine", warmup_steps=0.03,
                                 logging_steps=1, save_steps=100, report_to="none", seed=7, use_cpu=True)
        trainer = Trainer(model=model, args=args, train_dataset=ds,
                          data_collator=DataCollatorForSeq2Seq(tok, padding=True, label_pad_token_id=-100))
        out = trainer.train()
        check(f"{m}: Trainer steps run with the job's settings", out.global_step == 2, out)
        model.save_pretrained(f"{work}/adapter")
        cfg = tiny(AutoConfig.from_pretrained(m))
        base = AutoModelForCausalLM.from_config(cfg, dtype=torch.float32)
        merged = PeftModel.from_pretrained(base, f"{work}/adapter").merge_and_unload()
        merged.save_pretrained(f"{work}/merged")
        tok.save_pretrained(f"{work}/merged")
        # Same in-memory config: a shrunk Gemma 4 config can't round-trip its per-layer settings (the real one can).
        again = AutoModelForCausalLM.from_pretrained(f"{work}/merged", config=cfg, dtype=torch.float32)
        tok2 = AutoTokenizer.from_pretrained(f"{work}/merged")
        ids = tok2(zt.render(tok2, [{"role": "user", "content": "hi"}], True), return_tensors="pt", add_special_tokens=False)
        g = again.generate(**ids, max_new_tokens=3, do_sample=False, repetition_penalty=1.05, pad_token_id=tok2.pad_token_id)
        check(f"{m}: merged model reloads and generates, identity kept in its template",
              g.shape[1] > ids["input_ids"].shape[1] and "You are zebby" in zt.render(tok2, [{"role": "user", "content": "hi"}], True))
    except Exception as e:
        import traceback
        traceback.print_exc(limit=4)
        check(f"{m}: no errors", False, e)
    finally:
        shutil.rmtree(work, ignore_errors=True)

print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
