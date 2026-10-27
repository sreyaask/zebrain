// The wizard's dataset check must read rows exactly like the training job: chat lists, known column pairs, and
// guessed names such as sql_prompt / sql / sql_context. Run: node tests/test_datasetcheck.mjs
import { load } from "./load_ts.mjs";
const d = await load("datasetcheck");
let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : `  -> ${detail}`)); if (!ok) fails++; };
const sql = d.toMessages({ sql_prompt: "Count users", sql: "SELECT COUNT(*) FROM users;", sql_context: "CREATE TABLE users(id int);", sql_explanation: "x", domain: "web" });
check("sql_prompt / sql / sql_context are detected", sql && sql[0].content.includes("Context:\nCREATE TABLE") && sql[1].content === "SELECT COUNT(*) FROM users;", JSON.stringify(sql));
check("chat 'messages' lists are read", d.toMessages({ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] })?.length === 2);
check("ShareGPT 'from/value' is read", d.toMessages({ conversations: [{ from: "human", value: "q" }, { from: "gpt", value: "a" }] })?.[1].role === "assistant");
check("instruction + input + output", d.toMessages({ instruction: "Translate", input: "hola", output: "hello" })?.[0].content === "Translate\n\nhola");
const bad = d.checkRows("x/y", [{ image: "a.png", label: "cat" }, { image: "b.png", label: "dog" }]);
check("a dataset with no usable columns is flagged with its columns", bad.ok === false && /image, label/.test(bad.problem), bad.problem);
check("an empty dataset is flagged", d.checkRows("x/y", []).ok === false);
check("usable rows are counted", d.checkRows("x/y", [{ question: "q", answer: "a" }, { foo: "bar" }]).usable === 1);
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
