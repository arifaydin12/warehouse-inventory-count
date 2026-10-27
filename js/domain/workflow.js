// Counting-session workflow: statuses, transitions, recount handling. Pure functions.
//
//   open ──submit──▶ submitted ──approve──▶ approved
//     │                 │
//     │                 └──request recount──▶ recount ──submit──▶ submitted
//     └──cancel──▶ cancelled (also from submitted / recount)

import { lineStatus } from './discrepancy.js';

export const SESSION_STATUSES = ['open', 'submitted', 'recount', 'approved', 'cancelled'];

export const TRANSITIONS = {
  open: ['submitted', 'cancelled'],
  submitted: ['approved', 'recount', 'cancelled'],
  recount: ['submitted', 'cancelled'],
  approved: [],
  cancelled: [],
};

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

/** Counting is possible while the session is open or in recount. */
export function isCountingStatus(status) {
  return status === 'open' || status === 'recount';
}

export function isActiveStatus(status) {
  return isCountingStatus(status) || status === 'submitted';
}

/** Lines that may currently be counted. During a recount only flagged lines are editable. */
export function isLineEditable(session, line) {
  if (session.status === 'open') return true;
  if (session.status === 'recount') return line.recount === true;
  return false;
}

export function editableLines(session) {
  return session.lines.filter((l) => isLineEditable(session, l));
}

/**
 * Whether the session can be submitted for review.
 * Returns { ok, remaining, reason } where reason is an i18n key.
 */
export function canSubmit(session) {
  if (!isCountingStatus(session.status)) {
    return { ok: false, remaining: 0, reason: 'sessions.error.notCounting' };
  }
  const remaining = editableLines(session).filter((l) => lineStatus(l) === 'uncounted').length;
  if (remaining > 0) return { ok: false, remaining, reason: 'sessions.error.uncounted' };
  if (session.lines.length === 0) return { ok: false, remaining: 0, reason: 'sessions.error.empty' };
  return { ok: true, remaining: 0, reason: null };
}

/**
 * Flags the given products for recount: their current count moves to the history
 * and the line becomes uncounted again. Other lines keep their `recount` flag cleared.
 */
export function requestRecount(lines, productIds, meta = {}) {
  const ids = new Set(productIds);
  if (ids.size === 0) throw new Error('no lines selected');
  return lines.map((line) => {
    if (!ids.has(line.productId)) return { ...line, recount: false };
    const history = [...(line.history || [])];
    if (line.counted !== null && line.counted !== undefined) {
      history.push({ counted: line.counted, at: line.countedAt ?? meta.at ?? Date.now(), by: line.countedBy ?? null });
    }
    return { ...line, recount: true, counted: null, countedAt: null, history };
  });
}

/** Clears recount flags (used after the recounted lines were submitted again). */
export function clearRecountFlags(lines) {
  return lines.map((l) => (l.recount ? { ...l, recount: false } : l));
}

/** Stock adjustments that approving the session applies: [{ productId, from, to }]. */
export function stockAdjustments(session) {
  return session.lines
    .filter((l) => l.counted !== null && l.counted !== undefined && l.counted !== l.expected)
    .map((l) => ({ productId: l.productId, from: l.expected, to: l.counted }));
}

/** Snapshot lines for a new session from the product list. */
export function buildSessionLines(products, locationsById, locationIds = null) {
  const scope = locationIds && locationIds.length ? new Set(locationIds) : null;
  return products
    .filter((p) => !scope || scope.has(p.locationId))
    .map((p) => ({
      productId: p.id,
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      i18n: p.i18n ? structuredCloneSafe(p.i18n) : undefined,
      category: p.category,
      unit: p.unit,
      locationCode: locationsById.get(p.locationId)?.code ?? '',
      expected: p.expected,
      unitCost: p.unitCost || 0,
      counted: null,
      countedAt: null,
      countedBy: null,
      recount: false,
      note: '',
      history: [],
    }));
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
