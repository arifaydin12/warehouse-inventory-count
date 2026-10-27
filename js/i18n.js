// Minimal i18n: flat dictionaries, {param} interpolation, CLDR plurals ("key#one" / "key#few" ...).
// Importable from Node (no DOM access at import time).

import en from './locales/en.js';
import de from './locales/de.js';
import pl from './locales/pl.js';

export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-GB' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'pl', label: 'Polski', locale: 'pl-PL' },
];

export const DEFAULT_LANGUAGE = 'en';
export const CURRENCY = 'EUR';

export const DICTIONARIES = { en, de, pl };

let current = DEFAULT_LANGUAGE;
const listeners = new Set();

export function isSupportedLanguage(code) {
  return LANGUAGES.some((l) => l.code === code);
}

export function getLanguage() {
  return current;
}

export function getLocale() {
  return LANGUAGES.find((l) => l.code === current).locale;
}

export function setLanguage(code) {
  const next = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  current = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
}

export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function hasKey(key, lang = current) {
  return Object.prototype.hasOwnProperty.call(DICTIONARIES[lang] ?? {}, key);
}

/** Translates a key; falls back to English, then to the key itself. */
export function t(key, params) {
  const template = DICTIONARIES[current][key] ?? DICTIONARIES.en[key] ?? key;
  return interpolate(template, params);
}

/** Translates an error object { key, params } (or returns an empty string). */
export function te(error) {
  return error ? t(error.key, error.params) : '';
}

/** Plural-aware translation: looks up "key#one", "key#few", ... using the current locale's rules. */
export function tn(key, count, params = {}) {
  const category = new Intl.PluralRules(getLocale()).select(count);
  const dict = DICTIONARIES[current];
  const template =
    dict[`${key}#${category}`] ?? dict[`${key}#other`] ?? DICTIONARIES.en[`${key}#${category}`] ?? DICTIONARIES.en[`${key}#other`] ?? key;
  return interpolate(template, { n: formatNumber(count), ...params });
}

export function formatNumber(n, options) {
  return new Intl.NumberFormat(getLocale(), options).format(n);
}

export function formatMoney(n) {
  return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: CURRENCY }).format(n);
}

export function formatPercent(n) {
  if (n === null || n === undefined) return '—';
  return `${formatNumber(n, { maximumFractionDigits: 1 })}%`;
}

export function formatDate(ts, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat(getLocale(), options).format(new Date(ts));
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  return new Intl.DateTimeFormat(getLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

/** Signed number, e.g. "+3" / "-2" / "0". */
export function formatSigned(n) {
  if (n === null || n === undefined) return '—';
  const s = formatNumber(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}

/**
 * Returns the localized value of an entity field. Seeded entities carry
 * `i18n: { de: { name }, pl: { name } }` overrides; edited entities drop them.
 */
export function localized(entity, field = 'name', lang = current) {
  return entity?.i18n?.[lang]?.[field] ?? entity?.[field] ?? '';
}

/** Category label: known categories are translated, custom ones are shown as typed. */
export function categoryLabel(category) {
  const key = `category.${category}`;
  return hasKey(key, 'en') ? t(key) : category;
}
