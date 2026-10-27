// Loads lib/*.ts modules in Node for tests: transpiles each to a temp folder and rewrites "./x" imports to "./x.mjs".
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const lib = path.join(path.dirname(fileURLToPath(import.meta.url)), "../lib");
const out = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "zbts-"));
export async function load(name) {
  for (const f of fs.readdirSync(lib).filter((f) => f.endsWith(".ts"))) {
    const js = ts.transpileModule(fs.readFileSync(path.join(lib, f), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
    fs.writeFileSync(path.join(out, f.replace(/\.ts$/, ".mjs")), js.replace(/from "\.\/([\w-]+)"/g, 'from "./$1.mjs"').replace(/from "@\/lib\/([\w-]+)"/g, 'from "./$1.mjs"'));
  }
  return import(pathToFileURL(path.join(out, `${name}.mjs`)));
}
