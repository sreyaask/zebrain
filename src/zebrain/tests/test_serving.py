# Checks the chat's streaming reply (with automatic continuation) and the Gradio endpoints, using a fake model.
# Run with a Python that has gradio + gradio_client: python tests/test_serving.py
import importlib.util
import os
import queue
import sys
import textwrap
import threading
import time

os.environ["ZEBRAIN_IMPORT_ONLY"] = "1"
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, "..", "lib", "zebrain_train.py")
spec = importlib.util.spec_from_file_location("zt", path)
zt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zt)
import gradio as gr
from gradio_client import Client

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))
    fails += 0 if cond else 1


class Shape:
    def __init__(self, n): self.shape = (1, n)


class Enc(dict):
    def to(self, _): return self


class Tok:
    pad_token_id = 0
    def __call__(self, text, **_): return Enc(input_ids=Shape(len(text.split())))


class Streamer:
    def __init__(self, *a, **k): self.q = queue.Queue()
    def put(self, w): self.q.put(w)
    def end(self): self.q.put(None)
    def __iter__(self):
        while (w := self.q.get()) is not None:
            yield w


class Model:
    """Plays back scripted replies (one list of pieces per attempt), at most max_new_tokens per call, like
    generate() with a streamer. Honours the stop flag the way a StoppingCriteria would."""
    def __init__(self, *attempts):
        self.attempts, self.calls = [list(x) for x in attempts], []

    def generate(self, input_ids, streamer, max_new_tokens, stopping_criteria, **kw):
        self.calls.append(kw)
        pieces = self.attempts[0]
        n = 0
        while pieces and n < max_new_tokens and not stopping_criteria[0].is_set():
            streamer.put(pieces.pop(0))
            n += 1
            time.sleep(0.001)
        if not pieces or stopping_criteria[0].is_set():
            self.attempts.pop(0)  # this attempt is over; the next call is a new attempt
        streamer.end()
        return Shape(input_ids.shape[1] + n)


# Pull the real stream() and answer() out of serve() and run them against the fakes.
src = open(path).read()
body = src[src.index("    def stream("):src.index("    def chat(message, history):")]
env = {"render": lambda tok, msgs, add_generation_prompt=False: "prompt ", "Thread": threading.Thread, "threading": threading,
       "TextIteratorStreamer": Streamer, "StoppingCriteriaList": list, "Halt": lambda flag: flag, "MAX_NEW": zt.MAX_NEW,
       "RUNAWAY": zt.RUNAWAY, "answer_problem": zt.answer_problem, "gr": gr, "tok": Tok(),
       "GEN": {"repetition_penalty": 1.05}}
exec(textwrap.dedent(body), env)


def run(question, *attempts, max_new=None):
    env["model"] = model = Model(*attempts)
    msgs = [{"role": "user", "content": question}]
    if max_new:
        gen, out = env["stream"](msgs, max_new=max_new), []
        try:
            while True:
                out.append(next(gen))
        except StopIteration as stop:
            return out, model, stop.value
    return list(env["answer"](msgs)), model, None


F = chr(96) * 3
parts, m, ret = run("hi", ["w "] * 5, max_new=10)
check("short reply streams piece by piece and stops on its own", len(parts) == 5 and ret == ("w " * 5, None) and len(m.calls) == 1, (parts, ret))
parts, m, ret = run("hi", ["w "] * 25, max_new=10)
check("reply that hits the cap carries on until it's finished", ret == ("w " * 25, None) and len(m.calls) == 3, ret)
parts, m, ret = run("hi", ["w "] * 100, max_new=10)
check("endless reply is reported as too long", ret[1] == "the answer ran far too long", ret[1])
check("generation uses the repetition penalty", m.calls[0].get("repetition_penalty") == 1.05)

good = [F + "jsx\n", "export default function A() {\n", "  return <div />;\n", "}\n", F]
parts, m, _ = run("Write a component", good)
check("a good answer is sent as is", parts[-1] == "".join(good) and len(m.calls) == 1, parts[-1])

runaway = [F + "jsx\n", "const bg = 'data:image/svg+xml;base64,"] + ["QUFB" * 20] * 200
parts, m, _ = run("Write a component", runaway, good)
check("a runaway data URL is stopped early and the answer rewritten",
      "Writing it again" in "".join(parts) and parts[-1] == "".join(good) and len(m.attempts) == 0
      and max(len(p) for p in parts) < 2500, (len(m.attempts), parts[-1][:80]))

cut = [F + "jsx\n", "export default function A() {\n", "  return (\n", "    <div>\n"]
parts, m, _ = run("Write a component", cut, cut)
check("code that stops midway is rewritten, then flagged if still broken",
      "Writing it again" in "".join(parts) and parts[-1].endswith("may not work: the code block was never closed.)"), parts[-1][-90:])

long_code = [F + "js\n"] + [f"line{i}();\n" for i in range(30)] + [F]
parts, m, _ = run("Start over. Keep it under 20 lines, one component.", long_code, good)
check("code over the asked line limit is rewritten", parts[-1] == "".join(good) and "30 lines" in "".join(parts), parts[-1][:60])

check("checker: unclosed bracket", zt.answer_problem("", F + "js\nf({\n" + F) == "the code stops before every bracket is closed")
check("checker: plain text answer is fine", zt.answer_problem("Under 5 lines please", "Hello there (friend).") is None)
check("checker: line limit only when asked", zt.answer_problem("Write it", "".join(long_code)) is None)
check("quality rules are added to the system prompt",
      zt.full_system({"system_prompt": "You are bot."}).startswith("You are bot.\n\nFollow every") and zt.full_system({}) is None)


# The real Gradio app with streaming endpoints.
def fake_stream(text):
    out = ""
    for w in text.split():
        out += w + " "
        yield out.strip()


def ask(message, api_key, history="[]"):
    if api_key != "k":
        raise gr.Error("Wrong or missing api_key.")
    yield from fake_stream("echo " + message)


def predict(message):
    yield from fake_stream("echo " + message)


def chat(message, history):
    yield [], ""


app = zt.chat_app(gr, "t", "d", chat, ask, lambda h, a: "", predict)
_, url, _ = app.queue().launch(prevent_thread_lock=True, quiet=True)
c = Client(url, verbose=False)
check("/predict returns the finished reply", c.predict(message="a b c", api_name="/predict") == "echo a b c")
pieces = list(c.submit(message="a b c", api_key="k", history="[]", api_name="/ask"))
check("/ask streams growing pieces", pieces[-1] == "echo a b c" and len(pieces) >= 2, pieces)
try:
    c.predict(message="x", api_key="bad", history="[]", api_name="/ask")
    check("/ask refuses a wrong key", False)
except Exception as e:
    check("/ask refuses a wrong key", "api_key" in str(e), e)
app.close()
print(f"\n{fails} failed")
sys.exit(1 if fails else 0)
