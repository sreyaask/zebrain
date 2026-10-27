// Looks for your real secret values anywhere they could leak. Prints file names and key names only, never values.
//   node scripts/check-secrets.mjs                 scans project files and the built browser code (.next/static)
//   node scripts/check-secrets.mjs http://localhost:3100   also downloads public pages and their scripts and scans those
// Exits 1 if any secret is found.
import fs from "node:fs";
import path from "node:path";

const envFile = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const secrets = envFile.split("\n").map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
  .filter(([k, v]) => !k.startsWith("NEXT_PUBLIC_") && v.length >= 8 && !/^(https?:|INR|USD|SECURE|COMMUNITY|qwen)/i.test(v));
// Key shapes that should never sit in source even if they aren't in .env.local.
const shapes = [["Razorpay live key", /rzp_live_[A-Za-z0-9]{10,}/], ["Hugging Face token", /\bhf_[A-Za-z0-9]{30,}/], ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["OpenAI-style key", /\bsk-[A-Za-z0-9]{32,}/], ["Supabase service JWT", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/]];

const hits = [];
function scanText(where, text) {
  for (const [k, v] of secrets) if (text.includes(v)) hits.push(`${where}: contains the value of ${k}`);
  for (const [name, re] of shapes) if (re.test(text) && !where.endsWith(".env.local")) hits.push(`${where}: looks like a ${name}`);
}
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".git", "cache", "server"].includes(e.name)) walk(p); }
    else if (fs.statSync(p).size < 5_000_000 && !/\.(png|jpe?g|pdf|woff2?|ico|gz)$/i.test(e.name)) scanText(p, fs.readFileSync(p, "utf8"));
  }
}
for (const d of ["app", "lib", "tests", "scripts", "docs", "reports", "research_notes", "public"]) walk(d);
for (const f of ["README.md", "middleware.ts", "next.config.mjs", "package.json"]) if (fs.existsSync(f)) scanText(f, fs.readFileSync(f, "utf8"));
for (const d of [".next/static", ".next-build/static"]) walk(d); // what browsers download

const base = process.argv[2];
if (base) {
  const seen = new Set();
  for (const page of ["/", "/pricing", "/login"]) {
    const html = await (await fetch(base + page)).text();
    scanText(`${base}${page}`, html);
    for (const src of html.match(/\/_next\/static\/[^"']+\.js/g) ?? []) {
      if (seen.has(src)) continue;
      seen.add(src);
      scanText(`${base}${src}`, await (await fetch(base + src)).text());
    }
  }
  console.log(`Downloaded ${seen.size} scripts from ${base}.`);
}

console.log(`Checked for ${secrets.length} secret value(s) from .env.local and ${shapes.length} key shapes.`);
if (hits.length) { console.log("LEAK FOUND:\n" + [...new Set(hits)].join("\n")); process.exit(1); }
console.log("No secrets found in project files or browser code.");
