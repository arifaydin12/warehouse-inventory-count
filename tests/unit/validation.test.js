import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProduct, validateWarehouse, validateLocation, validateUser, validateSession, validateQuantity,
  parseIntegerStrict, parseDecimal,
} from '../../js/domain/validation.js';
import { ean13CheckDigit, isValidEan13, makeEan13, normalizeCode } from '../../js/domain/barcode.js';
import { resolveCategory } from '../../js/domain/categories.js';

const locations = [{ id: 'l1', warehouseId: 'w1', code: 'MAIN-A-01' }];
const products = [{ id: 'p1', sku: 'ABC-1', barcode: '1234', name: 'X', category: 'tools', unit: 'pcs', locationId: 'l1', expected: 1 }];
const good = { sku: 'NEW-1', barcode: '987654', name: 'Widget', category: 'tools', unit: 'pcs', locationId: 'l1', expected: '5', unitCost: '12,50' };

test('a valid product passes and values are normalised', () => {
  const r = validateProduct(good, { products, locations });
  assert.equal(r.ok, true);
  assert.equal(r.value.expected, 5);
  assert.equal(r.value.unitCost, 12.5);
});

test('product validation reports each invalid field with an i18n key', () => {
  const r = validateProduct({ sku: 'x', barcode: 'a b', name: '', category: '', unit: 'bag', locationId: 'nope', expected: '-3', unitCost: 'abc' }, { products, locations });
  assert.equal(r.ok, false);
  assert.equal(r.errors.sku.key, 'validation.skuFormat');
  assert.equal(r.errors.barcode.key, 'validation.barcodeFormat');
  assert.equal(r.errors.name.key, 'validation.required');
  assert.equal(r.errors.category.key, 'validation.required');
  assert.equal(r.errors.unit.key, 'validation.unitInvalid');
  assert.equal(r.errors.locationId.key, 'validation.locationInvalid');
  assert.equal(r.errors.expected.key, 'validation.integerNonNegative');
  assert.equal(r.errors.unitCost.key, 'validation.decimalNonNegative');
});

test('SKU and barcode must be unique, except for the product being edited', () => {
  assert.equal(validateProduct({ ...good, sku: 'abc-1' }, { products, locations }).errors.sku.key, 'validation.skuDuplicate');
  assert.equal(validateProduct({ ...good, barcode: '1234' }, { products, locations }).errors.barcode.key, 'validation.barcodeDuplicate');
  assert.equal(validateProduct({ ...good, sku: 'ABC-1', barcode: '1234' }, { products, locations, editingId: 'p1' }).ok, true);
});

test('quantities are capped and must be whole numbers', () => {
  assert.equal(validateProduct({ ...good, expected: '1000001' }, { products, locations }).errors.expected.key, 'validation.tooLarge');
  assert.equal(validateProduct({ ...good, expected: '1.5' }, { products, locations }).errors.expected.key, 'validation.integerNonNegative');
  assert.equal(validateProduct({ ...good, unitCost: '' }, { products, locations }).value.unitCost, 0);
});

test('parseIntegerStrict and parseDecimal', () => {
  assert.equal(parseIntegerStrict('42'), 42);
  assert.ok(Number.isNaN(parseIntegerStrict('')));
  assert.ok(Number.isNaN(parseIntegerStrict('4e2')));
  assert.ok(Number.isNaN(parseIntegerStrict(-1)));
  assert.equal(parseDecimal('3,5'), 3.5);
  assert.equal(parseDecimal('3.25'), 3.25);
  assert.ok(Number.isNaN(parseDecimal('-1')));
  assert.ok(Number.isNaN(parseDecimal('1.23456')));
});

test('warehouse and location codes are normalised and unique', () => {
  const warehouses = [{ id: 'w1', code: 'MAIN', name: 'Main' }];
  assert.equal(validateWarehouse({ name: 'Annex', code: 'annex' }, { warehouses }).value.code, 'ANNEX');
  assert.equal(validateWarehouse({ name: 'Dup', code: 'main' }, { warehouses }).errors.code.key, 'validation.codeDuplicate');
  assert.equal(validateWarehouse({ name: 'Main', code: 'MAIN' }, { warehouses, editingId: 'w1' }).ok, true);
  assert.equal(validateWarehouse({ name: 'A', code: '!' }, { warehouses }).ok, false);
  assert.equal(validateLocation({ code: 'main-a-01' }, { locations }).errors.code.key, 'validation.codeDuplicate');
  assert.equal(validateLocation({ code: 'main-a-02' }, { locations }).value.code, 'MAIN-A-02');
  assert.equal(validateLocation({ code: '' }, { locations }).errors.code.key, 'validation.required');
});

test('users need a name, a valid role and a 4-digit PIN', () => {
  const users = [{ id: 'u1', name: 'Anna Kowalska', role: 'admin' }];
  assert.equal(validateUser({ name: 'Tom Lee', role: 'operator', pin: '1234' }, { users }).ok, true);
  const bad = validateUser({ name: 'A', role: 'root', pin: '12' }, { users });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['name', 'pin', 'role']);
  assert.equal(validateUser({ name: 'anna kowalska', role: 'admin', pin: '1234' }, { users }).errors.name.key, 'validation.nameDuplicate');
  assert.equal(validateUser({ name: 'Anna Kowalska', role: 'admin', pin: '' }, { users, editingId: 'u1', requirePin: false }).ok, true);
  assert.equal(validateUser({ name: 'New', role: 'admin', pin: '' }, { users }).errors.pin.key, 'validation.pinFormat');
});

test('session and quantity validation', () => {
  const warehouses = [{ id: 'w1' }];
  assert.equal(validateSession({ name: 'Q1 count', warehouseId: 'w1' }, { warehouses }).ok, true);
  assert.equal(validateSession({ name: 'ab', warehouseId: 'zz' }, { warehouses }).ok, false);
  assert.equal(validateQuantity('12').value, 12);
  assert.equal(validateQuantity('').ok, false);
  assert.equal(validateQuantity('-1').ok, false);
  assert.equal(validateQuantity('2000000').error.key, 'validation.tooLarge');
});

test('EAN-13 helpers', () => {
  assert.equal(ean13CheckDigit('400638133393'), 1);
  assert.ok(isValidEan13('4006381333931'));
  assert.ok(!isValidEan13('4006381333932'));
  assert.ok(!isValidEan13('abc'));
  assert.equal(makeEan13('590123412345'), '5901234123457');
  assert.throws(() => ean13CheckDigit('123'));
  assert.equal(normalizeCode('  5901234123457\r\n'), '5901234123457');
  assert.equal(normalizeCode(null), '');
});

test('resolveCategory maps labels in any language to built-in ids', () => {
  const labels = { tools: ['Tools', 'Werkzeuge', 'Narzędzia'], office: ['Office supplies'] };
  assert.equal(resolveCategory('narzędzia', labels), 'tools');
  assert.equal(resolveCategory(' WERKZEUGE ', labels), 'tools');
  assert.equal(resolveCategory('tools', labels), 'tools');
  assert.equal(resolveCategory('Garden', labels), 'Garden');
});
