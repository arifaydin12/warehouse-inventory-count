// CSV parsing and export (RFC 4180 style, with delimiter detection). Pure functions.

import { validateProduct, parseDecimal, parseIntegerStrict } from './validation.js';
import { lineVariance, lineStatus, variancePercent, varianceValue } from './discrepancy.js';

const DELIMITERS = [',', ';', '\t'];

/** Picks the most frequent delimiter in the header line (outside quotes). */
export function detectDelimiter(text) {
  const clean = stripBom(text);
  const counts = new Map(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of clean) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, counts.get(ch) + 1);
  }
  let best = ',';
  let bestCount = 0;
  for (const [d, c] of counts) {
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parses CSV text into an array of rows (arrays of strings).
 * Handles quoted fields, escaped quotes ("") and CR/LF/CRLF line breaks inside and between records.
 */
export function parseCSV(text, delimiter) {
  const src = stripBom(String(text ?? ''));
  const delim = delimiter || detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delim) {
      endField();
    } else if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1;
      endRow();
    } else if (ch === '\n') {
      endRow();
    } else {
      field += ch;
    }
    i += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Characters that make spreadsheets interpret a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCell(value, { delimiter = ',', guardFormulas = true } = {}) {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'number' ? String(value) : String(value);
  if (typeof value === 'string' && guardFormulas && FORMULA_START.test(s)) s = `'${s}`;
  const needsQuotes =
    s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r') || /^\s|\s$/.test(s);
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialises rows (arrays of cells) into CSV text. */
export function toCSV(rows, { delimiter = ',', bom = false, newline = '\r\n', guardFormulas = true } = {}) {
  const body = rows.map((r) => r.map((c) => escapeCell(c, { delimiter, guardFormulas })).join(delimiter)).join(newline);
  return (bom ? '\ufeff' : '') + body + (rows.length ? newline : '');
}

// --- Product import / export ---------------------------------------------------------

export const PRODUCT_CSV_COLUMNS = ['sku', 'barcode', 'name', 'category', 'unit', 'location', 'expected', 'unit_cost'];

const HEADER_ALIASES = {
  sku: 'sku',
  barcode: 'barcode',
  ean: 'barcode',
  name: 'name',
  category: 'category',
  unit: 'unit',
  location: 'location',
  expected: 'expected',
  stock: 'expected',
  quantity: 'expected',
  unit_cost: 'unitCost',
  unitcost: 'unitCost',
  cost: 'unitCost',
  price: 'unitCost',
};

const REQUIRED_COLUMNS = ['sku', 'name', 'category', 'unit', 'location', 'expected'];

export function productsToRows(products, locationsById) {
  const rows = [PRODUCT_CSV_COLUMNS];
  for (const p of products) {
    rows.push([
      p.sku,
      p.barcode,
      p.name,
      p.category,
      p.unit,
      locationsById.get(p.locationId)?.code ?? '',
      p.expected,
      p.unitCost,
    ]);
  }
  return rows;
}

export function productsToCSV(products, locationsById, options = {}) {
  return toCSV(productsToRows(products, locationsById), { bom: true, ...options });
}

/**
 * Parses and validates a product CSV.
 *
 * ctx: { products, locations }  (existing catalogue)
 * Returns:
 *   { fatal: { key, params } | null, rows: [{ line, action, value, errors }], delimiter,
 *     counts: { create, update, invalid } }
 * `action` is 'create', 'update' (SKU already exists) or 'invalid'.
 */
export function parseProductsCSV(text, ctx) {
  const result = { fatal: null, rows: [], delimiter: ',', counts: { create: 0, update: 0, invalid: 0 } };
  const table = parseCSV(text);
  if (table.length === 0) {
    result.fatal = { key: 'csv.empty' };
    return result;
  }
  result.delimiter = detectDelimiter(text);

  const header = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? null);
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    result.fatal = { key: 'csv.missingColumns', params: { columns: missing.join(', ') } };
    return result;
  }
  if (table.length === 1) {
    result.fatal = { key: 'csv.noRows' };
    return result;
  }

  const locationByCode = new Map(ctx.locations.map((l) => [l.code.toUpperCase(), l]));
  const working = ctx.products.map((p) => ({ ...p }));
  const seenSkus = new Set();

  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const raw = {};
    header.forEach((key, col) => {
      if (key) raw[key] = (cells[col] ?? '').trim();
    });

    const errors = {};
    const location = locationByCode.get(String(raw.location ?? '').toUpperCase());
    const input = {
      sku: raw.sku,
      barcode: raw.barcode ?? '',
      name: raw.name,
      category: ctx.normalizeCategory ? ctx.normalizeCategory(raw.category ?? '') : raw.category,
      unit: String(raw.unit ?? '').toLowerCase(),
      locationId: location ? location.id : '',
      expected: raw.expected,
      unitCost: raw.unitCost ?? '',
    };
    if (!location) errors.location = { key: 'validation.locationUnknown', params: { code: raw.location || '—' } };

    const skuKey = String(raw.sku ?? '').toLowerCase();
    const existing = working.find((p) => p.sku.toLowerCase() === skuKey);
    if (seenSkus.has(skuKey) && skuKey) errors.sku = { key: 'csv.duplicateInFile' };

    const check = validateProduct(input, { products: working, locations: ctx.locations, editingId: existing?.id });
    Object.assign(errors, check.errors, errors.location ? { location: errors.location } : {});
    if (errors.locationId && !errors.location) errors.location = errors.locationId;
    delete errors.locationId;

    if (Object.keys(errors).length > 0) {
      result.rows.push({ line, action: 'invalid', value: null, input: raw, errors });
      result.counts.invalid += 1;
      return;
    }
    const action = existing ? 'update' : 'create';
    const value = check.value;
    seenSkus.add(skuKey);
    // Keep the working catalogue current so barcode duplicates inside the file are detected.
    if (existing) Object.assign(existing, value);
    else working.push({ id: `import-${line}`, ...value });
    result.rows.push({ line, action, value, input: raw, errors: {}, existingId: existing?.id ?? null });
    result.counts[action] += 1;
  });
  return result;
}

// --- Session export ------------------------------------------------------------------

export const SESSION_CSV_COLUMNS = [
  'sku', 'barcode', 'name', 'category', 'location', 'unit', 'expected', 'counted',
  'variance', 'variance_percent', 'variance_value', 'result', 'recount', 'counted_by', 'counted_at',
];

/**
 * Rows for a session export. `resolve` supplies display values:
 * { name(line), userName(id) }. Headers are always English so the file is portable.
 */
export function sessionReportRows(session, resolve = {}) {
  const nameOf = resolve.name || ((l) => l.name);
  const userName = resolve.userName || ((id) => id ?? '');
  const rows = [SESSION_CSV_COLUMNS];
  for (const line of session.lines) {
    const variance = lineVariance(line);
    rows.push([
      line.sku,
      line.barcode,
      nameOf(line),
      line.category,
      line.locationCode,
      line.unit,
      line.expected,
      line.counted ?? '',
      variance ?? '',
      variancePercent(line) ?? '',
      variance === null ? '' : varianceValue(line),
      lineStatus(line),
      line.recount ? 'yes' : '',
      line.countedBy ? userName(line.countedBy) : '',
      line.countedAt ? new Date(line.countedAt).toISOString() : '',
    ]);
  }
  return rows;
}

export { parseDecimal, parseIntegerStrict };
