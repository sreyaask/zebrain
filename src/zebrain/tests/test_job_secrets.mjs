// The training script goes to the user's Kaggle (readable by them) or a RunPod pod. It may carry only the user's
// own tokens and a short-lived Qwen run token: never Zebrain's Qwen, Razorpay, RunPod, Supabase or other AI keys.
// Run: node tests/test_job_secrets.mjs
import fs from "node:fs";
let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : `  -> ${detail}`)); if (!ok) fails++; };

const route = fs.readFileSync("app/api/runs/route.ts", "utf8");
const call = route.slice(route.indexOf("buildJobScript({"), route.indexOf("\n", route.indexOf("buildJobScript({")));
check("job script gets only the user's tokens and the run's own fields", !/process\.env/.test(call) && /hf_token: hfToken/.test(call), call);
check("no server environment value is put in a job", !/process\.env\.[A-Z_]*KEY/.test(call));
const plans = fs.readFileSync("lib/server/plans.ts", "utf8");
check("jobs reach Qwen with a run token, not the Qwen key", /token = "zbr_"/.test(plans) && !/QWEN_API_KEY/.test(plans));
check("only the run token's hash is stored", /createHash\("sha256"\)\.update\(token\)/.test(plans));
const pod = fs.readFileSync("lib/server/runpod.ts", "utf8");
const podEnv = pod.slice(pod.indexOf("env: {"), pod.indexOf("}", pod.indexOf("env: {")));
check("RunPod pod env carries the job only, not Zebrain's keys", !/process\.env/.test(podEnv), podEnv);
for (const f of fs.readdirSync("lib/server")) {
  const src = fs.readFileSync(`lib/server/${f}`, "utf8");
  check(`lib/server/${f} can't be bundled into a browser page`, src.startsWith('import "server-only";'));
}
const job = fs.readFileSync("lib/zebrain_train.py", "utf8");
check("job saves its config without tokens", /k not in \("hf_token", "api_key", "qwen"\)/.test(job));
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
