// Form and import validation. Pure functions.
// Errors are { key, params } objects where key is an i18n key (see js/locales).

import { ROLES } from './permissions.js';
import { MAX_QUANTITY } from './discrepancy.js';

export const UNITS = ['pcs', 'box', 'pack', 'kg', 'l', 'm', 'pallet'];
export const MAX_COST = 1_000_000;

const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,23}$/;
const BARCODE_RE = /^[A-Za-z0-9-]{4,32}$/;
const WAREHOUSE_CODE_RE = /^[A-Z0-9]{2,8}$/;
const LOCATION_CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

const err = (key, params) => (params ? { key, params } : { key });

const str = (v) => String(v ?? '').trim();

/** Strict non-negative integer parser: returns NaN for anything else. */
export function parseIntegerStrict(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? value : NaN;
  const s = str(value);
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

/** Decimal parser accepting "12.50" and "12,50"; returns NaN when invalid or negative. */
export function parseDecimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : NaN;
  const s = str(value).replace(',', '.');
  return /^\d+(\.\d{1,4})?$/.test(s) ? Number(s) : NaN;
}

function checkLength(errors, field, value, min, max) {
  if (value.length === 0) errors[field] = err('validation.required');
  else if (value.length < min) errors[field] = err('validation.minLength', { min });
  else if (value.length > max) errors[field] = err('validation.maxLength', { max });
}

export function validateProduct(input, { products, locations, editingId = null }) {
  const errors = {};
  const value = {
    sku: str(input.sku),
    barcode: str(input.barcode),
    name: str(input.name),
    category: str(input.category),
    unit: str(input.unit),
    locationId: str(input.locationId),
    expected: parseIntegerStrict(input.expected),
    unitCost: str(input.unitCost) === '' ? 0 : parseDecimal(input.unitCost),
  };

  if (!value.sku) errors.sku = err('validation.required');
  else if (!SKU_RE.test(value.sku)) errors.sku = err('validation.skuFormat');
  else if (products.some((p) => p.id !== editingId && p.sku.toLowerCase() === value.sku.toLowerCase())) {
    errors.sku = err('validation.skuDuplicate');
  }

  if (value.barcode) {
    if (!BARCODE_RE.test(value.barcode)) errors.barcode = err('validation.barcodeFormat');
    else if (products.some((p) => p.id !== editingId && p.barcode && p.barcode.toLowerCase() === value.barcode.toLowerCase())) {
      errors.barcode = err('validation.barcodeDuplicate');
    }
  }

  checkLength(errors, 'name', value.name, 2, 80);
  checkLength(errors, 'category', value.category, 2, 40);

  if (!UNITS.includes(value.unit)) errors.unit = err('validation.unitInvalid');

  if (!value.locationId) errors.locationId = err('validation.required');
  else if (!locations.some((l) => l.id === value.locationId)) errors.locationId = err('validation.locationInvalid');

  if (Number.isNaN(value.expected)) errors.expected = err('validation.integerNonNegative');
  else if (value.expected > MAX_QUANTITY) errors.expected = err('validation.tooLarge', { max: MAX_QUANTITY });

  if (Number.isNaN(value.unitCost)) errors.unitCost = err('validation.decimalNonNegative');
  else if (value.unitCost > MAX_COST) errors.unitCost = err('validation.tooLarge', { max: MAX_COST });

  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateWarehouse(input, { warehouses, editingId = null }) {
  const errors = {};
  const value = { name: str(input.name), code: str(input.code).toUpperCase() };
  checkLength(errors, 'name', value.name, 2, 60);
  if (!value.code) errors.code = err('validation.required');
  else if (!WAREHOUSE_CODE_RE.test(value.code)) errors.code = err('validation.warehouseCodeFormat');
  else if (warehouses.some((w) => w.id !== editingId && w.code === value.code)) errors.code = err('validation.codeDuplicate');
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateLocation(input, { locations, editingId = null }) {
  const errors = {};
  const value = { code: str(input.code).toUpperCase() };
  if (!value.code) errors.code = err('validation.required');
  else if (!LOCATION_CODE_RE.test(value.code)) errors.code = err('validation.locationCodeFormat');
  else if (locations.some((l) => l.id !== editingId && l.code === value.code)) errors.code = err('validation.codeDuplicate');
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateUser(input, { users, editingId = null, requirePin = true }) {
  const errors = {};
  const value = { name: str(input.name), role: str(input.role), pin: str(input.pin) };
  checkLength(errors, 'name', value.name, 2, 50);
  if (users.some((u) => u.id !== editingId && u.name.toLowerCase() === value.name.toLowerCase())) {
    errors.name = err('validation.nameDuplicate');
  }
  if (!ROLES.includes(value.role)) errors.role = err('validation.invalidRole');
  if (value.pin === '' && !requirePin) {
    // keep the current PIN
  } else if (!/^\d{4}$/.test(value.pin)) {
    errors.pin = err('validation.pinFormat');
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateSession(input, { warehouses }) {
  const errors = {};
  const value = { name: str(input.name), warehouseId: str(input.warehouseId), locationId: str(input.locationId) };
  checkLength(errors, 'name', value.name, 3, 80);
  if (!value.warehouseId) errors.warehouseId = err('validation.required');
  else if (!warehouses.some((w) => w.id === value.warehouseId)) errors.warehouseId = err('validation.required');
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Validates an entered count. Returns { ok, value, error }. */
export function validateQuantity(input) {
  const value = parseIntegerStrict(input);
  if (Number.isNaN(value)) return { ok: false, value: NaN, error: err('validation.integerNonNegative') };
  if (value > MAX_QUANTITY) return { ok: false, value: NaN, error: err('validation.tooLarge', { max: MAX_QUANTITY }) };
  return { ok: true, value, error: null };
}
