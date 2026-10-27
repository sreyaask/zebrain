// Saved tokens are encrypted at rest (AES-256-GCM): round trip, tamper detection, legacy plain values, no key.
// Run: node tests/test_secrets.mjs
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { pathToFileURL } from "node:url";
const src = fs.readFileSync("lib/server/secrets.ts", "utf8").replace(/^import "server-only".*$/m, "");
const out = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "zbsec-")), "secrets.mjs");
fs.writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
let fails = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : `  -> ${detail}`)); if (!ok) fails++; };
process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const s = await import(pathToFileURL(out));
const token = "hf_" + "x".repeat(34);
const sealed = s.seal(token);
check("a sealed token doesn't contain the token", sealed.startsWith("enc:v1:") && !sealed.includes(token));
check("sealing twice gives different ciphertext", s.seal(token) !== sealed);
check("it opens back to the token", s.unseal(sealed) === token);
let tampered = false;
try { s.unseal(sealed.slice(0, -4) + "AAAA"); } catch { tampered = true; }
check("a tampered value is rejected", tampered);
check("values saved before encryption still read", s.unseal("old-plain-key") === "old-plain-key");
process.env.TOKEN_ENCRYPTION_KEY = "";
process.env.NODE_ENV = "production";
let refused = false;
try { s.seal(token); } catch (e) { refused = e instanceof s.NoEncryptionKey; }
check("in production, saving without a key is refused instead of storing plain text", refused);
console.log(`\n${fails} failed`);
process.exit(fails ? 1 : 0);
