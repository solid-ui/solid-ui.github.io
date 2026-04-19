// ui-pane.js — Minimal UI Ontology Form Pane for LOSOS
// Renders forms defined in the http://www.w3.org/ns/ui# vocabulary
// Zero dependencies. Works with LOSOS store or plain JS objects.

const UI = 'http://www.w3.org/ns/ui#'

// --- Widget renderers ---

const WIDGETS = {
  'ui:SingleLineTextField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'text'
    i.value = v ?? ''
    if (f.size) i.size = f.size
    if (f.maxLength) i.maxLength = f.maxLength
    if (f.placeholder) i.placeholder = f.placeholder
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:MultiLineTextField': (f, v, set) => {
    const t = document.createElement('textarea')
    t.value = v ?? ''
    t.rows = f.rows ?? 4
    t.addEventListener('input', () => set(t.value))
    return t
  },
  'ui:EmailField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'email'
    i.value = v ?? ''
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:PhoneField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'tel'
    i.value = v ?? ''
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:NamedNodeURIField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'url'
    i.value = v ?? ''
    i.placeholder = 'https://…'
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:IntegerField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'number'
    i.step = '1'
    i.value = v ?? ''
    i.addEventListener('input', () => set(i.value === '' ? null : parseInt(i.value, 10)))
    return i
  },
  'ui:DecimalField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'number'
    i.step = 'any'
    i.value = v ?? ''
    i.addEventListener('input', () => set(i.value === '' ? null : parseFloat(i.value)))
    return i
  },
  'ui:BooleanField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'checkbox'
    i.checked = v === true || v === 'true'
    i.addEventListener('change', () => set(i.checked))
    return i
  },
  'ui:DateField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'date'
    i.value = v ?? ''
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:DateTimeField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'datetime-local'
    i.value = v ?? ''
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:ColorField': (f, v, set) => {
    const i = document.createElement('input')
    i.type = 'color'
    i.value = v || '#000000'
    i.addEventListener('input', () => set(i.value))
    return i
  },
  'ui:Choice': (f, v, set) => {
    const s = document.createElement('select')
    const blank = document.createElement('option')
    blank.value = ''
    blank.textContent = '—'
    s.appendChild(blank)
    for (const opt of f.options || []) {
      const o = document.createElement('option')
      o.value = opt.value ?? opt
      o.textContent = opt.label ?? opt
      if (o.value === String(v ?? '')) o.selected = true
      s.appendChild(o)
    }
    s.addEventListener('change', () => set(s.value))
    return s
  },
}

// --- Static/structural widgets (no data binding) ---

const STATIC = {
  'ui:Comment': (f) => {
    const p = document.createElement('p')
    p.className = 'ui-comment'
    p.textContent = f.contents || ''
    return p
  },
  'ui:Heading': (f) => {
    const h = document.createElement('h3')
    h.className = 'ui-heading'
    h.textContent = f.contents || f.label || ''
    return h
  },
}

// --- Field rendering ---

function renderField(field, getValue, onChange) {
  const wrap = document.createElement('div')
  wrap.className = 'ui-field'

  if (STATIC[field.type]) {
    wrap.appendChild(STATIC[field.type](field))
    return wrap
  }

  if (field.type === 'ui:Group') {
    const fs = document.createElement('fieldset')
    if (field.label) {
      const lg = document.createElement('legend')
      lg.textContent = field.label
      fs.appendChild(lg)
    }
    for (const part of field.parts || []) {
      fs.appendChild(renderField(part, getValue, onChange))
    }
    wrap.appendChild(fs)
    return wrap
  }

  const widget = WIDGETS[field.type]
  if (!widget) {
    wrap.innerHTML = `<em class="ui-unknown">Unknown widget: ${field.type}</em>`
    return wrap
  }

  const isInline = field.type === 'ui:BooleanField'
  if (isInline) wrap.classList.add('ui-field-inline')

  const label = document.createElement('label')
  let span
  if (field.label) {
    span = document.createElement('span')
    span.textContent = field.label
    if (field.required) {
      const star = document.createElement('span')
      star.className = 'req'
      star.textContent = ' *'
      span.appendChild(star)
    }
  }

  const value = field.property ? getValue(field.property) : undefined
  const widgetEl = widget(field, value, (v) => {
    if (field.property) onChange(field.property, v)
  })

  if (isInline) {
    label.appendChild(widgetEl)
    if (span) label.appendChild(span)
  } else {
    if (span) label.appendChild(span)
    label.appendChild(widgetEl)
  }

  if (field.comment) {
    const s = document.createElement('small')
    s.textContent = field.comment
    label.appendChild(s)
  }

  wrap.appendChild(label)
  return wrap
}

