# The AI doesn't always reply in the JSON shape the prompt asks for: sometimes a bare list, a single object, or a list
# with stray strings. Every caller must cope instead of crashing the run with "'list' object has no attribute 'get'".
# Run: python tests/test_ai_reply_shapes.py   (no GPU, no network)
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


class Prog:
    def update(self, *a, **k):
        pass


zt.PROG = Prog()
zt.CFG = {"qwen": {"use_case": "qa"}, "description": "SQL"}
zt.time.sleep = lambda s: None
score = {"id": 0, "score": 1, "issue": ""}
shapes = {"object": {"scores": [score]}, "bare list": [score], "single item": score,
          "stray strings": ["oops", score, ["x"]], "null": None, "number": 3, "wrong key": {"other": [score]}}
for name, reply in shapes.items():
    zt.llm_json = lambda *a, r=reply, **k: r
    try:
        got = zt.llm_grade([(0, "q", "ref", "ans")])
        ok = got == ({0: (1.0, None)} if name in ("object", "bare list", "single item", "stray strings") else {})
        check(f"grading survives a {name} reply", ok, got)
    except Exception as e:
        check(f"grading survives a {name} reply", False, repr(e))

ex = {"question": "Count users", "answer": "SELECT COUNT(*) FROM users;"}
for name, reply in {"bare list": [ex, "junk"], "object": {"examples": [ex]}, "null": None}.items():
    zt.llm_json = lambda *a, r=reply, **k: r
    try:
        rows = zt.practice_rows({"topic": "counts"}, zt.CFG, avoid=[])
        topics = zt.weak_topics([{"question": "q", "expected": "e", "answer": "a"}], zt.CFG)
        tests = zt.write_exam(zt.CFG)
        check(f"practice/topics/exam survive a {name} reply", len(rows) == (0 if name == "null" else 1), rows)
    except Exception as e:
        check(f"practice/topics/exam survive a {name} reply", False, repr(e))

zt.llm_json = lambda *a, **k: ["How many users?", {"x": 1}, "Count the users", "User count?"]
try:
    out = zt.paraphrase("Count users", 4)
    check("paraphrase keeps only text variants from a bare list", out[0] == "Count users" and all(isinstance(v, str) for v in out), out)
except Exception as e:
    check("paraphrase survives a bare list", False, repr(e))

zt.llm_json = lambda *a, **k: [{"id": 1, "reason": "wrong"}]
try:
    rows = [[{"role": "user", "content": f"q{i}"}, {"role": "assistant", "content": f"a{i}"}] for i in range(3)]
    kept, dropped, _ = zt.llm_review(rows, zt.CFG, sample=3, batch=3)
    check("example review survives a bare list", dropped in (0, 1) and len(kept) + dropped == 3, (len(kept), dropped))
except Exception as e:
    check("example review survives a bare list", False, repr(e))

print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
