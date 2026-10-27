// Discrepancy calculation for counting sessions. Pure functions.
//
// A session line looks like:
//   { productId, sku, barcode, name, category, unit, locationCode,
//     expected, unitCost, counted (number | null), countedAt, countedBy,
//     recount (boolean), note, history: [{ counted, at, by }] }

export const MAX_QUANTITY = 1_000_000;

export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** counted - expected, or null while the line is not counted yet. */
export function lineVariance(line) {
  if (line.counted === null || line.counted === undefined) return null;
  return line.counted - line.expected;
}

/** 'uncounted' | 'match' | 'shortage' | 'surplus' */
export function lineStatus(line) {
  const v = lineVariance(line);
  if (v === null) return 'uncounted';
  if (v === 0) return 'match';
  return v < 0 ? 'shortage' : 'surplus';
}

/** Variance as a percentage of the expected quantity (null if undefined). */
export function variancePercent(line) {
  const v = lineVariance(line);
  if (v === null) return null;
  if (line.expected === 0) return v === 0 ? 0 : null;
  return round2((v / line.expected) * 100);
}

/** Monetary value of the variance (variance * unit cost). */
export function varianceValue(line) {
  const v = lineVariance(line);
  if (v === null) return 0;
  return round2(v * (line.unitCost || 0));
}

export function summarize(lines) {
  const s = {
    total: lines.length,
    counted: 0,
    uncounted: 0,
    matched: 0,
    shortageLines: 0,
    surplusLines: 0,
    shortageUnits: 0,
    surplusUnits: 0,
    netUnits: 0,
    shortageValue: 0,
    surplusValue: 0,
    netValue: 0,
    expectedUnits: 0,
    countedUnits: 0,
    accuracy: null,
    progress: 0,
  };
  for (const line of lines) {
    s.expectedUnits += line.expected;
    const status = lineStatus(line);
    if (status === 'uncounted') {
      s.uncounted += 1;
      continue;
    }
    s.counted += 1;
    s.countedUnits += line.counted;
    const v = lineVariance(line);
    const value = varianceValue(line);
    if (status === 'match') s.matched += 1;
    else if (status === 'shortage') {
      s.shortageLines += 1;
      s.shortageUnits += -v;
      s.shortageValue += -value;
    } else {
      s.surplusLines += 1;
      s.surplusUnits += v;
      s.surplusValue += value;
    }
    s.netUnits += v;
    s.netValue += value;
  }
  s.shortageValue = round2(s.shortageValue);
  s.surplusValue = round2(s.surplusValue);
  s.netValue = round2(s.netValue);
  s.accuracy = s.counted === 0 ? null : round2((s.matched / s.counted) * 100);
  s.progress = s.total === 0 ? 0 : round2((s.counted / s.total) * 100);
  return s;
}

/** Variance totals grouped by category, sorted by category name. */
export function byCategory(lines) {
  const map = new Map();
  for (const line of lines) {
    const status = lineStatus(line);
    if (status === 'uncounted') continue;
    let row = map.get(line.category);
    if (!row) {
      row = { category: line.category, counted: 0, matched: 0, shortageUnits: 0, surplusUnits: 0 };
      map.set(line.category, row);
    }
    row.counted += 1;
    const v = lineVariance(line);
    if (status === 'match') row.matched += 1;
    else if (v < 0) row.shortageUnits += -v;
    else row.surplusUnits += v;
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * Finds the line matching a scanned code (barcode first, then SKU), ignoring case.
 * `onlyEditable` lets callers restrict the search (e.g. recount lines only).
 */
export function findLineByCode(lines, code, predicate = () => true) {
  const needle = String(code ?? '').trim().toLowerCase();
  if (!needle) return null;
  const candidates = lines.filter(predicate);
  return (
    candidates.find((l) => l.barcode && l.barcode.toLowerCase() === needle) ||
    candidates.find((l) => l.sku.toLowerCase() === needle) ||
    null
  );
}

export function isValidQuantity(qty) {
  return Number.isInteger(qty) && qty >= 0 && qty <= MAX_QUANTITY;
}

/**
 * Returns a new line with the count applied.
 * mode 'add' adds `qty` to the current count, mode 'set' replaces it.
 */
export function applyCount(line, qty, mode, meta = {}) {
  if (!isValidQuantity(qty)) throw new RangeError('invalid quantity');
  if (mode !== 'add' && mode !== 'set') throw new TypeError('invalid mode');
  const next = mode === 'add' ? (line.counted ?? 0) + qty : qty;
  if (!isValidQuantity(next)) throw new RangeError('invalid quantity');
  return {
    ...line,
    counted: next,
    countedAt: meta.at ?? Date.now(),
    countedBy: meta.by ?? line.countedBy ?? null,
  };
}

/** Lines that are counted and differ from the expected quantity. */
export function discrepantLines(lines) {
  return lines.filter((l) => {
    const s = lineStatus(l);
    return s === 'shortage' || s === 'surplus';
  });
}

/** Counted units per local day over the last `days` days (oldest first). */
export function countsPerDay(sessions, now, days = 14) {
  const day = 24 * 60 * 60 * 1000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * day);
    buckets.push({ date: d, from: d.getTime(), lines: 0 });
  }
  for (const session of sessions) {
    for (const line of session.lines) {
      if (!line.countedAt) continue;
      const bucket = buckets.find((b) => line.countedAt >= b.from && line.countedAt < b.from + day);
      if (bucket) bucket.lines += 1;
    }
  }
  return buckets.map(({ date, lines }) => ({ date, lines }));
}