// --- Form rendering ---

export function renderForm(container, form, store, subject) {
  injectStyles()
  const root = document.createElement('div')
  root.className = 'ui-form'

  if (form.label) {
    const h = document.createElement('h2')
    h.textContent = form.label
    root.appendChild(h)
  }

  // Adapt store: support both LOSOS stores and plain objects
  const isStore = store && typeof store.prop === 'function'
  const getValue = isStore
    ? (p) => store.prop(subject, p)
    : (p) => store?.[p] ?? ''
  const onChange = isStore
    ? (p, v) => store.set(subject, p, v)
    : (p, v) => { if (store) store[p] = v }

  for (const part of form.parts || []) {
    root.appendChild(renderField(part, getValue, onChange))
  }

  container.innerHTML = ''
  container.appendChild(root)
  return root
}

// --- View rendering (read-only presentation) ---

const FORMATTERS = {
  'ui:EmailField': (v) => link(`mailto:${v}`, v),
  'ui:PhoneField': (v) => link(`tel:${String(v).replace(/[^+\d]/g, '')}`, v),
  'ui:NamedNodeURIField': (v) => link(v, v, true),
  'ui:DateField': (v) => {
    try {
      const d = new Date(v)
      if (isNaN(d)) return text(v)
      return text(d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))
    } catch { return text(v) }
  },
  'ui:BooleanField': (v) => text(v === true || v === 'true' ? 'Yes' : 'No'),
  'ui:MultiLineTextField': (v) => {
    const p = document.createElement('p')
    p.style.whiteSpace = 'pre-wrap'
    p.style.margin = '0'
    p.textContent = v
    return p
  },
  'ui:Choice': (v, field) => {
    const opt = (field.options || []).find(o => (o.value ?? o) === v)
    return text(opt?.label ?? v)
  },
}

function text(s) { const el = document.createElement('span'); el.textContent = String(s); return el }
function link(href, label, external) {
  const a = document.createElement('a')
  a.href = href
  a.textContent = label
  if (external) { a.target = '_blank'; a.rel = 'noopener' }
  return a
}

