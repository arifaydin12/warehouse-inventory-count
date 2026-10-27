import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../../js/locales/en.js';
import de from '../../js/locales/de.js';
import pl from '../../js/locales/pl.js';
import {
  LANGUAGES, DEFAULT_LANGUAGE, setLanguage, t, tn, localized, categoryLabel, formatSigned, getLanguage,
} from '../../js/i18n.js';
import { ROLES } from '../../js/domain/permissions.js';
import { SESSION_STATUSES } from '../../js/domain/workflow.js';
import { UNITS } from '../../js/domain/validation.js';
import { KNOWN_CATEGORIES } from '../../js/domain/categories.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dictionaries = { en, de, pl };

/** Base key without the plural suffix ("key#one" -> "key"). */
const base = (key) => key.split('#')[0];
const baseKeys = (dict) => new Set(Object.keys(dict).map(base));
const params = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('languages are English (default), German and Polish', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code), ['en', 'de', 'pl']);
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(getLanguage(), 'en');
});

test('every language defines exactly the same keys as English', () => {
  const reference = baseKeys(en);
  for (const [code, dict] of Object.entries(dictionaries)) {
    const keys = baseKeys(dict);
    const missing = [...reference].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !reference.has(k));
    assert.deepEqual(missing, [], `${code}: missing keys`);
    assert.deepEqual(extra, [], `${code}: unexpected keys`);
  }
});

test('plural keys provide all categories required by each language', () => {
  for (const [code, dict] of Object.entries(dictionaries)) {
    const locale = LANGUAGES.find((l) => l.code === code).locale;
    const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    const pluralBases = new Set(Object.keys(dict).filter((k) => k.includes('#')).map(base));
    assert.ok(pluralBases.size > 0);
    for (const b of pluralBases) {
      for (const category of required) assert.ok(`${b}#${category}` in dict, `${code}: ${b}#${category}`);
    }
  }
});

test('translations keep the same {placeholders} as English', () => {
  for (const [code, dict] of Object.entries(dictionaries)) {
    for (const [key, text] of Object.entries(dict)) {
      const reference = en[key] ?? en[`${base(key)}#other`];
      assert.deepEqual(params(text), params(reference), `${code}: ${key}`);
    }
  }
});

test('no translation is empty or left identical to a placeholder key', () => {
  for (const [code, dict] of Object.entries(dictionaries)) {
    for (const [key, text] of Object.entries(dict)) {
      assert.ok(typeof text === 'string' && text.trim().length > 0, `${code}: ${key}`);
      assert.notEqual(text, key, `${code}: ${key}`);
    }
  }
});

test('German and Polish are really translated (most strings differ from English)', () => {
  for (const dict of [de, pl]) {
    const keys = Object.keys(en);
    const same = keys.filter((k) => dict[k] === en[k]);
    assert.ok(same.length / keys.length < 0.15, `too many untranslated strings: ${same.slice(0, 10).join(', ')}`);
  }
});

test('enumerations used with dynamic keys are fully translated', () => {
  const needed = [
    ...ROLES.map((r) => `role.${r}`),
    ...SESSION_STATUSES.map((s) => `status.${s}`),
    ...UNITS.map((u) => `unit.${u}`),
    ...KNOWN_CATEGORIES.map((c) => `category.${c}`),
    ...['uncounted', 'match', 'shortage', 'surplus', 'recount'].map((s) => `line.${s}`),
    ...['auth', 'product', 'warehouse', 'location', 'session', 'user', 'export', 'data'].map((g) => `audit.group.${g}`),
    ...['sku', 'barcode', 'name', 'category', 'unit', 'location', 'expected', 'unitCost'].map((f) => `import.field.${f}`),
    'scan.mode.add', 'scan.mode.set',
  ];
  for (const [code, dict] of Object.entries(dictionaries)) {
    for (const key of needed) assert.ok(key in dict, `${code}: ${key}`);
  }
});

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === 'locales') continue;
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (name.endsWith('.js')) yield full;
  }
}

