---
name: solid-ui
description: Inline-edit pane for LOSOS that renders any urn:solid type as click-to-edit fields. Form definitions per type are auto-derived from solid-schema. Use to add inline editing to a LOSOS app or to author a hand-written form for a custom type.
---

# solid-ui

Inline-edit LOSOS pane — click a field to edit, blur to save. UI counterpart to solid-shapes:

```
LION → urn-solid → solid-schema → solid-shapes (RDF graph) + solid-ui (this — UI form) → solid-panes → solid-apps + LOSOS
```

Same source of truth (JSON Schema in solid-schema), two derived contracts: SHACL for RDF validators, UI form definitions for editors.

## When to use this skill

- The user wants click-to-edit fields in a LOSOS app instead of the schema-pane's traditional always-visible form.
- The user wants a beautiful read-mode that flips to edit on click — fediverse profile feel, not WordPress admin feel.
- The user is authoring a hand-written form for a custom type that doesn't fit the auto-derived defaults.

## Quick-start: drop-in pane

```html
<script type="module" data-pane src="https://solid-ui.github.io/ui-pane.js"></script>
```

The pane fetches the form definition for the data's `@type` from `solid-ui.github.io/<Name>/index.json` and renders inline-edit UI. No further config needed.

## Quick-start: hand-written form

```js
import { registerForm, render } from 'https://solid-ui.github.io/ui-pane.js'

registerForm('urn:solid:Person', {
  label: 'Person',
  targetClass: 'urn:solid:Person',
  view: {
    heading:    'urn:solid:name',
    subheading: 'urn:solid:nick',
    avatar:     { type: 'image', from: 'urn:solid:img' }
  },
  parts: [
    { type: 'ui:SingleLineTextField', label: 'Name',     property: 'urn:solid:name', required: true, maxLength: 200 },
    { type: 'ui:SingleLineTextField', label: 'Nickname', property: 'urn:solid:nick' },
    { type: 'ui:EmailField',          label: 'Email',    property: 'urn:solid:email' },
    { type: 'ui:NamedNodeURIField',   label: 'Homepage', property: 'urn:solid:homepage' }
  ]
})
```

## The inline-edit pattern

Not `contenteditable`. Each field renders as formatted display at rest (e.g. an email as a `mailto:` link, a date as `19 April 2026`). Click swaps to a real `<input>` focused and selected. Blur or Enter saves, Esc cancels. Autosaves on every widget change via `store.set(subject, property, value)`.

> *"UI disappears around the data."* — TimBL, DesignIssues/UserInterface

## Form definition shape

```js
{
  label: 'Bookmark',
  targetClass: 'urn:solid:Bookmark',
  view: {
    heading:    'urn:solid:title',
    subheading: 'urn:solid:url',
    avatar:     { type: 'favicon', from: 'urn:solid:url' }   // also: 'image' | true | false
  },
  parts: [
    { type: 'ui:SingleLineTextField', label, property, required?, maxLength?, minLength?, pattern?, description? },
    { type: 'ui:Choice',              label, property, options: [{ value, label }, ...] },
    ...
  ]
}
```

## Widget types

`ui:SingleLineTextField` · `ui:MultiLineTextField` · `ui:EmailField` · `ui:PhoneField` · `ui:NamedNodeURIField` · `ui:IntegerField` · `ui:DecimalField` · `ui:BooleanField` · `ui:DateField` · `ui:DateTimeField` · `ui:TimeField` · `ui:ColorField` · `ui:Choice`

See README for the full table of editor + view rendering per type.

## Pane API

```js
// Inline-edit (the main thing — click-to-edit per field)
renderEditable(container, form, store, subject)

// Always-visible labelled inputs (traditional form mode)
renderForm(container, form, store, subject)

// Pure read-only presentation
renderView(container, form, store, subject)

// LOSOS pane interface
canHandle(subject, store)
render(subject, store, container)
```

## Adding a derived form

Don't write derived forms by hand — they're regenerated. Steps:

1. Add the term to urn-solid (if missing).
2. Add the JSON Schema to solid-schema.
3. Run `npm run build` here. Form auto-derived.

For custom view shaping (different heading/subheading heuristics, custom avatar) the build's heuristics are intentionally simple. Hand-written `<Name>/extra.json` with `view` overrides could be merged in (not yet implemented).

## What auto-derives well, what needs hand-writing

**Auto-derives well:** straightforward types where each field is a primitive (Person, Note, Article, Bookmark). The widget mapping is mechanical.

**Needs hand-writing:** types with composed/nested structures (Event with attendees as nested objects, VerifiableCredential with proof blocks). The auto-derived form will treat each field as a single-line text input — usable but not idiomatic. A bespoke pane (or hand-extending the form spec) gives better UX.

## Don't

- Don't hand-edit `<Name>/index.json` — overwritten on next build. Use `<Name>/extra.json` for overrides (when supported) or write a bespoke pane.
- Don't reference upstream URIs in form `property` fields unless you really mean to bypass the urn:solid layer. Stay on `urn:solid:*` for stack consistency; the resolver canonicalises incoming data.
- Don't expect the auto-derived form to handle nested objects gracefully — they fall through to single-line text. Use a custom pane or hand-extend the form.

## Reference URLs

- Index: https://solid-ui.github.io/index.json
- Reverse index (urn:solid type → form URL): https://solid-ui.github.io/reverse-index.json
- Corpus: https://solid-ui.github.io/corpus.jsonl
- Pane: https://solid-ui.github.io/ui-pane.js
- Demos: https://solid-ui.github.io/

## Related skills

- `solid-schema` — upstream source. Edit there to update forms here.
- `solid-shapes` — the SHACL sibling (RDF graph contracts).
- `solid-panes` — pane registry; can point at solid-ui's pane for a type.
- `urn-solid` — vocabulary registry.
- `losos` — runtime. https://losos.org/SKILL.md
- `xlogin` — auth. https://github.com/melvincarvalho/xlogin/blob/gh-pages/SKILL.md