function niceLabel(s) {
  if (!s) return ''
  return String(s).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

// Render one item of an array property as a chip. Strings → plain text or link
// (when URL); objects → name/title/label or a nice form of @id, linked when an
// @id/url/homepage is present.
function renderChip(item, field) {
  const chip = document.createElement('span')
  chip.className = 'ui-chip'
  if (typeof item === 'string') {
    if (/^https?:\/\//.test(item) || field?.type === 'ui:NamedNodeURIField') {
      chip.appendChild(link(item, niceLabel(item), true))
    } else {
      chip.textContent = item
    }
  } else if (item && typeof item === 'object') {
    const label = item.name || item.title || item.label || niceLabel(item['@id']) || JSON.stringify(item)
    const href = item['@id'] || item.url || item.homepage
    if (href) chip.appendChild(link(href, label, true))
    else chip.textContent = label
  } else {
    chip.textContent = String(item)
  }
  return chip
}

// Display dispatcher: arrays become a row of chips; scalars go through
// FORMATTERS (or plain text) as before.
function renderValue(v, field) {
  if (Array.isArray(v)) {
    const wrap = document.createElement('span')
    wrap.className = 'ui-chips'
    for (const item of v) wrap.appendChild(renderChip(item, field))
    return wrap
  }
  const fmt = FORMATTERS[field.type]
  return fmt ? fmt(v, field) : text(v)
}

function initials(name) {
  return String(name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function renderView(container, form, store, subject) {
  injectStyles()
  const isStore = store && typeof store.prop === 'function'
  const get = isStore ? (p) => store.prop(subject, p) : (p) => store?.[p] ?? ''

  const view = form.view || {}
  const headingProp = view.heading || form.parts.find(p =>
    p.property && /name$|title$|label$|headline$/i.test(p.property))?.property
  const subheadingProp = view.subheading
  const heading = headingProp ? get(headingProp) : null
  const subheading = subheadingProp ? get(subheadingProp) : null

  const root = document.createElement('div')
  root.className = 'ui-view'

  if (view.avatar && heading) {
    const av = document.createElement('div')
    av.className = 'ui-view-avatar'
    av.textContent = initials(heading)
    root.appendChild(av)
  }

  const body = document.createElement('div')
  body.className = 'ui-view-body'

  const h = document.createElement('h2')
  h.textContent = heading || form.label || 'Untitled'
  body.appendChild(h)

  if (subheading) {
    const sub = document.createElement('div')
    sub.className = 'ui-view-sub'
    const subField = form.parts.find(p => p.property === subheadingProp)
    const formatter = subField && FORMATTERS[subField.type]
    sub.appendChild(formatter ? formatter(subheading, subField) : text(subheading))
    body.appendChild(sub)
  }

  const dl = document.createElement('dl')
  for (const field of form.parts || []) {
    if (!field.property) continue
    if (field.property === headingProp || field.property === subheadingProp) continue
    const v = get(field.property)
    if (v === '' || v == null || v === false) continue
    const dt = document.createElement('dt')
    dt.textContent = field.label || ''
    const dd = document.createElement('dd')
    dd.appendChild(renderValue(v, field))
    dl.appendChild(dt)
    dl.appendChild(dd)
  }
  body.appendChild(dl)
  root.appendChild(body)

  container.innerHTML = ''
  container.appendChild(root)
  return root
}

// --- Inline editing (TimBL-style: no modes, no save button) ---

function editableField(field, getValue, onChange) {
  const wrap = document.createElement('span')
  wrap.className = 'ui-editable'
  wrap.tabIndex = 0

  let editing = false

  const showView = () => {
    editing = false
    wrap.classList.remove('editing')
    wrap.innerHTML = ''
    const v = getValue(field.property)
    if (v === '' || v == null || v === false) {
      const empty = document.createElement('span')
      empty.className = 'ui-empty'
      empty.textContent = field.placeholder || '—'
      wrap.appendChild(empty)
    } else {
      const el = renderValue(v, field)
      if (el.tagName === 'A') el.addEventListener('click', (e) => e.preventDefault())
      wrap.appendChild(el)
    }
  }

  const showEdit = () => {
    if (editing) return
    editing = true
    wrap.classList.add('editing')
    wrap.innerHTML = ''
    const v = getValue(field.property)
    const widget = WIDGETS[field.type]
    if (!widget) { showView(); return }
    const input = widget(field, v, (newV) => onChange(field.property, newV))
    wrap.appendChild(input)
    input.focus()
    if (input.select && input.type !== 'date' && input.type !== 'color') input.select()
    const done = () => showView()
    input.addEventListener('blur', done)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done() }
      if (e.key === 'Enter' && field.type !== 'ui:MultiLineTextField') {
        e.preventDefault(); input.blur()
      }
    })
  }

  // Arrays don't have a sensible single-input editor — display only for now.
  const isArrayValued = () => Array.isArray(getValue(field.property))
  wrap.addEventListener('click', (e) => { if (!editing && !isArrayValued()) showEdit() })
  wrap.addEventListener('focus', () => { if (!editing && !isArrayValued()) showEdit() })

  showView()
  return wrap
}

