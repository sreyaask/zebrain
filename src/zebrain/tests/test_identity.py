# Identity training must be small and specific: 3 varied identity examples, a "Made with Zebrain" credit only on free
# runs, no slug or "its creator" as the name/maker, and the name in only a small share of the data.
# Run: python tests/test_identity.py   (no GPU, no network)
import importlib.util
import os
import sys

os.environ["ZEBRAIN_IMPORT_ONLY"] = "1"
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("zt", os.path.join(here, "..", "lib", "zebrain_train.py"))
zt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zt)
fails = 0


def check(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    fails += 0 if cond else 1


cfg = {"identity": {"name": "customer-support-4b", "maker": "its creator", "founder": ""}, "purpose": "Customer support",
       "plan": "basic", "_hf_user": "stepup", "description": "Answers questions about returns.",
       "system_prompt": "You are customer-support-4b. Answers questions about returns."}
zt.clean_identity(cfg)
check("a slug name becomes a real name", cfg["identity"]["name"] == "Customer Support", cfg["identity"])
check("'its creator' becomes the owner's account", cfg["identity"]["maker"] == "stepup", cfg["identity"])
check("the system prompt carries the cleaned identity", cfg["system_prompt"].startswith("You are Customer Support, an AI model built by stepup"), cfg["system_prompt"])
ids = zt.identity_rows(cfg)
check("exactly 3 identity examples", len(ids) == 3, len(ids))
check("each identity question is worded differently", len({r[0]["content"] for r in ids}) == 3)
check("free runs carry the Made with Zebrain credit", any("Zebrain" in r[-1]["content"] for r in zt.zebrain_rows(cfg)))
cfg["plan"] = "standard"
check("paid runs carry only the user's brand", zt.zebrain_rows(cfg) == [])
task = [[{"role": "user", "content": f"q{i}"}, {"role": "assistant", "content": f"a{i}"}] for i in range(1500)]
extra = zt.skill_rows(cfg, task)
named = sum(cfg["identity"]["name"] in r[-1]["content"] for r in extra)
check("the name appears in under 3% of a 1,500-example dataset", named / (1500 + len(extra)) < 0.03, named)
cfg2 = {"identity": {"name": "Vertex Coder", "maker": "Vertex Labs", "founder": ""}, "system_prompt": "You are Vertex Coder, an AI model built by Vertex Labs."}
zt.clean_identity(cfg2)
check("a real name and maker are left alone", cfg2["identity"]["name"] == "Vertex Coder" and cfg2["identity"]["maker"] == "Vertex Labs")
print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
