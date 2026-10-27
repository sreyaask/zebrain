import "server-only"; // build fails if a browser page ever imports this (keeps keys off the client)
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The training job is a plain Python file so it can be tested on its own; the config goes in as base64.
export function buildJobScript(config: object) {
  const template = readFileSync(join(process.cwd(), "lib", "zebrain_train.py"), "utf8");
  return template.replace("__ZEBRAIN_CONFIG__", Buffer.from(JSON.stringify(config)).toString("base64"));
}