export function renderEditable(container, form, store, subject) {
  injectStyles()
  const isStore = store && typeof store.prop === 'function'
  const get = isStore ? (p) => store.prop(subject, p) : (p) => store?.[p] ?? ''
  const set = isStore ? (p, v) => store.set(subject, p, v) : (p, v) => { if (store) store[p] = v }

  const view = form.view || {}
  const headingProp = view.heading || form.parts.find(p =>
    p.property && /name$|title$|label$|headline$/i.test(p.property))?.property
  const subheadingProp = view.subheading
  const headingField = form.parts.find(p => p.property === headingProp)
  const subheadingField = form.parts.find(p => p.property === subheadingProp)

  const root = document.createElement('div')
  root.className = 'ui-view ui-view-editable'

  if (view.avatar) {
    const av = document.createElement('div')
    av.className = 'ui-view-avatar'
    const avatarSpec = typeof view.avatar === 'object' ? view.avatar : { type: 'initials' }
    const paintAvatar = () => {
      av.innerHTML = ''
      av.classList.remove('favicon')
      if (avatarSpec.type === 'favicon' && avatarSpec.from) {
        const url = get(avatarSpec.from)
        try {
          const host = new URL(url).hostname
          const img = document.createElement('img')
          img.src = `https://www.google.com/s2/favicons?domain=${host}&sz=128`
          img.alt = host
          img.onerror = () => { av.textContent = initials(host || get(headingProp) || form.label) }
          av.appendChild(img)
          av.classList.add('favicon')
          return
        } catch { /* fall through to initials */ }
      }
      av.textContent = initials(get(headingProp) || form.label)
    }
    paintAvatar()
    root.appendChild(av)
    root._paintInitials = paintAvatar
  }

  const body = document.createElement('div')
  body.className = 'ui-view-body'

  if (headingField) {
    const h = document.createElement('h2')
    h.className = 'ui-heading-inline'
    const edit = editableField(headingField, get, (p, v) => {
      set(p, v)
      if (root._paintInitials) root._paintInitials()
    })
    h.appendChild(edit)
    body.appendChild(h)
  }

  if (subheadingField) {
    const sub = document.createElement('div')
    sub.className = 'ui-view-sub'
    sub.appendChild(editableField(subheadingField, get, set))
    body.appendChild(sub)
  }

  const dl = document.createElement('dl')
  for (const field of form.parts || []) {
    if (!field.property) continue
    if (field.property === headingProp || field.property === subheadingProp) continue
    const dt = document.createElement('dt')
    dt.textContent = field.label || ''
    const dd = document.createElement('dd')
    dd.appendChild(editableField(field, get, set))
    dl.appendChild(dt)
    dl.appendChild(dd)
  }
  body.appendChild(dl)
  root.appendChild(body)

  container.innerHTML = ''
  container.appendChild(root)
  return root
}

// --- LOSOS pane interface ---

const _forms = new Map()  // targetClass → form definition

export function registerForm(targetClass, form) {
  _forms.set(targetClass, form)
  // Also index a urn:solid:* alias for bare/non-prefixed types so a form
  // registered as 'Person' matches incoming 'urn:solid:Person' and vice versa.
  if (targetClass.startsWith('urn:solid:')) {
    _forms.set(targetClass.slice('urn:solid:'.length), form)
  } else if (!/^[a-z]+:/.test(targetClass)) {
    _forms.set('urn:solid:' + targetClass, form)
  }
}

function typeOf(subject, store) {
  // LOSOS panes idiomatically: store.get(subject.value) → store.type(node)
  const id = (subject && typeof subject === 'object') ? subject.value : subject
  const node = store.get(id)
  return store.type(node)
}

export function canHandle(subject, store) {
  return _forms.has(typeOf(subject, store))
}

