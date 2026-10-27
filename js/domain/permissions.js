// Role-based access control. Pure functions, no DOM or storage access.

export const ROLES = ['admin', 'manager', 'operator'];

/** Permission -> roles that hold it. */
export const PERMISSIONS = {
  'dashboard.view': ['admin', 'manager', 'operator'],
  'products.view': ['admin', 'manager', 'operator'],
  'products.edit': ['admin', 'manager'],
  'products.import': ['admin', 'manager'],
  'products.delete': ['admin'],
  'products.export': ['admin', 'manager', 'operator'],
  'warehouses.view': ['admin', 'manager', 'operator'],
  'warehouses.edit': ['admin', 'manager'],
  'warehouses.delete': ['admin'],
  'sessions.view': ['admin', 'manager', 'operator'],
  'sessions.create': ['admin', 'manager'],
  'sessions.count': ['admin', 'manager', 'operator'],
  'sessions.submit': ['admin', 'manager', 'operator'],
  'sessions.review': ['admin', 'manager'],
  'sessions.cancel': ['admin', 'manager'],
  'reports.export': ['admin', 'manager', 'operator'],
  'audit.view': ['admin', 'manager'],
  'users.manage': ['admin'],
  'data.reset': ['admin'],
};

export function isRole(role) {
  return ROLES.includes(role);
}

export function can(role, permission) {
  const roles = PERMISSIONS[permission];
  return Boolean(roles && roles.includes(role));
}

export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((p) => can(role, p));
}

/** Permission required to open each route. */
export const ROUTE_PERMISSIONS = {
  dashboard: 'dashboard.view',
  products: 'products.view',
  warehouses: 'warehouses.view',
  sessions: 'sessions.view',
  audit: 'audit.view',
  users: 'users.manage',
};

export function canAccessRoute(role, route) {
  const permission = ROUTE_PERMISSIONS[route];
  return permission ? can(role, permission) : false;
}

/**
 * Whether `actorId` may delete the user `targetId`.
 * Returns { ok: true } or { ok: false, reason } where reason is an i18n key.
 */
export function canDeleteUser(users, targetId, actorId) {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, reason: 'error.notFound' };
  if (targetId === actorId) return { ok: false, reason: 'users.cannotDeleteSelf' };
  if (target.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) {
    return { ok: false, reason: 'users.lastAdmin' };
  }
  return { ok: true };
}

/** Whether the role of `targetId` may be changed to `newRole` (the last admin cannot be demoted). */
export function canChangeRole(users, targetId, newRole) {
  const target = users.find((u) => u.id === targetId);
  if (!target) return { ok: false, reason: 'error.notFound' };
  if (!isRole(newRole)) return { ok: false, reason: 'validation.invalidRole' };
  if (
    target.role === 'admin' &&
    newRole !== 'admin' &&
    users.filter((u) => u.role === 'admin').length <= 1
  ) {
    return { ok: false, reason: 'users.lastAdmin' };
  }
  return { ok: true };
}
