// shacl-pane.js — Minimal SHACL Form Pane for LOSOS (~280 LOC)
// Parses SHACL shapes → HTML forms, binds to LOSOS store or standalone

import N3 from 'https://esm.sh/n3'

// --- Namespaces ---
const SH  = 'http://www.w3.org/ns/shacl#'
const XSD = 'http://www.w3.org/2001/XMLSchema#'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#'
const nn = N3.DataFactory.namedNode

// --- SHACL Shape Parser ---

export function parseShapes(turtle, baseIRI = '') {
  const store = new N3.Store(new N3.Parser({ baseIRI }).parse(turtle))
  const shapes = []

  for (const q of store.getQuads(null, nn(RDF + 'type'), nn(SH + 'NodeShape'))) {
    const sid = q.subject
    const props = []

    for (const pq of store.getQuads(sid, nn(SH + 'property'), null)) {
      const p = pq.object
      const prop = {
        path:        val(store, p, SH + 'path'),
        name:        val(store, p, SH + 'name'),
        description: val(store, p, SH + 'description'),
        datatype:    val(store, p, SH + 'datatype'),
        minCount:   +(val(store, p, SH + 'minCount') ?? 0),
        maxCount:   +(val(store, p, SH + 'maxCount')) || Infinity,
        order:      +(val(store, p, SH + 'order') ?? 0),
        pattern:     val(store, p, SH + 'pattern'),
        inValues:    rdfList(store, store.getObjects(p, nn(SH + 'in'))[0]),
        nodeKind:    val(store, p, SH + 'nodeKind'),
      }
      if (!prop.name && prop.path) prop.name = localName(prop.path)
      props.push(prop)
    }
    props.sort((a, b) => a.order - b.order)

    shapes.push({
      id:          sid.value,
      targetClass: val(store, sid, SH + 'targetClass'),
      label:       val(store, sid, RDFS + 'label') || val(store, sid, SH + 'name') || localName(sid.value),
      properties:  props,
    })
  }
  return shapes
}

function val(store, s, p) { return store.getObjects(s, nn(p))[0]?.value }