// Tiny store adapter: reads from the inline JSON-LD data island, writes back via
// debounced PUT. Uses window.xlogin.authFetch when available, plain fetch otherwise.
// The form's `property` keys are bare (matching the JSON-LD source under @vocab),
// so adapter just does node[propName] read/write.
function makeDataAdapter() {
  const dataEl = document.querySelector('script[type="application/ld+json"]')
  if (!dataEl) return null
  let data
  try { data = JSON.parse(dataEl.textContent || '{}') } catch { return null }
  const src = dataEl.getAttribute('src')
  const dataUrl = src ? new URL(src, window.location.href).href : null
  let saveTimer
  const save = () => {
    if (!dataUrl) return
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const body = JSON.stringify(data, null, 2)
      const fetcher = (typeof window !== 'undefined' && window.xlogin && window.xlogin.authFetch) || fetch
      try { await fetcher(dataUrl, { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body }) }
      catch (e) { console.warn('[ui-pane] PUT failed:', e) }
    }, 800)
  }
  return {
    root: data,
    prop: (_subj, p) => data[p] ?? '',
    set:  (_subj, p, v) => { if (v === '' || v == null) delete data[p]; else data[p] = v; save() }
  }
}

export function render(subject, store, container) {
  const form = _forms.get(typeOf(subject, store))
  if (!form) return
  const adapter = makeDataAdapter()
  if (!adapter) { container.textContent = 'No data island found.'; return }
  try {
    renderEditable(container, form, adapter, adapter.root)
  } catch (e) {
    console.error('[ui-pane] renderEditable threw:', e)
    container.innerHTML = '<pre style="color:#c44;padding:1em;white-space:pre-wrap">' + e.stack + '</pre>'
  }
}

// --- Auto-register forms from solid-ui.github.io for every @type on the page ---
// Runs at module load via top-level await; LOSOS's loadPanes awaits the import
// so by the time canHandle is consulted, forms are populated.

const FORMS_BASE = 'https://solid-ui.github.io/'

async function autoRegisterFromPage() {
  if (typeof document === 'undefined') return
  const types = new Set()
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const txt = el.textContent && el.textContent.trim()
      if (!txt) continue
      const data = JSON.parse(txt)
      const t = data && data['@type']
      if (typeof t === 'string') types.add(t)
      else if (Array.isArray(t)) for (const x of t) if (typeof x === 'string') types.add(x)
    } catch {}
  }
  await Promise.all([...types].map(async (type) => {
    const short = type.replace(/^urn:solid:/, '').replace(/^[a-z]+:/, '').replace(/^.*[#/]/, '')
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(short)) return
    try {
      const res = await fetch(FORMS_BASE + short + '/index.json')
      if (!res.ok) return
      registerForm(type, await res.json())
    } catch {}
  }))
}

await autoRegisterFromPage()

// LOSOS default-export shape — picked up by `<script data-pane src=...>`
export default {
  label: 'Inline',
  icon: '\u270F\uFE0F',
  canHandle,
  render
}

// --- Styles ---

