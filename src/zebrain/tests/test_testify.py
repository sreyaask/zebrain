# Checks the Testify helpers in lib/zebrain_train.py with simulated Zebrain AI replies.
# Run: python3 tests/test_testify.py
import importlib.util
import os
import sys

os.environ["ZEBRAIN_IMPORT_ONLY"] = "1"
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("zt", os.path.join(here, "..", "lib", "zebrain_train.py"))
zt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zt)
zt.CFG = {"purpose": "SQL assistant", "description": "Turn questions into PostgreSQL queries. Reply with only the query.",
          "identity": {"name": "sqlbot"}, "base_model": "Qwen/Qwen2.5-Coder-1.5B-Instruct", "qwen": {"use_case": "sql"}}
fails = 0


def check(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    fails += 0 if cond else 1


TEST_Q = "How many customers live in Delhi?\n\nContext:\nCREATE TABLE customers (id INT, city TEXT);"


def fake(prompt, temperature=0.1, tries=6):
    if "got these test questions wrong" in prompt:
        return {"topics": [{"topic": "GROUP BY with HAVING", "what_went_wrong": "forgets HAVING"}, {"topic": ""}]}
    if "NEW training examples" in prompt:
        return {"examples": [
            {"question": TEST_Q, "answer": "SELECT 1"},                          # the test question itself
            {"question": TEST_Q.replace("Delhi", "Delhi?"), "answer": "SELECT 1"},  # a near-copy of it
            {"question": "Which cities have more than 10 orders?\n\nContext:\nCREATE TABLE orders (id INT, city TEXT);",
             "answer": "SELECT city FROM orders GROUP BY city HAVING COUNT(*) > 10"},
            {"question": "", "answer": "SELECT 2"}]}
    if "Write a test set" in prompt:
        return {"tests": [{"question": "q1", "answer": "a1"}, {"question": "", "answer": "x"}]}
    return None


zt.llm_json = fake
topics = zt.weak_topics([{"question": "q", "expected": "e", "answer": "a", "issue": "x"}], zt.CFG)
check("weak topics parsed, empty ones dropped", [t["topic"] for t in topics] == ["GROUP BY with HAVING"], topics)
rows = zt.practice_rows(topics[0], zt.CFG, [zt.norm(TEST_Q)])
check("practice never copies or near-copies a test question", len(rows) == 1 and "HAVING" in rows[0][1]["content"], rows)
check("exam written, blank items dropped", zt.write_exam(zt.CFG) == [{"question": "q1", "answer": "a1"}])

zt.llm_json = lambda *a, **k: None
check("without the AI: no topics, no practice, no exam",
      zt.weak_topics([{"question": "q", "expected": "e", "answer": "a"}], zt.CFG) == []
      and zt.practice_rows({"topic": "t"}, zt.CFG, []) == [] and zt.write_exam(zt.CFG) == [])

print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
