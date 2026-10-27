// Application actions: permission checks, validation, state changes and audit logging.
// UI code calls these and shows ActionError messages; it never mutates data directly.

import { commit, getData, getCurrentUser, setSessionUser, replaceWithSeed } from './store.js';
import { hashPin, randomSalt, isLocked, registerFailure, initialLockout, remainingSeconds } from './auth.js';
import { KEYS, readJSON, writeJSON, removeKey } from './storage.js';
import { can, canDeleteUser, canChangeRole } from '../domain/permissions.js';
import {
  validateProduct,
  validateWarehouse,
  validateLocation,
  validateUser,
  validateSession,
  validateQuantity,
} from '../domain/validation.js';
import {
  applyCount,
  findLineByCode,
  lineStatus,
} from '../domain/discrepancy.js';
import {
  buildSessionLines,
  canSubmit,
  canTransition,
  clearRecountFlags,
  isCountingStatus,
  isLineEditable,
  requestRecount as flagRecount,
  stockAdjustments,
} from '../domain/workflow.js';
import { normalizeCode } from '../domain/barcode.js';

export class ActionError extends Error {
  constructor(key, params) {
    super(key);
    this.name = 'ActionError';
    this.key = key;
    this.params = params;
  }
}

/** Raised for form validation failures; `errors` maps field -> { key, params }. */
export class ValidationError extends Error {
  constructor(errors) {
    super('validation');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

let counter = 0;
export function uid(prefix) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function requireUser(permission) {
  const user = getCurrentUser();
  if (!user) throw new ActionError('error.notSignedIn');
  if (permission && !can(user.role, permission)) throw new ActionError('error.forbidden');
  return user;
}

const AUDIT_LIMIT = 1000;

function log(data, user, action, entity, entityId, params = {}) {
  data.audit.push({
    id: uid('a'),
    ts: Date.now(),
    userId: user?.id ?? null,
    userName: user?.name ?? '—',
    action,
    entity,
    entityId: entityId ?? null,
    params,
  });
  if (data.audit.length > AUDIT_LIMIT) data.audit.splice(0, data.audit.length - AUDIT_LIMIT);
}

function findSession(data, id) {
  const session = data.sessions.find((s) => s.id === id);
  if (!session) throw new ActionError('error.notFound');
  return session;
}

// --- Authentication ---------------------------------------------------------------------

export function getLockout() {
  return readJSON('local', KEYS.lockout) ?? initialLockout();
}

export function lockoutSeconds() {
  const state = getLockout();
  return isLocked(state, Date.now()) ? remainingSeconds(state, Date.now()) : 0;
}

export async function login(userId, pin) {
  const now = Date.now();
  const lock = getLockout();
  if (isLocked(lock, now)) throw new ActionError('login.locked', { seconds: remainingSeconds(lock, now) });
  const data = getData();
  const user = data.users.find((u) => u.id === userId);
  if (!user) throw new ActionError('login.selectUser');
  if (!/^\d{4}$/.test(String(pin))) throw new ActionError('validation.pinFormat');
  const hash = await hashPin(String(pin), user.salt);
  if (hash !== user.pinHash) {
    const next = registerFailure(lock, now);
    writeJSON('local', KEYS.lockout, next);
    commit((d) => log(d, user, 'auth.failed', 'user', user.id));
    if (isLocked(next, now)) throw new ActionError('login.locked', { seconds: remainingSeconds(next, now) });
    throw new ActionError('login.wrongPin');
  }
  removeKey('local', KEYS.lockout);
  setSessionUser(user.id);
  commit((d) => log(d, user, 'auth.login', 'user', user.id));
  return user;
}

export function logout() {
  const user = getCurrentUser();
  if (user) commit((d) => log(d, user, 'auth.logout', 'user', user.id));
  setSessionUser(null);
}

export async function resetDemoData({ requireAdmin = true } = {}) {
  if (requireAdmin) requireUser('data.reset');
  removeKey('local', KEYS.lockout);
  await replaceWithSeed();
  const user = getCurrentUser();
  if (user) commit((d) => log(d, user, 'data.reset', 'system', null));
}

// --- Products ---------------------------------------------------------------------------

function stripLocalized(entity, field) {
  if (!entity.i18n) return;
  for (const lang of Object.keys(entity.i18n)) delete entity.i18n[lang][field];
}

export function saveProduct(input, id = null) {
  const user = requireUser('products.edit');
  const data = getData();
  const check = validateProduct(input, { products: data.products, locations: data.locations, editingId: id });
  if (!check.ok) throw new ValidationError(check.errors);
  return commit((d) => {
    const now = Date.now();
    if (id) {
      const product = d.products.find((p) => p.id === id);
      if (!product) throw new ActionError('error.notFound');
      if (product.name !== check.value.name) stripLocalized(product, 'name');
      Object.assign(product, check.value, { updatedAt: now });
      log(d, user, 'product.update', 'product', id, { name: product.name, sku: product.sku });
      return product;
    }
    const product = { id: uid('p'), ...check.value, createdAt: now, updatedAt: now };
    d.products.push(product);
    log(d, user, 'product.create', 'product', product.id, { name: product.name, sku: product.sku });
    return product;
  });
}

export function deleteProduct(id) {
  const user = requireUser('products.delete');
  const data = getData();
  const product = data.products.find((p) => p.id === id);
  if (!product) throw new ActionError('error.notFound');
  const used = data.sessions.some((s) => ['open', 'recount', 'submitted'].includes(s.status) && s.lines.some((l) => l.productId === id));
  if (used) throw new ActionError('products.inActiveSession');
  commit((d) => {
    d.products = d.products.filter((p) => p.id !== id);
    log(d, user, 'product.delete', 'product', id, { name: product.name, sku: product.sku });
  });
}

/** Applies the valid rows of a parsed CSV import. */
export function importProducts(rows) {
  const user = requireUser('products.import');
  const valid = rows.filter((r) => r.action === 'create' || r.action === 'update');
  if (valid.length === 0) throw new ActionError('csv.nothingToImport');
  return commit((d) => {
    const now = Date.now();
    let created = 0;
    let updated = 0;
    for (const row of valid) {
      if (row.action === 'update') {
        const product = d.products.find((p) => p.id === row.existingId);
        if (!product) continue;
        if (product.name !== row.value.name) stripLocalized(product, 'name');
        Object.assign(product, row.value, { updatedAt: now });
        updated += 1;
      } else {
        d.products.push({ id: uid('p'), ...row.value, createdAt: now, updatedAt: now });
        created += 1;
      }
    }
    log(d, user, 'product.import', 'product', null, { count: created + updated, created, updated });
    return { created, updated };
  });
}

// --- Warehouses and locations -----------------------------------------------------------

export function saveWarehouse(input, id = null) {
  const user = requireUser('warehouses.edit');
  const data = getData();
  const check = validateWarehouse(input, { warehouses: data.warehouses, editingId: id });
  if (!check.ok) throw new ValidationError(check.errors);
  return commit((d) => {
    if (id) {
      const w = d.warehouses.find((x) => x.id === id);
      if (!w) throw new ActionError('error.notFound');
      if (w.name !== check.value.name) stripLocalized(w, 'name');
      Object.assign(w, check.value);
      log(d, user, 'warehouse.update', 'warehouse', id, { name: w.name });
      return w;
    }
    const w = { id: uid('w'), ...check.value };
    d.warehouses.push(w);
    log(d, user, 'warehouse.create', 'warehouse', w.id, { name: w.name });
    return w;
  });
}

export function deleteWarehouse(id) {
  const user = requireUser('warehouses.delete');
  const data = getData();
  const w = data.warehouses.find((x) => x.id === id);
  if (!w) throw new ActionError('error.notFound');
  const locationIds = new Set(data.locations.filter((l) => l.warehouseId === id).map((l) => l.id));
  if (data.products.some((p) => locationIds.has(p.locationId))) throw new ActionError('warehouses.hasProducts');
  if (data.sessions.some((s) => s.warehouseId === id && ['open', 'recount', 'submitted'].includes(s.status))) {
    throw new ActionError('warehouses.hasSessions');
  }
  commit((d) => {
    d.warehouses = d.warehouses.filter((x) => x.id !== id);
    d.locations = d.locations.filter((l) => l.warehouseId !== id);
    log(d, user, 'warehouse.delete', 'warehouse', id, { name: w.name });
  });
}

export function addLocation(warehouseId, input) {
  const user = requireUser('warehouses.edit');
  const data = getData();
  if (!data.warehouses.some((w) => w.id === warehouseId)) throw new ActionError('error.notFound');
  const check = validateLocation(input, { locations: data.locations });
  if (!check.ok) throw new ValidationError(check.errors);
  return commit((d) => {
    const location = { id: uid('l'), warehouseId, code: check.value.code };
    d.locations.push(location);
    log(d, user, 'location.create', 'location', location.id, { code: location.code });
    return location;
  });
}

export function deleteLocation(id) {
  const user = requireUser('warehouses.edit');
  const data = getData();
  const location = data.locations.find((l) => l.id === id);
  if (!location) throw new ActionError('error.notFound');
  if (data.products.some((p) => p.locationId === id)) throw new ActionError('locations.hasProducts');
  commit((d) => {
    d.locations = d.locations.filter((l) => l.id !== id);
    log(d, user, 'location.delete', 'location', id, { code: location.code });
  });
}

// --- Counting sessions --------------------------------------------------------------------

export function createSession(input) {
  const user = requireUser('sessions.create');
  const data = getData();
  const check = validateSession(input, { warehouses: data.warehouses });
  if (!check.ok) throw new ValidationError(check.errors);
  const locationsById = new Map(data.locations.map((l) => [l.id, l]));
  const scopeIds = check.value.locationId
    ? [check.value.locationId]
    : data.locations.filter((l) => l.warehouseId === check.value.warehouseId).map((l) => l.id);
  const lines = buildSessionLines(data.products, locationsById, scopeIds.length ? scopeIds : ['__none__']);
  if (lines.length === 0) throw new ValidationError({ warehouseId: { key: 'sessions.error.noProducts' } });
  return commit((d) => {
    const session = {
      id: uid('s'),
      name: check.value.name,
      warehouseId: check.value.warehouseId,
      locationId: check.value.locationId,
      status: 'open',
      createdBy: user.id,
      createdAt: Date.now(),
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: '',
      lines,
    };
    d.sessions.push(session);
    log(d, user, 'session.create', 'session', session.id, { name: session.name });
    return session;
  });
}

/**
 * Records a count for the line matching `code` (barcode or SKU).
 * Returns { line, before } so the UI can offer an undo.
 */
export function scanCode(sessionId, rawCode, qty, mode) {
  requireUser('sessions.count');
  const code = normalizeCode(rawCode);
  if (!code) throw new ActionError('scan.empty');
  const q = validateQuantity(qty);
  if (!q.ok) throw new ValidationError({ quantity: q.error });
  const session = findSession(getData(), sessionId);
  if (!isCountingStatus(session.status)) throw new ActionError('sessions.error.notCounting');
  const anyMatch = findLineByCode(session.lines, code);
  if (!anyMatch) throw new ActionError('scan.notFound', { code });
  const target = isLineEditable(session, anyMatch) ? anyMatch : null;
  if (!target) throw new ActionError('scan.locked', { sku: anyMatch.sku });
  return writeCount(sessionId, target.productId, q.value, mode);
}

export function setLineCount(sessionId, productId, qty) {
  requireUser('sessions.count');
  const q = validateQuantity(qty);
  if (!q.ok) throw new ValidationError({ quantity: q.error });
  return writeCount(sessionId, productId, q.value, 'set', true);
}

function writeCount(sessionId, productId, qty, mode, logEdit = false) {
  const user = requireUser('sessions.count');
  return commit((d) => {
    const session = findSession(d, sessionId);
    if (!isCountingStatus(session.status)) throw new ActionError('sessions.error.notCounting');
    const index = session.lines.findIndex((l) => l.productId === productId);
    if (index < 0) throw new ActionError('error.notFound');
    const before = session.lines[index];
    if (!isLineEditable(session, before)) throw new ActionError('scan.locked', { sku: before.sku });
    let next;
    try {
      next = applyCount(before, qty, mode, { at: Date.now(), by: user.id });
    } catch {
      throw new ValidationError({ quantity: { key: 'validation.tooLarge', params: { max: 1_000_000 } } });
    }
    session.lines[index] = next;
    if (logEdit && before.counted !== next.counted) {
      log(d, user, 'session.countEdit', 'session', session.id, {
        name: session.name,
        sku: before.sku,
        from: before.counted ?? '—',
        to: next.counted,
      });
    }
    return { line: next, before };
  });
}

/** Restores a line to the state returned as `before` by scanCode (undo). */
export function restoreLine(sessionId, before) {
  requireUser('sessions.count');
  commit((d) => {
    const session = findSession(d, sessionId);
    if (!isCountingStatus(session.status)) throw new ActionError('sessions.error.notCounting');
    const index = session.lines.findIndex((l) => l.productId === before.productId);
    if (index < 0) throw new ActionError('error.notFound');
    session.lines[index] = before;
  });
}

/** Sets all still-uncounted editable lines to zero. */
export function markRemainingZero(sessionId) {
  const user = requireUser('sessions.count');
  return commit((d) => {
    const session = findSession(d, sessionId);
    if (!isCountingStatus(session.status)) throw new ActionError('sessions.error.notCounting');
    let n = 0;
    session.lines = session.lines.map((line) => {
      if (isLineEditable(session, line) && lineStatus(line) === 'uncounted') {
        n += 1;
        return applyCount(line, 0, 'set', { at: Date.now(), by: user.id });
      }
      return line;
    });
    if (n > 0) log(d, user, 'session.zeroRemaining', 'session', session.id, { name: session.name, count: n });
    return n;
  });
}

export function submitSession(sessionId) {
  const user = requireUser('sessions.submit');
  return commit((d) => {
    const session = findSession(d, sessionId);
    const check = canSubmit(session);
    if (!check.ok) throw new ActionError(check.reason, { n: check.remaining });
    session.lines = clearRecountFlags(session.lines);
    session.status = 'submitted';
    session.submittedAt = Date.now();
    log(d, user, 'session.submit', 'session', session.id, { name: session.name });
    return session;
  });
}

export function approveSession(sessionId) {
  const user = requireUser('sessions.review');
  return commit((d) => {
    const session = findSession(d, sessionId);
    if (!canTransition(session.status, 'approved')) throw new ActionError('sessions.error.notSubmitted');
    const adjustments = stockAdjustments(session);
    for (const adj of adjustments) {
      const product = d.products.find((p) => p.id === adj.productId);
      if (product) {
        product.expected = adj.to;
        product.updatedAt = Date.now();
      }
    }
    session.status = 'approved';
    session.reviewedAt = Date.now();
    session.reviewedBy = user.id;
    log(d, user, 'session.approve', 'session', session.id, { name: session.name, count: adjustments.length });
    return { session, adjustments: adjustments.length };
  });
}

export function requestRecount(sessionId, productIds, note = '') {
  const user = requireUser('sessions.review');
  if (!productIds || productIds.length === 0) throw new ActionError('sessions.error.noRecountSelection');
  return commit((d) => {
    const session = findSession(d, sessionId);
    if (!canTransition(session.status, 'recount')) throw new ActionError('sessions.error.notSubmitted');
    session.lines = flagRecount(session.lines, productIds);
    session.status = 'recount';
    session.reviewedAt = Date.now();
    session.reviewedBy = user.id;
    session.reviewNote = String(note).trim().slice(0, 200);
    log(d, user, 'session.recount', 'session', session.id, { name: session.name, count: productIds.length });
    return session;
  });
}

export function cancelSession(sessionId) {
  const user = requireUser('sessions.cancel');
  return commit((d) => {
    const session = findSession(d, sessionId);
    if (!canTransition(session.status, 'cancelled')) throw new ActionError('sessions.error.cannotCancel');
    session.status = 'cancelled';
    log(d, user, 'session.cancel', 'session', session.id, { name: session.name });
    return session;
  });
}

export function logExport(kind, params = {}) {
  const user = getCurrentUser();
  if (!user) return;
  commit((d) => log(d, user, `export.${kind}`, 'system', null, params));
}

// --- Users --------------------------------------------------------------------------------

export async function saveUser(input, id = null) {
  const actor = requireUser('users.manage');
  const data = getData();
  const check = validateUser(input, { users: data.users, editingId: id, requirePin: !id });
  if (!check.ok) throw new ValidationError(check.errors);
  if (id) {
    const change = canChangeRole(data.users, id, check.value.role);
    if (!change.ok) throw new ValidationError({ role: { key: change.reason } });
  }
  const salt = randomSalt();
  const pinHash = check.value.pin ? await hashPin(check.value.pin, salt) : null;
  return commit((d) => {
    if (id) {
      const user = d.users.find((u) => u.id === id);
      if (!user) throw new ActionError('error.notFound');
      user.name = check.value.name;
      user.role = check.value.role;
      if (pinHash) {
        user.salt = salt;
        user.pinHash = pinHash;
      }
      log(d, actor, 'user.update', 'user', id, { name: user.name });
      return user;
    }
    const user = { id: uid('u'), name: check.value.name, role: check.value.role, salt, pinHash, createdAt: Date.now() };
    d.users.push(user);
    log(d, actor, 'user.create', 'user', user.id, { name: user.name });
    return user;
  });
}

export function deleteUser(id) {
  const actor = requireUser('users.manage');
  const data = getData();
  const check = canDeleteUser(data.users, id, actor.id);
  if (!check.ok) throw new ActionError(check.reason);
  const target = data.users.find((u) => u.id === id);
  commit((d) => {
    d.users = d.users.filter((u) => u.id !== id);
    log(d, actor, 'user.delete', 'user', id, { name: target.name });
  });
}
