# solid-ui

Inline-edit pane for [LOSOS](https://losos.org/) — click a field to edit, blur to save. Form definitions per `urn:solid:` type, **auto-derived from [solid-schema](https://solid-schema.github.io/)**.

```
LION → urn-solid → solid-schema → solid-shapes (RDF) + solid-ui (UI) → solid-panes → solid-apps + LOSOS
```

UI is a sibling of SHACL: both are derived contracts on top of the JSON Schema. SHACL describes the graph; UI describes the form.

## Two ways to use

**1. Drop-in pane** — load `ui-pane.js` in any LOSOS app. It looks up the form definition for the data's `@type` from solid-ui.github.io and renders inline-edit UI.

```html
<script type="module" data-pane src="https://solid-ui.github.io/ui-pane.js"></script>
```

**2. Hand-written form for a custom type** — pass a form spec object directly:

```js
import { renderEditable, registerForm } from 'https://solid-ui.github.io/ui-pane.js'

registerForm('schema:Person', {
  label: 'Person',
  targetClass: 'schema:Person',
  view: { heading: 'name', subheading: 'email', avatar: true },
  parts: [
    { type: 'ui:SingleLineTextField', label: 'Name', property: 'name', required: true },
    { type: 'ui:EmailField', label: 'Email', property: 'email' }
  ]
})
```

## The inline-edit pattern

Not `contenteditable`. Each field renders as **formatted display at rest**; clicking swaps to a real `<input>` / `<select>` / `<textarea>` focused and selected; blur or Enter saves, Esc cancels. No mode toggle, no Edit button. Autosaves on every widget change.

> *"UI disappears around the data."* — [TimBL, DesignIssues/UserInterface](https://www.w3.org/DesignIssues/UI.html)

## Repo layout

```
ui-pane.js          The inline-edit renderer (~545 lines, zero deps, plain DOM)
shacl-pane.js       Alternate: explicit-submit SHACL form (~230 lines, n3 dep)
demos/              Hand-written reference apps (profile, bookmark, shacl-form)
assets/             Solid emblem
<Name>/index.json   Auto-derived form definition per urn:solid type
scripts/build.js    Fetches solid-schema, derives forms
scripts/validate.js Sanity-checks derived forms
index.json          Generated catalog
reverse-index.json  Generated: urn:solid type → form URL
corpus.jsonl        Generated: every form, one per line
index.html          Hub listing demos + derived forms
```

## Widget types (UI Ontology)

| `ui:` type | Renders as | Editor |
|---|---|---|
| `SingleLineTextField` | `<input type="text">` | text, maxLength |
| `MultiLineTextField` | `<textarea>` | preserves newlines |
| `EmailField` | `<input type="email">` | mailto: link in view mode |
| `PhoneField` | `<input type="tel">` | tel: link |
| `NamedNodeURIField` | `<input type="url">` | external link |
| `IntegerField` / `DecimalField` | `<input type="number">` | coerces to number |
| `BooleanField` | `<input type="checkbox">` | "Yes"/"No" in view |
| `DateField` / `DateTimeField` / `TimeField` | native pickers | locale-formatted |
| `ColorField` | `<input type="color">` | swatch |
| `Choice` | `<select>` | matched option label in view |

## Auto-derivation rules (JSON Schema → UI form)

| JSON Schema | UI widget |
|---|---|
| `type: string` | `ui:SingleLineTextField` |
| `+ format: email` | `ui:EmailField` |
| `+ format: uri` | `ui:NamedNodeURIField` |
| `+ format: date-time` | `ui:DateTimeField` |
| `+ format: date` | `ui:DateField` |
| `+ maxLength > 200` | `ui:MultiLineTextField` |
| `type: integer` | `ui:IntegerField` |
| `type: number` | `ui:DecimalField` |
| `type: boolean` | `ui:BooleanField` |
| `enum` | `ui:Choice` (with options) |
| `required: ["x"]` | `required: true` on x's part |

The `view` block (heading / subheading / avatar) is picked heuristically:
- **heading**: `name` / `title` / `label` / `summary` if present, else first required string, else first string
- **subheading**: `nick` / `handle` / `email` / `attributedTo` / `published` / `url` if present, else first other string
- **avatar**: `img` / `photo` / `avatar` if present (image), else `homepage` / `url` (favicon), else initials from heading

## Build

```bash
npm run build      # fetches solid-schema, derives forms, emits per-type JSON
npm run validate   # sanity-check derived forms
```

Override the source via env: `SOLID_SCHEMA_INDEX=<url> SOLID_SCHEMA_BASE=<url> npm run build`.

## License

Code: [AGPL-3.0](LICENSE). Form data: [CC BY 4.0](LICENSE-DATA).
