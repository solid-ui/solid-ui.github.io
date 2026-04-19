#!/usr/bin/env node
// Sanity-check every derived <Name>/index.json.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

const RESERVED = new Set([
  "scripts", "node_modules", ".github", ".git", ".claude",
  "assets", "vendor", "spec", "demos"
]);

const isFormDir = (name) => {
  if (RESERVED.has(name)) return false;
  if (name.startsWith(".")) return false;
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) return false;
  return fs.existsSync(path.join(ROOT, name, "index.json"));
};

const names = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(isFormDir)
  .sort();

let ok = 0, failed = 0;
for (const name of names) {
  let form;
  try { form = JSON.parse(fs.readFileSync(path.join(ROOT, name, "index.json"), "utf8")); }
  catch (e) { console.error(`[validate] ${name}: malformed JSON — ${e.message}`); failed++; continue; }

  if (!form.targetClass || !form.targetClass.startsWith("urn:solid:")) {
    console.error(`[validate] ${name}: targetClass must be urn:solid:*`);
    failed++; continue;
  }
  if (!Array.isArray(form.parts)) {
    console.error(`[validate] ${name}: parts must be an array`);
    failed++; continue;
  }
  for (const p of form.parts) {
    if (!p.type || !p.type.startsWith("ui:")) {
      console.error(`[validate] ${name}: part missing ui:* type — ${JSON.stringify(p)}`);
      failed++;
    }
    if (!p.property || !p.property.startsWith("urn:solid:")) {
      console.error(`[validate] ${name}: part missing urn:solid:* property — ${JSON.stringify(p)}`);
      failed++;
    }
  }
  if (!failed || failed === 0) ok++;
}
console.log(`[validate] ${ok} ok, ${failed} failed`);
if (failed > 0) process.exit(1);
