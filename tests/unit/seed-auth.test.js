import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed, DEMO_PIN, DATA_VERSION } from '../../js/core/seed.js';
import { hashPin, randomSalt, isLocked, registerFailure, initialLockout, remainingSeconds, MAX_ATTEMPTS, LOCK_MS } from '../../js/core/auth.js';
import { validateProduct } from '../../js/domain/validation.js';
import { isValidEan13 } from '../../js/domain/barcode.js';
import { summarize } from '../../js/domain/discrepancy.js';
import { canSubmit } from '../../js/domain/workflow.js';

const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();

test('seed data is internally consistent', async () => {
  const seed = await buildSeed(NOW);
  assert.equal(seed.version, DATA_VERSION);
  assert.deepEqual(seed.users.map((u) => u.role).sort(), ['admin', 'manager', 'operator']);
  assert.ok(seed.products.length >= 30);
  assert.equal(seed.warehouses.length, 3);

  const locationIds = new Set(seed.locations.map((l) => l.id));
  const warehouseIds = new Set(seed.warehouses.map((w) => w.id));
  assert.ok(seed.locations.every((l) => warehouseIds.has(l.warehouseId)));
  assert.equal(new Set(seed.locations.map((l) => l.code)).size, seed.locations.length, 'location codes are unique');

  for (const p of seed.products) {
    const others = seed.products.filter((x) => x.id !== p.id);
    const result = validateProduct({ ...p, expected: p.expected, unitCost: p.unitCost }, { products: others, locations: seed.locations });
    assert.equal(result.ok, true, `${p.sku}: ${JSON.stringify(result.errors)}`);
    assert.ok(isValidEan13(p.barcode), `${p.sku} has a valid EAN-13`);
    assert.ok(locationIds.has(p.locationId));
    assert.ok(p.i18n.de.name && p.i18n.pl.name, `${p.sku} is translated`);
  }
});

test('seed sessions cover the whole workflow with realistic data', async () => {
  const seed = await buildSeed(NOW);
  const byStatus = Object.fromEntries(seed.sessions.map((s) => [s.status, s]));
  assert.deepEqual(Object.keys(byStatus).sort(), ['approved', 'open', 'recount', 'submitted']);
  const productIds = new Set(seed.products.map((p) => p.id));
  for (const s of seed.sessions) {
    assert.ok(s.lines.length > 0);
    assert.ok(s.lines.every((l) => productIds.has(l.productId)));
    assert.ok(s.i18n.de.name && s.i18n.pl.name);
  }
  assert.equal(canSubmit(byStatus.submitted).ok, false, 'submitted sessions are no longer counting');
  const open = summarize(byStatus.open.lines);
  assert.ok(open.counted > 0 && open.uncounted > 0, 'open session is partially counted');
  const submitted = summarize(byStatus.submitted.lines);
  assert.equal(submitted.uncounted, 0);
  assert.ok(submitted.shortageLines + submitted.surplusLines > 0);
  const recount = byStatus.recount.lines.filter((l) => l.recount);
  assert.equal(recount.length, 2);
  assert.ok(recount.every((l) => l.counted === null && l.history.length === 1));
});

test('seed audit log is chronological and attributed to existing users', async () => {
  const seed = await buildSeed(NOW);
  const ids = new Set(seed.users.map((u) => u.id));
  assert.ok(seed.audit.length > 10);
  assert.ok(seed.audit.every((e) => ids.has(e.userId) && e.ts <= NOW));
  for (let i = 1; i < seed.audit.length; i++) assert.ok(seed.audit[i].ts >= seed.audit[i - 1].ts);
});

test('demo PINs verify and wrong PINs do not', async () => {
  const seed = await buildSeed(NOW);
  for (const u of seed.users) {
    assert.equal(await hashPin(DEMO_PIN, u.salt), u.pinHash);
    assert.notEqual(await hashPin('0000', u.salt), u.pinHash);
    assert.ok(!JSON.stringify(u).includes(`"${DEMO_PIN}"`), 'the PIN is not stored in clear text');
  }
});

test('hashPin is salted and salts are random', async () => {
  assert.notEqual(await hashPin('1234', 'a'), await hashPin('1234', 'b'));
  assert.equal(await hashPin('1234', 'a'), await hashPin('1234', 'a'));
  assert.notEqual(randomSalt(), randomSalt());
});

test('login throttling locks after repeated failures and recovers', () => {
  let state = initialLockout();
  const t0 = 1_000_000;
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    state = registerFailure(state, t0);
    assert.equal(isLocked(state, t0), false);
  }
  state = registerFailure(state, t0);
  assert.equal(isLocked(state, t0), true);
  assert.equal(remainingSeconds(state, t0), LOCK_MS / 1000);
  assert.equal(isLocked(state, t0 + LOCK_MS - 1), true);
  assert.equal(isLocked(state, t0 + LOCK_MS), false);
  const next = registerFailure(state, t0 + LOCK_MS + 5);
  assert.equal(next.failures, 1, 'a new series starts after the lock expires');
});