function localName(iri) { return iri.split(/[#/]/).pop() }

function rdfList(store, node) {
  if (!node) return null
  const items = []
  let cur = node
  while (cur && cur.value !== RDF + 'nil') {
    const f = store.getObjects(cur, nn(RDF + 'first'))[0]
    if (f) items.push(f.value)
    cur = store.getObjects(cur, nn(RDF + 'rest'))[0]
  }
  return items.length ? items : null
}

// --- XSD → HTML input type ---

const INPUT_TYPES = {
  [XSD + 'string']:   'text',
  [XSD + 'integer']:  'number',  [XSD + 'int']:     'number',
  [XSD + 'decimal']:  'number',  [XSD + 'float']:   'number',
  [XSD + 'double']:   'number',  [XSD + 'boolean']: 'checkbox',
  [XSD + 'date']:     'date',    [XSD + 'dateTime']:'datetime-local',
  [XSD + 'time']:     'time',    [XSD + 'anyURI']:  'url',
}

// --- Form Renderer ---

export function renderForm(container, shape, values = {}, { onSubmit, onChange } = {}) {
  injectStyles()
  const form = document.createElement('form')
  form.className = 'shacl-form'
  form.innerHTML = `<h2>${esc(shape.label)}</h2>`

  const fields = {}

  for (const prop of shape.properties) {
    const required = prop.minCount > 0
    const name = esc(prop.name)
    const v = values[prop.path] ?? ''
    const desc = prop.description ? `<small>${esc(prop.description)}</small>` : ''
    const star = required ? ' <span class="req">*</span>' : ''
    const div = document.createElement('div')
    div.className = 'shacl-field'

    if (prop.inValues) {
      div.innerHTML = `<label>${name}${star}${desc}
        <select name="${esc(prop.path)}" ${required ? 'required' : ''}>
          <option value="">—</option>
          ${prop.inValues.map(o =>
            `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc(localName(o))}</option>`
          ).join('')}
        </select></label>`
    } else if (INPUT_TYPES[prop.datatype] === 'checkbox') {
      div.innerHTML = `<label class="checkbox">
        <input type="checkbox" name="${esc(prop.path)}"${v === 'true' || v === true ? ' checked' : ''}>
        ${name}${desc}</label>`
    } else {
      const type = INPUT_TYPES[prop.datatype] || 'text'
      div.innerHTML = `<label>${name}${star}${desc}
        <input type="${type}" name="${esc(prop.path)}" value="${esc(String(v))}"
          ${required ? 'required' : ''}
          ${prop.pattern ? `pattern="${esc(prop.pattern)}"` : ''}
          ${prop.maxLength < Infinity ? `maxlength="${prop.maxLength}"` : ''}>
        </label>`
    }

    const input = div.querySelector('input, select')
    if (input && onChange) {
      input.addEventListener('input', () => {
        onChange(prop.path, input.type === 'checkbox' ? input.checked : input.value)
      })
    }
    fields[prop.path] = input
    form.appendChild(div)
  }

  if (onSubmit) {
    const btn = document.createElement('button')
    btn.type = 'submit'
    btn.textContent = 'Save'
    form.appendChild(btn)
    form.addEventListener('submit', e => {
      e.preventDefault()
      const data = {}
      for (const [path, el] of Object.entries(fields)) {
        data[path] = el.type === 'checkbox' ? el.checked : el.value
      }
      onSubmit(data)
    })
  }

  container.innerHTML = ''
  container.appendChild(form)
  return { form, fields }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// --- Turtle Serializer ---

export function toTurtle(subject, shape, values, prefixes = {}) {
  const lines = []
  for (const [p, iri] of Object.entries(prefixes)) lines.push(`@prefix ${p}: <${iri}> .`)
  if (lines.length) lines.push('')

  const triples = []
  if (shape.targetClass) triples.push(`  a <${shape.targetClass}>`)

  for (const prop of shape.properties) {
    const v = values[prop.path]
    if (v === undefined || v === '' || v === null) continue
    const isIRI = prop.nodeKind === SH + 'IRI' || prop.datatype === XSD + 'anyURI'
    const isNum  = [XSD + 'integer', XSD + 'decimal', XSD + 'float', XSD + 'double'].includes(prop.datatype)
    const isBool = prop.datatype === XSD + 'boolean'
    const obj = isIRI ? `<${v}>` : (isNum || isBool) ? String(v) : `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    triples.push(`  <${prop.path}> ${obj}`)
  }

  lines.push(`<${subject}>`)
  lines.push(triples.join(' ;\n') + ' .')
  return lines.join('\n')
}

// --- LOSOS Pane Interface ---

const _shapes = new Map()

export function registerShape(targetClass, turtle) { _shapes.set(targetClass, turtle) }

export function canHandle(subject, store) { return _shapes.has(store.type(subject)) }

export async function render(subject, store, container) {
  const turtle = _shapes.get(store.type(subject))
  const shapes = parseShapes(turtle)
  if (!shapes[0]) return

  const shape = shapes[0]
  const values = {}
  for (const prop of shape.properties) {
    values[prop.path] = store.prop(subject, localName(prop.path)) ?? ''
  }

  renderForm(container, shape, values, {
    onChange(path, value) { store.set(subject, localName(path), value) },
  })
}

// --- Styles ---

function injectStyles() {
  if (document.getElementById('shacl-pane-css')) return
  const el = document.createElement('style')
  el.id = 'shacl-pane-css'
  el.textContent = `
.shacl-form { max-width: 480px; font-family: system-ui, sans-serif; }
.shacl-form h2 { margin: 0 0 1rem; font-size: 1.25rem; border-bottom: 1px solid #ddd; padding-bottom: .5rem; }
.shacl-field { margin-bottom: .75rem; }
.shacl-field label { display: block; font-weight: 500; font-size: .9rem; }
.shacl-field small { display: block; color: #666; font-weight: normal; margin: 2px 0 4px; font-size: .8rem; }
.shacl-field input, .shacl-field select {
  display: block; width: 100%; padding: .4rem .5rem; margin-top: .25rem;
  border: 1px solid #ccc; border-radius: 4px; font-size: .9rem; box-sizing: border-box; }
.shacl-field input:focus, .shacl-field select:focus { outline: none; border-color: #06c; box-shadow: 0 0 0 2px #06c3; }
.shacl-field input:invalid { border-color: #e44; }
.shacl-field .checkbox { display: flex; align-items: center; gap: .5rem; cursor: pointer; }
.shacl-field .checkbox input { width: auto; margin: 0; }
.shacl-form .req { color: #e44; }
.shacl-form button[type=submit] {
  margin-top: 1rem; padding: .5rem 1.5rem; background: #06c; color: #fff;
  border: none; border-radius: 4px; font-size: .9rem; cursor: pointer; }
.shacl-form button[type=submit]:hover { background: #05a; }
.shacl-output { margin-top: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 4px;
  font-family: monospace; font-size: .85rem; white-space: pre-wrap; overflow-x: auto; }
`
  document.head.appendChild(el)
}
