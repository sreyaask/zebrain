# "Start again from the last checkpoint" must not redo the whole run: the second attempt reuses the first attempt's
# prepared examples (no re-download, no second AI review, same order so the training checkpoint lines up).
# Run: python tests/test_restart.py   (no GPU, no network)
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
    msgs = []

    def update(self, *a, **k):
        self.msgs.append(" ".join(str(x) for x in a) + " " + str(k.get("message", "")))


repo = {}
zt.read_json = lambda api, r, path: repo.get(path)
zt.write_json = lambda api, r, path, data: repo.__setitem__(path, data)
gathered = []


def gather_data(n):
    gathered.append(n)
    rows = [[{"role": "user", "content": f"Tell me fact number {i} about the Roman empire please"},
             {"role": "assistant", "content": f"Here is fact number {i}: the Roman empire built many long roads across Europe."}] for i in range(400)]
    return rows, rows[:50], [{"dataset": "fake", "rows": 400}]


zt.gather_data = gather_data
got = []
zt.train_and_publish = lambda api, user, sr, run_id, train, test_rows, task_rows, pool, tests: got.append((train, test_rows)) or {}
zt.CFG = {"run_id": "r1", "max_rows_per_dataset": 400, "datasets": ["fake/data"], "base_model": "Qwen/Qwen3.5-9B", "description": "A friendly helper for questions about history",
          "purpose": "chat", "identity": {"name": "zebby"}, "system_prompt": "You are zebby."}

zt.PROG = Prog()
zt.run_train(None, "me", "me/m-zebrain")
check("first attempt prepares the data and saves it for this run", gathered == [400] and "data-r1.json" in repo, list(repo))
zt.PROG = Prog()
zt.run_train(None, "me", "me/m-zebrain")
check("restart skips downloading and reviewing again", gathered == [400], gathered)
check("restart trains on exactly the same examples in the same order", got[0] == got[1])
check("restart says it reused the data", any("reusing" in m for m in zt.PROG.msgs), zt.PROG.msgs)
zt.CFG["run_id"] = "r2"
zt.run_train(None, "me", "me/m-zebrain")
check("a new run prepares its own data", gathered == [400, 400], gathered)

src = open(os.path.join(here, "..", "lib", "zebrain_train.py")).read()
check("big models checkpoint every 25 steps (~15 min on a T4)", "save_steps=25 if big else 100" in src)
check("an out-of-memory retry continues from the newest checkpoint", 'glob.glob(f"{out_dir}/checkpoint-*")' in src)
check("\"Publish what it has\" stops after the current round", 'or CFG.get("publish_now"):' in src)

# A later attempt that started over and overwrote the checkpoint must not lose the earlier, further-along one.
class Commit:
    def __init__(self, title, cid):
        self.title, self.commit_id = title, cid


class Api:
    def list_repo_commits(self, repo, token=None):  # newest first, like Hugging Face
        return [Commit("round1 checkpoint 100", "new100"), Commit("update progress.json", "p"),
                Commit("round1 checkpoint 301", "old301"), Commit("round1 checkpoint 200", "old200"),
                Commit("round2 checkpoint 50", "r2"), Commit("round1 checkpoint 100", "old100")]


zt.CFG = {"hf_token": None}
order = zt.furthest_checkpoints(Api(), "me/m-zebrain", "round1")
check("restart picks the furthest checkpoint ever saved, not the latest upload",
      order[:3] == [(301, "old301"), (200, "old200"), (100, "new100")], order)
check("other rounds' checkpoints are ignored", all(r != "r2" for _, r in order), order)

import json as _json
import huggingface_hub
tried = []


def fake_download(repo, allow_patterns, local_dir, revision, token):
    tried.append(revision)
    d = f"{local_dir}/checkpoints/round1"
    os.makedirs(d, exist_ok=True)
    run = "other-run" if revision == "old301" else "r1"  # the 301 one belongs to a different run: skip it
    _json.dump({"run_id": run, "step": 0}, open(f"{d}/zebrain_run.json", "w"))
    open(f"{d}/trainer_state.json", "w").write("{}")


class Reached(Exception):
    pass


def stop_here(tok, rows, maxlen):
    raise Reached()


huggingface_hub.snapshot_download = fake_download
zt.TMP = __import__("tempfile").mkdtemp()
zt.PROG = Prog()
zt.free_gpu = lambda: None
zt.model_params = lambda m: 9e9
zt.train_max_len = lambda m: 1536
zt.encode_dataset = stop_here
try:
    zt.train_round(None, [0] * 300000, [], "round1", 1, 2e-4, Api(), "me/m-zebrain", "r1")
except Reached:
    pass
check("a checkpoint from another run is skipped and the next furthest of this run is used",
      tried[:2] == ["old301", "old200"] and any("from step" in m for m in zt.PROG.msgs), (tried, zt.PROG.msgs[-2:]))

# A checkpoint the user picked on the runs page is used first, even if an earlier run of this model saved it.
tried.clear()
zt.CFG = {"hf_token": None, "resume_from": {"round": "round1", "step": 301, "rev": "old301"}}
zt.PROG = Prog()
try:
    zt.train_round(None, [0] * 300000, [], "round1", 1, 2e-4, Api(), "me/m-zebrain", "r1")
except Reached:
    pass
check("the checkpoint picked on the runs page is used first", tried[:1] == ["old301"] and len(tried) == 1, tried)

print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
