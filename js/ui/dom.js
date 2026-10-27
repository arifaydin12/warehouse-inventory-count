// Tiny DOM helpers. Strings are always inserted as text nodes (never as HTML).

const SVG_NS = 'http://www.w3.org/2000/svg';
const PROPERTY_ATTRS = new Set(['value', 'checked', 'disabled', 'selected', 'hidden', 'indeterminate']);

function applyProps(el, props) {
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.setAttribute('class', value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (PROPERTY_ATTRS.has(key) && !(el instanceof SVGElement)) el[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

export function s(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

/** Replaces the children of el (null / false entries are skipped, unlike Element.append). */
export function fill(el, ...children) {
  el.replaceChildren();
  appendChildren(el, children);
  return el;
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

let idCounter = 0;
export function nextId(prefix = 'id') {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Triggers a file download from text content. */
export function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slug(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 50);
}