function injectStyles() {
  if (document.getElementById('ui-pane-css')) return
  const s = document.createElement('style')
  s.id = 'ui-pane-css'
  s.textContent = `
.ui-form { max-width: 520px; font-family: system-ui, sans-serif; color: #222; }
.ui-form h2 { margin: 0 0 1rem; font-size: 1.25rem; border-bottom: 1px solid #ddd; padding-bottom: .5rem; }
.ui-field { margin-bottom: .75rem; }
.ui-field > label { display: block; }
.ui-field > label > span { display: block; font-weight: 500; font-size: .9rem; margin-bottom: .25rem; }
.ui-field-inline > label { display: flex; align-items: center; gap: .5rem; cursor: pointer; }
.ui-field-inline > label > span { display: inline; margin: 0; font-weight: 500; }
.ui-field small { display: block; color: #666; font-weight: normal; margin-top: 4px; font-size: .8rem; }
.ui-field input, .ui-field select, .ui-field textarea {
  display: block; width: 100%; padding: .45rem .55rem;
  border: 1px solid #ccc; border-radius: 4px; font-size: .9rem;
  box-sizing: border-box; font-family: inherit;
}
.ui-field input[type=checkbox] { width: auto; display: inline-block; margin-right: .5rem; }
.ui-field input[type=color] { width: 60px; padding: 2px; height: 32px; }
.ui-field input:focus, .ui-field select:focus, .ui-field textarea:focus {
  outline: none; border-color: #06c; box-shadow: 0 0 0 2px #06c3;
}
.ui-field fieldset { border: 1px solid #ddd; border-radius: 4px; padding: .75rem 1rem; margin: 0; }
.ui-field legend { padding: 0 .5rem; font-weight: 500; font-size: .9rem; }
.ui-form .req { color: #e44; }
.ui-comment { color: #666; font-size: .85rem; margin: .5rem 0; }
.ui-heading { font-size: 1rem; margin: 1rem 0 .5rem; }
.ui-unknown { color: #c33; }

.ui-view { display: flex; gap: 1.5rem; align-items: flex-start; }
.ui-view-avatar { width: 72px; height: 72px; flex-shrink: 0; border-radius: 50%;
  background: linear-gradient(135deg, #06c, #0af); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 1.5rem; letter-spacing: .05em;
  overflow: hidden; }
.ui-view-avatar.favicon { background: #fff; border: 1px solid #eaeaea; padding: 10px; }
.ui-view-avatar.favicon img { width: 100%; height: 100%; object-fit: contain; }
.ui-view-body { flex: 1; min-width: 0; }
.ui-view-body > h2 { margin: 0 0 .25rem; font-size: 1.4rem; font-weight: 600; }
.ui-view-sub { margin: 0 0 1rem; font-size: .95rem; color: #666; word-break: break-all; }
.ui-view-sub a { color: #06c; text-decoration: none; }
.ui-view-sub a:hover { text-decoration: underline; }
.ui-view dl { margin: 0; display: grid; grid-template-columns: max-content 1fr;
  gap: .4rem 1.25rem; font-size: .9rem; }
.ui-view dt { color: #888; font-weight: 500; }
.ui-view dd { margin: 0; color: #222; word-break: break-word; }
.ui-view dd a { color: #06c; text-decoration: none; }
.ui-view dd a:hover { text-decoration: underline; }

.ui-editable { display: inline-block; cursor: text; border-radius: 4px;
  padding: 1px 5px; margin: -1px -5px; transition: background .12s ease;
  min-width: 1ch; outline: none; }
.ui-editable:hover { background: #f0f4f8; }
.ui-editable:focus-within { background: #fff; }
.ui-editable.editing { padding: 0; margin: 0; background: transparent; }
.ui-editable.editing input, .ui-editable.editing select, .ui-editable.editing textarea {
  border: 1px solid #06c; border-radius: 4px; padding: 1px 4px;
  font: inherit; color: inherit; background: #fff; outline: none;
  box-shadow: 0 0 0 2px #06c3; min-width: 4ch; }
.ui-editable.editing textarea { width: 100%; resize: vertical; }
.ui-empty { color: #aaa; font-style: italic; }

.ui-chips { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.ui-chip {
  display: inline-flex; align-items: center;
  padding: 2px 9px; border-radius: 999px;
  background: #f0f4f8; border: 1px solid #e0e6ec;
  font-size: .85rem; color: #345; line-height: 1.4;
  max-width: 100%; word-break: break-all;
}
.ui-chip a { color: inherit; text-decoration: none; }
.ui-chip a:hover { color: #06c; }

.ui-heading-inline { margin: 0 0 .25rem; font-size: 1.4rem; font-weight: 600; }
.ui-heading-inline .ui-editable { padding: 0 4px; margin: 0 -4px; }
.ui-view-editable .ui-view-sub .ui-editable { font-size: .95rem; }
.ui-view-editable dt { align-self: center; }
.ui-view-editable dd { line-height: 1.8; }
`
  document.head.appendChild(s)
}
