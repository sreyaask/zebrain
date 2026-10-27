// The AI provider switch: same messages in, same {text, prompt, completion} out, for Qwen and Gemini; malformed
// JSON is retried; account problems are reported as such. Fake fetch, no network. Run: node tests/test_provider.mjs
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "zbprov-"));
const src = fs.readFileSync("lib/ai/provider.ts", "utf8").replace(/^import "server-only".*$/m, "");
fs.writeFileSync(path.join(dir, "p.mjs"), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const p = await import(pathToFileURL(path.join(dir, "p.mjs")));
let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : `  -> ${detail}`)); if (!ok) fails++; };
const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
const msgs = [{ role: "system", content: "SYS RULES" }, { role: "user", content: "Write JSON" }];

// Qwen
process.env.AI_PROVIDER = "qwen"; process.env.QWEN_API_KEY = "k";
let sent;
globalThis.fetch = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return json(200, { choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 10, completion_tokens: 4 } }); };
let used = { prompt: 0, completion: 0 };
let r = await p.callAI(msgs, { maxTokens: 50, json: true }, used);
check("qwen: OpenAI-style request with the same messages", /chat\/completions$/.test(sent.url) && sent.body.messages[0].content === "SYS RULES" && sent.body.response_format.type === "json_object");
check("qwen: text and token counts come back", r.text === '{"a":1}' && used.prompt === 10 && used.completion === 4);

// Gemini
process.env.AI_PROVIDER = "gemini"; process.env.GEMINI_API_KEY = "g"; process.env.GEMINI_MODEL = "gemini-test-flash";
const calls = [];
let replies = ['not json at all', '{"ok":true}'];
globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return json(200, { candidates: [{ content: { parts: [{ text: replies.shift() }] } }], usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 } }); };
used = { prompt: 0, completion: 0 };
r = await p.callAI(msgs, { maxTokens: 50, json: true }, used);
check("gemini: system prompt sent word for word as systemInstruction", calls[0].body.systemInstruction.parts[0].text === "SYS RULES");
check("gemini: user turn sent, system not duplicated", calls[0].body.contents.length === 1 && calls[0].body.contents[0].parts[0].text === "Write JSON");
check("gemini: JSON mode on", calls[0].body.generationConfig.responseMimeType === "application/json");
check("gemini: malformed JSON is retried and the good reply returned", calls.length === 2 && r.text === '{"ok":true}', JSON.stringify(r));
check("gemini: token counts include the retry", used.prompt === 14 && used.completion === 6, JSON.stringify(used));
calls.length = 0; replies = ['plain text'];
await p.callAI(msgs, { maxTokens: 50, json: true, search: true }, { prompt: 0, completion: 0 }).catch(() => {});
check("gemini: search uses grounding without JSON mode", calls[0].body.tools?.[0]?.google_search && !calls[0].body.generationConfig.responseMimeType);
globalThis.fetch = async () => json(403, { error: { message: "API key not valid" } });
let account = false;
try { await p.callAI(msgs, { maxTokens: 5 }, { prompt: 0, completion: 0 }); } catch (e) { account = e instanceof p.ProviderAccountError; }
check("gemini: a bad key is an account problem (marks Zebrain AI out of service)", account);
check("the switch defaults to Qwen", (delete process.env.AI_PROVIDER, p.provider() === "qwen"));
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
