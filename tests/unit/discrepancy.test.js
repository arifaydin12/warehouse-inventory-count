import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lineVariance, lineStatus, variancePercent, varianceValue, summarize, byCategory,
  findLineByCode, applyCount, countsPerDay, discrepantLines, isValidQuantity,
} from '../../js/domain/discrepancy.js';

const line = (over = {}) => ({
  productId: 'p1', sku: 'SKU-1', barcode: '5901234123457', name: 'Item', category: 'tools',
  unit: 'pcs', locationCode: 'A-01', expected: 10, unitCost: 2.5, counted: null, ...over,
});

test('variance is null until counted, then counted - expected', () => {
  assert.equal(lineVariance(line()), null);
  assert.equal(lineVariance(line({ counted: 7 })), -3);
  assert.equal(lineVariance(line({ counted: 10 })), 0);
  assert.equal(lineVariance(line({ counted: 12 })), 2);
});

test('line status covers all four outcomes', () => {
  assert.equal(lineStatus(line()), 'uncounted');
  assert.equal(lineStatus(line({ counted: 10 })), 'match');
  assert.equal(lineStatus(line({ counted: 9 })), 'shortage');
  assert.equal(lineStatus(line({ counted: 11 })), 'surplus');
  assert.equal(lineStatus(line({ counted: 0, expected: 0 })), 'match');
});

test('variance percent handles zero expected stock', () => {
  assert.equal(variancePercent(line({ counted: 5 })), -50);
  assert.equal(variancePercent(line({ expected: 0, counted: 0 })), 0);
  assert.equal(variancePercent(line({ expected: 0, counted: 3 })), null);
  assert.equal(variancePercent(line()), null);
});

test('variance value uses unit cost and rounds to cents', () => {
  assert.equal(varianceValue(line({ counted: 7 })), -7.5);
  assert.equal(varianceValue(line({ counted: 11, unitCost: 0.333 })), 0.33);
  assert.equal(varianceValue(line()), 0);
});

test('summarize aggregates lines, units, value, accuracy and progress', () => {
  const lines = [
    line({ productId: 'a', counted: 10 }),
    line({ productId: 'b', counted: 8 }),
    line({ productId: 'c', counted: 13 }),
    line({ productId: 'd' }),
  ];
  const s = summarize(lines);
  assert.equal(s.total, 4);
  assert.equal(s.counted, 3);
  assert.equal(s.uncounted, 1);
  assert.equal(s.matched, 1);
  assert.equal(s.shortageLines, 1);
  assert.equal(s.surplusLines, 1);
  assert.equal(s.shortageUnits, 2);
  assert.equal(s.surplusUnits, 3);
  assert.equal(s.netUnits, 1);
  assert.equal(s.shortageValue, 5);
  assert.equal(s.surplusValue, 7.5);
  assert.equal(s.netValue, 2.5);
  assert.equal(s.accuracy, 33.33);
  assert.equal(s.progress, 75);
});

test('summarize of an empty session is safe', () => {
  const s = summarize([]);
  assert.equal(s.accuracy, null);
  assert.equal(s.progress, 0);
  assert.equal(s.total, 0);
});

test('byCategory groups only counted lines and sorts by category', () => {
  const rows = byCategory([
    line({ category: 'tools', counted: 8 }),
    line({ category: 'office', counted: 12 }),
    line({ category: 'tools', counted: 10 }),
    line({ category: 'safety' }),
  ]);
  assert.deepEqual(rows.map((r) => r.category), ['office', 'tools']);
  assert.equal(rows[1].shortageUnits, 2);
  assert.equal(rows[1].matched, 1);
  assert.equal(rows[0].surplusUnits, 2);
});

test('findLineByCode matches barcode before SKU, ignores case and whitespace', () => {
  const lines = [line({ productId: 'a', sku: 'ABC-1', barcode: '111111' }), line({ productId: 'b', sku: '111111', barcode: '222222' })];
  assert.equal(findLineByCode(lines, ' 111111 ').productId, 'a');
  assert.equal(findLineByCode(lines, 'abc-1').productId, 'a');
  assert.equal(findLineByCode(lines, '222222').productId, 'b');
  assert.equal(findLineByCode(lines, 'nope'), null);
  assert.equal(findLineByCode(lines, ''), null);
  assert.equal(findLineByCode(lines, '111111', (l) => l.productId === 'b').productId, 'b');
});

test('applyCount supports add and set modes and validates input', () => {
  const l = line({ counted: 3 });
  assert.equal(applyCount(l, 2, 'add', { at: 1, by: 'u' }).counted, 5);
  assert.equal(applyCount(line(), 2, 'add').counted, 2);
  assert.equal(applyCount(l, 9, 'set').counted, 9);
  assert.equal(applyCount(l, 4, 'set', { at: 5, by: 'u1' }).countedBy, 'u1');
  assert.equal(l.counted, 3, 'input line is not mutated');
  assert.throws(() => applyCount(l, -1, 'add'), RangeError);
  assert.throws(() => applyCount(l, 1.5, 'set'), RangeError);
  assert.throws(() => applyCount(l, 1_000_001, 'set'), RangeError);
  assert.throws(() => applyCount(line({ counted: 999_999 }), 5, 'add'), RangeError);
  assert.throws(() => applyCount(l, 1, 'multiply'), TypeError);
});

test('isValidQuantity', () => {
  assert.ok(isValidQuantity(0));
  assert.ok(isValidQuantity(1_000_000));
  assert.ok(!isValidQuantity(-1));
  assert.ok(!isValidQuantity(2.5));
  assert.ok(!isValidQuantity(NaN));
});

test('discrepantLines returns only shortages and surpluses', () => {
  const lines = [line({ counted: 10 }), line({ counted: 1 }), line({ counted: 99 }), line()];
  assert.equal(discrepantLines(lines).length, 2);
});

test('countsPerDay buckets counted lines by local day', () => {
  const now = new Date(2026, 5, 15, 14, 0, 0).getTime();
  const day = 24 * 3600 * 1000;
  const sessions = [{ lines: [line({ countedAt: now }), line({ countedAt: now - 2 * day }), line({ countedAt: now - 40 * day }), line()] }];
  const out = countsPerDay(sessions, now, 7);
  assert.equal(out.length, 7);
  assert.equal(out[6].lines, 1);
  assert.equal(out[4].lines, 1);
  assert.equal(out.reduce((n, d) => n + d.lines, 0), 2);
});
