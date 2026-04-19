#!/usr/bin/env node
// Auto-derive UI form definitions from solid-schema.
//
// For each JSON Schema at solid-schema.github.io, emit a form spec
// compatible with ui-pane.js's { targetClass, view, parts } shape,
// at <Name>/index.json. Plus index/reverse-index/corpus.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

const SOURCE_INDEX = process.env.SOLID_SCHEMA_INDEX || "https://solid-schema.github.io/index.json";
const SOURCE_BASE  = process.env.SOLID_SCHEMA_BASE  || "https://solid-schema.github.io/";

const writeIfChanged = (file, content) => {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
};

// Map JSON Schema property → ui-pane widget type
function widgetTypeFor(key, prop) {
  if (Array.isArray(prop.enum)) return "ui:Choice";
  if (prop.type === "boolean") return "ui:BooleanField";
  if (prop.type === "integer") return "ui:IntegerField";
  if (prop.type === "number")  return "ui:DecimalField";
  if (prop.type === "string") {
    if (prop.format === "email")     return "ui:EmailField";
    if (prop.format === "uri" || prop.format === "iri") return "ui:NamedNodeURIField";
    if (prop.format === "date-time") return "ui:DateTimeField";
    if (prop.format === "date")      return "ui:DateField";
    if (prop.format === "time")      return "ui:TimeField";
    if (prop.maxLength && prop.maxLength > 200) return "ui:MultiLineTextField";
    if (/phone|tel/i.test(key))      return "ui:PhoneField";
    return "ui:SingleLineTextField";
  }
  // Array / object / unknown — fall through to single-line text for now.
  return "ui:SingleLineTextField";
}

// Pick a sensible heading property from a schema.
//   name | title | label | summary > first required string > first string
function pickHeading(schema) {
  const preferred = ["name", "title", "label", "summary"];
  const props = schema.properties || {};
  for (const k of preferred) if (props[k]) return k;
  const required = new Set(schema.required || []);
  for (const [k, p] of Object.entries(props)) {
    if (k.startsWith("@") || k.startsWith("$")) continue;
    if (required.has(k) && p.type === "string") return k;
  }
  for (const [k, p] of Object.entries(props)) {
    if (k.startsWith("@") || k.startsWith("$")) continue;
    if (p.type === "string") return k;
  }
  return null;
}

// Pick a subheading — a different string prop that's not the heading.
//   nick | handle | email | published | first image/uri
function pickSubheading(schema, headingKey) {
  const props = schema.properties || {};
  const preferred = ["nick", "handle", "email", "attributedTo", "published", "url"];
  for (const k of preferred) if (props[k] && k !== headingKey) return k;
  for (const [k, p] of Object.entries(props)) {
    if (k === headingKey) continue;
    if (k.startsWith("@") || k.startsWith("$")) continue;
    if (p.type === "string" && p.format !== "uri") return k;
  }
  return null;
}

// Pick an avatar spec — prefer img/photo/avatar, else favicon-from-homepage, else initials.
function pickAvatar(schema) {
  const props = schema.properties || {};
  for (const k of ["img", "photo", "avatar", "icon", "logo", "picture"]) {
    if (props[k]) return { type: "image", from: k };
  }
  for (const k of ["homepage", "url", "href"]) {
    if (props[k] && (props[k].format === "uri" || props[k].type === "string")) {
      return { type: "favicon", from: k };
    }
  }
  return true;  // ui-pane.js falls back to initials when avatar: true
}

function schemaToForm(schema, name) {
  const required = new Set(schema.required || []);
  const props = schema.properties || {};
  const term = schema["x-urn-solid"]?.term || `urn:solid:${name}`;

  const parts = [];
  for (const [key, p] of Object.entries(props)) {
    if (key.startsWith("@") || key.startsWith("$")) continue;
    const part = {
      type: widgetTypeFor(key, p),
      label: p.title || key,
      property: key
    };
    if (required.has(key)) part.required = true;
    if (typeof p.maxLength === "number") part.maxLength = p.maxLength;
    if (typeof p.minLength === "number") part.minLength = p.minLength;
    if (typeof p.pattern === "string")   part.pattern = p.pattern;
    if (p.description) part.description = p.description;
    if (Array.isArray(p.enum)) part.options = p.enum.map(v => ({ value: v, label: v }));
    parts.push(part);
  }

  const headingKey = pickHeading(schema);
  const subheadingKey = pickSubheading(schema, headingKey);

  const form = {
    targetClass: term,
    label: schema.title || name,
    description: schema.description || "",
    view: {
      heading: headingKey,
      subheading: subheadingKey,
      avatar: pickAvatar(schema)
    },
    parts,
    "x-urn-solid": {
      term,
      termRegistry: schema["x-urn-solid"]?.termRegistry,
      schemaSource: `${SOURCE_BASE}${name}/index.json`,
      derivedFrom: "JSON Schema 2020-12",
      status: schema["x-urn-solid"]?.status || "experimental",
      added: schema["x-urn-solid"]?.added || new Date().toISOString().slice(0, 10)
    }
  };

  return form;
}

async function main() {
  console.log(`[build] fetching ${SOURCE_INDEX}`);
  const r = await fetch(SOURCE_INDEX);
  if (!r.ok) throw new Error(`fetch ${SOURCE_INDEX} returned ${r.status}`);
  const index = await r.json();

  const names = Object.keys(index).sort();
  const formIndex = {};
  const reverseIndex = {};
  const corpusLines = [];

  for (const name of names) {
    const schemaUrl = SOURCE_BASE + name + "/index.json";
    const sr = await fetch(schemaUrl);
    if (!sr.ok) { console.warn(`[build] skip ${name}: ${sr.status}`); continue; }
    const schema = await sr.json();
    const form = schemaToForm(schema, name);

    writeIfChanged(path.join(ROOT, name, "index.json"), JSON.stringify(form, null, 2) + "\n");

    const term = form["x-urn-solid"].term;
    formIndex[name] = {
      term,
      label: form.label,
      description: form.description,
      parts: form.parts.length,
      form: `/${name}/index.json`
    };
    if (term) reverseIndex[term] = `/${name}/index.json`;
    corpusLines.push(JSON.stringify(form));
  }

  writeIfChanged(path.join(ROOT, "index.json"), JSON.stringify(formIndex, null, 2) + "\n");
  writeIfChanged(path.join(ROOT, "reverse-index.json"), JSON.stringify(reverseIndex, null, 2) + "\n");
  writeIfChanged(path.join(ROOT, "corpus.jsonl"), corpusLines.join("\n") + "\n");

  console.log(`[build] ${names.length} form definitions derived from solid-schema`);
}

main().catch(e => { console.error(e); process.exit(1); });
