import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition, canSubmit, requestRecount, clearRecountFlags, isLineEditable, stockAdjustments,
  buildSessionLines, isCountingStatus, SESSION_STATUSES, TRANSITIONS,
} from '../../js/domain/workflow.js';

const L = (id, expected, counted = null, extra = {}) => ({
  productId: id, sku: id.toUpperCase(), barcode: '', name: id, category: 'tools', unit: 'pcs', locationCode: 'A',
  expected, unitCost: 1, counted, countedAt: counted === null ? null : 1000, countedBy: counted === null ? null : 'u1',
  recount: false, note: '', history: [], ...extra,
});

test('status transitions follow the documented workflow', () => {
  assert.ok(canTransition('open', 'submitted'));
  assert.ok(canTransition('submitted', 'approved'));
  assert.ok(canTransition('submitted', 'recount'));
  assert.ok(canTransition('recount', 'submitted'));
  assert.ok(canTransition('open', 'cancelled'));
  assert.ok(!canTransition('open', 'approved'), 'cannot skip review');
  assert.ok(!canTransition('approved', 'open'));
  assert.ok(!canTransition('cancelled', 'submitted'));
  assert.ok(!canTransition('nope', 'open'));
  assert.deepEqual(Object.keys(TRANSITIONS).sort(), [...SESSION_STATUSES].sort());
});

test('only open and recount sessions are counted', () => {
  assert.ok(isCountingStatus('open'));
  assert.ok(isCountingStatus('recount'));
  assert.ok(!isCountingStatus('submitted'));
  assert.ok(!isCountingStatus('approved'));
});

test('canSubmit requires every editable line to be counted', () => {
  const open = { status: 'open', lines: [L('a', 5, 5), L('b', 3)] };
  assert.deepEqual(canSubmit(open), { ok: false, remaining: 1, reason: 'sessions.error.uncounted' });
  open.lines[1] = L('b', 3, 2);
  assert.equal(canSubmit(open).ok, true);
  assert.equal(canSubmit({ status: 'submitted', lines: [] }).reason, 'sessions.error.notCounting');
  assert.equal(canSubmit({ status: 'open', lines: [] }).reason, 'sessions.error.empty');
});

test('during a recount only flagged lines are editable and required', () => {
  const session = { status: 'recount', lines: [L('a', 5, 5), L('b', 3, null, { recount: true })] };
  assert.equal(isLineEditable(session, session.lines[0]), false);
  assert.equal(isLineEditable(session, session.lines[1]), true);
  assert.equal(canSubmit(session).remaining, 1);
  session.lines[1] = L('b', 3, 3, { recount: true });
  assert.equal(canSubmit(session).ok, true);
  assert.equal(isLineEditable({ status: 'open' }, L('x', 1)), true);
  assert.equal(isLineEditable({ status: 'approved' }, L('x', 1)), false);
});

test('requestRecount resets selected lines, keeps history and clears other flags', () => {
  const lines = [L('a', 5, 4), L('b', 3, 3, { recount: true }), L('c', 2, 2)];
  const out = requestRecount(lines, ['a']);
  assert.equal(out[0].counted, null);
  assert.equal(out[0].recount, true);
  assert.deepEqual(out[0].history, [{ counted: 4, at: 1000, by: 'u1' }]);
  assert.equal(out[1].recount, false);
  assert.equal(out[1].counted, 3);
  assert.equal(out[2].counted, 2);
  assert.equal(lines[0].counted, 4, 'input is not mutated');
  assert.throws(() => requestRecount(lines, []));
  const again = requestRecount(out.map((l) => (l.productId === 'a' ? { ...l, counted: 6, countedAt: 2000 } : l)), ['a']);
  assert.equal(again[0].history.length, 2);
});

test('clearRecountFlags removes only the flag', () => {
  const out = clearRecountFlags([L('a', 1, 1, { recount: true }), L('b', 1, 1)]);
  assert.ok(out.every((l) => l.recount === false));
});

test('stockAdjustments lists only counted lines that differ', () => {
  const session = { lines: [L('a', 5, 4), L('b', 3, 3), L('c', 2), L('d', 1, 4)] };
  assert.deepEqual(stockAdjustments(session), [
    { productId: 'a', from: 5, to: 4 },
    { productId: 'd', from: 1, to: 4 },
  ]);
});

test('buildSessionLines snapshots products and can be scoped to locations', () => {
  const products = [
    { id: 'p1', sku: 'S1', barcode: '111', name: 'One', category: 'tools', unit: 'pcs', locationId: 'l1', expected: 4, unitCost: 2, i18n: { pl: { name: 'Jeden' } } },
    { id: 'p2', sku: 'S2', barcode: '', name: 'Two', category: 'office', unit: 'box', locationId: 'l2', expected: 0 },
  ];
  const locations = new Map([['l1', { code: 'A-01' }], ['l2', { code: 'B-01' }]]);
  const all = buildSessionLines(products, locations);
  assert.equal(all.length, 2);
  assert.equal(all[0].locationCode, 'A-01');
  assert.equal(all[0].counted, null);
  assert.equal(all[0].i18n.pl.name, 'Jeden');
  assert.notEqual(all[0].i18n, products[0].i18n, 'translations are copied');
  assert.equal(all[1].unitCost, 0);
  assert.equal(buildSessionLines(products, locations, ['l2']).length, 1);
  assert.equal(buildSessionLines(products, locations, ['missing']).length, 0);
});
