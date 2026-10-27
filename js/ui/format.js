// Display helpers shared by views and the PDF report.

import { t, localized, categoryLabel, DICTIONARIES } from '../i18n.js';
import { KNOWN_CATEGORIES, resolveCategory } from '../domain/categories.js';
import { getData } from '../core/store.js';
import { lineStatus } from '../domain/discrepancy.js';

export const lineName = (line) => localized(line, 'name');
export const productName = (product) => localized(product, 'name');
export const sessionName = (session) => localized(session, 'name');
export const warehouseName = (warehouse) => localized(warehouse, 'name');

export function warehouseById(id) {
  const w = getData().warehouses.find((x) => x.id === id);
  return w ? warehouseName(w) : '—';
}

export function userNameById(id) {
  return getData().users.find((u) => u.id === id)?.name ?? '—';
}

export const unitLabel = (unit) => t(`unit.${unit}`);
export const statusLabel = (status) => t(`status.${status}`);
export const lineStatusLabel = (line) => t(`line.${lineStatus(line)}`);
export { categoryLabel };

/** Translated description of an audit entry. */
export function auditText(entry) {
  const params = { ...entry.params };
  return t(`audit.action.${entry.action}`, params);
}

/** Maps typed category text (any supported language) to a built-in category id when it matches. */
export function normalizeCategory(text) {
  const labels = Object.fromEntries(
    KNOWN_CATEGORIES.map((id) => [id, Object.values(DICTIONARIES).map((d) => d[`category.${id}`])]),
  );
  return resolveCategory(text, labels);
}