test('every i18n key referenced in source code exists in English', () => {
  const used = new Map();
  const patterns = [
    /\btn?\(\s*'([A-Za-z0-9_.]+)'/g,
    /new (?:ActionError|ValidationError)\(\s*'([A-Za-z0-9_.]+)'/g,
    /\bkey:\s*'([a-z]+\.[A-Za-z0-9_.]+)'/g,
    /\breason:\s*'([A-Za-z0-9_.]+)'/g,
    /\berr\(\s*'([A-Za-z0-9_.]+)'/g,
    /\bt\(\s*(?:submitState\.reason|e\.key)/g,
  ];
  for (const file of sourceFiles(join(root, 'js'))) {
    const text = readFileSync(file, 'utf8');
    for (const re of patterns) {
      for (const m of text.matchAll(re)) if (m[1]) used.set(m[1], file);
    }
  }
  assert.ok(used.size > 100, 'expected to find many keys');
  const enBase = baseKeys(en);
  const missing = [...used.keys()].filter((k) => !enBase.has(k) && !k.startsWith('error.notFound') );
  assert.deepEqual(missing.map((k) => `${k} (${used.get(k)})`), []);
});

test('no unused translation keys remain (keeps the dictionaries lean)', () => {
  const corpus = [...sourceFiles(join(root, 'js'))].map((f) => readFileSync(f, 'utf8')).join('\n');
  const dynamicPrefixes = ['role.', 'status.', 'unit.', 'category.', 'line.', 'audit.group.', 'audit.action.', 'import.field.', 'scan.mode.', 'validation.', 'csv.', 'sessions.error.', 'error.', 'users.', 'locations.', 'warehouses.', 'login.', 'scan.', 'products.', 'camera.'];
  const unused = [...baseKeys(en)].filter((k) => !corpus.includes(`'${k}'`) && !dynamicPrefixes.some((p) => k.startsWith(p)));
  assert.deepEqual(unused, []);
});

test('t(), tn() and helpers use the active language with English fallback', () => {
  setLanguage('pl');
  assert.equal(t('common.save'), pl['common.save']);
  assert.equal(t('login.locked', { seconds: 7 }), 'Zbyt wiele prób. Spróbuj ponownie za 7 s.');
  assert.equal(t('does.not.exist'), 'does.not.exist');
  assert.equal(tn('locations.products', 1), '1 produkt');
  assert.equal(tn('locations.products', 3), '3 produkty');
  assert.equal(tn('locations.products', 5), '5 produktów');
  assert.equal(categoryLabel('tools'), 'Narzędzia');
  assert.equal(categoryLabel('my custom'), 'my custom');
  setLanguage('de');
  assert.equal(tn('locations.products', 1), '1 Produkt');
  assert.equal(tn('locations.products', 2), '2 Produkte');
  setLanguage('en');
  assert.equal(tn('locations.products', 1), '1 product');
  assert.equal(tn('locations.products', 0), '0 products');
  setLanguage('xx');
  assert.equal(getLanguage(), 'en', 'unsupported languages fall back to English');
});

test('localized() prefers per-language overrides and falls back to the base value', () => {
  const entity = { name: 'Cable', i18n: { pl: { name: 'Kabel' } } };
  assert.equal(localized(entity, 'name', 'pl'), 'Kabel');
  assert.equal(localized(entity, 'name', 'de'), 'Cable');
  assert.equal(localized(entity, 'name', 'en'), 'Cable');
  assert.equal(localized(null, 'name', 'en'), '');
});

test('formatSigned shows an explicit sign', () => {
  setLanguage('en');
  assert.equal(formatSigned(3), '+3');
  assert.equal(formatSigned(-2), '−2');
  assert.equal(formatSigned(0), '0');
  assert.equal(formatSigned(null), '—');
});

test('English dictionary contains no Turkish-specific characters', () => {
  const turkish = /[\u011f\u015f\u0131\u0130\u011e\u015e\u00e7\u00c7]/;
  for (const dict of Object.values(dictionaries)) {
    for (const [key, text] of Object.entries(dict)) assert.ok(!turkish.test(text), key);
  }
});
