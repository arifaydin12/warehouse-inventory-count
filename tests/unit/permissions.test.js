import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES, PERMISSIONS, can, permissionsFor, canAccessRoute, canDeleteUser, canChangeRole, ROUTE_PERMISSIONS,
} from '../../js/domain/permissions.js';

test('roles are admin, manager and operator', () => {
  assert.deepEqual(ROLES, ['admin', 'manager', 'operator']);
});

test('admin holds every permission', () => {
  for (const p of Object.keys(PERMISSIONS)) assert.ok(can('admin', p), p);
});

test('operators can count but cannot edit, review or administer', () => {
  assert.ok(can('operator', 'sessions.count'));
  assert.ok(can('operator', 'sessions.submit'));
  assert.ok(can('operator', 'products.view'));
  for (const p of ['products.edit', 'products.import', 'products.delete', 'sessions.create', 'sessions.review', 'sessions.cancel', 'audit.view', 'users.manage', 'data.reset', 'warehouses.edit']) {
    assert.ok(!can('operator', p), p);
  }
});

test('managers manage inventory and review counts but cannot manage users or reset data', () => {
  for (const p of ['products.edit', 'products.import', 'sessions.create', 'sessions.review', 'audit.view', 'warehouses.edit']) {
    assert.ok(can('manager', p), p);
  }
  for (const p of ['users.manage', 'data.reset', 'products.delete', 'warehouses.delete']) assert.ok(!can('manager', p), p);
});

test('unknown roles and permissions are denied', () => {
  assert.equal(can('guest', 'dashboard.view'), false);
  assert.equal(can('admin', 'nothing.here'), false);
  assert.equal(can(undefined, 'dashboard.view'), false);
});

test('permissionsFor lists only allowed permissions', () => {
  assert.ok(permissionsFor('operator').length < permissionsFor('manager').length);
  assert.ok(permissionsFor('manager').length < permissionsFor('admin').length);
  assert.ok(permissionsFor('operator').every((p) => can('operator', p)));
});

test('route access follows permissions', () => {
  assert.ok(canAccessRoute('operator', 'dashboard'));
  assert.ok(canAccessRoute('operator', 'sessions'));
  assert.ok(!canAccessRoute('operator', 'audit'));
  assert.ok(!canAccessRoute('operator', 'users'));
  assert.ok(canAccessRoute('manager', 'audit'));
  assert.ok(!canAccessRoute('manager', 'users'));
  assert.ok(canAccessRoute('admin', 'users'));
  assert.ok(!canAccessRoute('admin', 'unknown'));
  for (const perm of Object.values(ROUTE_PERMISSIONS)) assert.ok(PERMISSIONS[perm], perm);
});

const users = [
  { id: 'a', role: 'admin' },
  { id: 'b', role: 'manager' },
  { id: 'c', role: 'operator' },
];

test('users cannot delete themselves or the last admin', () => {
  assert.deepEqual(canDeleteUser(users, 'a', 'a'), { ok: false, reason: 'users.cannotDeleteSelf' });
  assert.deepEqual(canDeleteUser(users, 'a', 'b'), { ok: false, reason: 'users.lastAdmin' });
  assert.deepEqual(canDeleteUser(users, 'c', 'a'), { ok: true });
  assert.equal(canDeleteUser(users, 'zzz', 'a').ok, false);
  const twoAdmins = [...users, { id: 'd', role: 'admin' }];
  assert.deepEqual(canDeleteUser(twoAdmins, 'a', 'd'), { ok: true });
});

test('the last admin cannot be demoted', () => {
  assert.deepEqual(canChangeRole(users, 'a', 'operator'), { ok: false, reason: 'users.lastAdmin' });
  assert.deepEqual(canChangeRole(users, 'a', 'admin'), { ok: true });
  assert.deepEqual(canChangeRole(users, 'c', 'manager'), { ok: true });
  assert.equal(canChangeRole(users, 'c', 'root').ok, false);
});
