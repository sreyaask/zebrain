// Checks every external service Zebrain uses, without printing secrets.
//   node scripts/check-integrations.mjs           dry run: which keys are set, nothing is called
//   node scripts/check-integrations.mjs --live    one tiny authenticated call per service (Qwen: one 5-token reply,
//                                                 well under $0.0001; Razorpay/RunPod/Supabase: read-only lookups)
// Each result is PASS, FAIL (with what to fix) or BLOCKED (keys missing). Nothing is bought, created or deleted.
import fs from "node:fs";

const env = { ...Object.fromEntries((fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "").split("\n")
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])), ...process.env };
const live = process.argv.includes("--live");
const results = [];
const has = (...k) => k.every((x) => env[x]);
async function test(name, keys, fn) {
  if (!has(...keys)) return results.push([name, "BLOCKED", `set ${keys.filter((k) => !env[k]).join(", ")} in .env.local`]);
  if (!live) return results.push([name, "READY", "keys set; run with --live to call it"]);
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push([name, "PASS", `${detail} (${Date.now() - t0} ms)`]);
  } catch (e) {
    results.push([name, "FAIL", String(e.message || e).slice(0, 200)]);
  }
}
const json = async (res) => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(j).slice(0, 160)}`); return j; };

await test("Supabase (service key)", ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], async () => {
  const j = await json(await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/credit_packages?select=id`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }));
  return `${j.length} credit packs readable`;
});
await test("Qwen (Model Studio)", ["QWEN_API_KEY"], async () => {
  const base = env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  const j = await json(await fetch(`${base}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${env.QWEN_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.QWEN_MODEL || "qwen3.7-flash", messages: [{ role: "user", content: "Reply with the word ok." }], max_tokens: 5, enable_thinking: false }),
  }));
  if (!j.usage?.prompt_tokens) throw new Error("no usage reported");
  return `${j.model} answered "${String(j.choices?.[0]?.message?.content).trim()}", provider counted ${j.usage.prompt_tokens} in / ${j.usage.completion_tokens} out`;
});
await test("Razorpay", ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], async () => {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const j = await json(await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: `Basic ${auth}` } }));
  return `authenticated (${env.RAZORPAY_KEY_ID.startsWith("rzp_test_") ? "test mode" : "LIVE mode: switch to test keys for testing"}), ${j.count ?? 0} recent order(s) visible`;
});
await test("Razorpay webhook secret", ["RAZORPAY_WEBHOOK_SECRET"], async () => "set (verified when Razorpay sends an event)");
await test("RunPod", ["RUNPOD_API_KEY"], async () => {
  const j = await json(await fetch("https://rest.runpod.io/v1/pods", { headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}` } }));
  return `authenticated, ${Array.isArray(j) ? j.length : 0} pod(s) running`;
});
await test("Public URL for job callbacks", ["PUBLIC_URL"], async () => {
  if (/localhost|127\.0\.0\.1/.test(env.PUBLIC_URL)) throw new Error("PUBLIC_URL is local; Kaggle and RunPod jobs can't reach it");
  await fetch(`${env.PUBLIC_URL}/api/qwen`, { method: "POST" }).then((r) => { if (r.status !== 401) throw new Error(`gateway answered ${r.status}, expected 401 without a token`); });
  return "Qwen gateway reachable";
});
await test("Admin emails", ["ADMIN_EMAILS"], async () => `${env.ADMIN_EMAILS.split(",").length} admin(s)`);

const w = Math.max(...results.map((r) => r[0].length));
for (const [n, s, d] of results) console.log(`${s.padEnd(8)} ${n.padEnd(w)}  ${d}`);
console.log(live ? "\nLive mode: each service was called once." : "\nDry run: nothing was called.");
process.exit(results.some((r) => r[1] === "FAIL") ? 1 : 0);
