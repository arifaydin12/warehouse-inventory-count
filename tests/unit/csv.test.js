import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCSV, toCSV, detectDelimiter, escapeCell, parseProductsCSV, productsToCSV, sessionReportRows, SESSION_CSV_COLUMNS,
} from '../../js/domain/csv.js';

test('parseCSV handles quotes, escaped quotes, embedded delimiters and newlines', () => {
  const text = 'a,b,c\r\n1,"two, with comma","say ""hi"""\r\n"multi\nline",x,y\r\n';
  assert.deepEqual(parseCSV(text), [
    ['a', 'b', 'c'],
    ['1', 'two, with comma', 'say "hi"'],
    ['multi\nline', 'x', 'y'],
  ]);
});

test('parseCSV strips a BOM, skips blank lines and accepts LF / CR line endings', () => {
  assert.deepEqual(parseCSV('\ufeffa,b\n\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCSV('a,b\r1,2\r'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCSV(''), []);
});

test('detectDelimiter finds comma, semicolon and tab', () => {
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(detectDelimiter('"a;b",c,d\n'), ',');
  assert.deepEqual(parseCSV('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('toCSV escapes cells and round-trips through parseCSV', () => {
  const rows = [['name', 'note'], ['Cable, 1 m', 'He said "ok"'], ['Line\nbreak', ' padded '], [1.5, null]];
  const csv = toCSV(rows);
  assert.ok(csv.endsWith('\r\n'));
  assert.deepEqual(parseCSV(csv), [['name', 'note'], ['Cable, 1 m', 'He said "ok"'], ['Line\nbreak', ' padded '], ['1.5', '']]);
});

test('toCSV protects against spreadsheet formula injection but keeps numbers intact', () => {
  assert.equal(escapeCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(escapeCell('+1'), "'+1");
  assert.equal(escapeCell('@cmd'), "'@cmd");
  assert.equal(escapeCell(-5), '-5');
  assert.equal(escapeCell('=1', { guardFormulas: false }), '=1');
  assert.equal(toCSV([['x']], { bom: true }).charCodeAt(0), 0xfeff);
  assert.equal(toCSV([['a', 'b']], { delimiter: ';' }), 'a;b\r\n');
});

const locations = [{ id: 'l1', warehouseId: 'w', code: 'MAIN-A-01' }, { id: 'l2', warehouseId: 'w', code: 'MAIN-B-01' }];
const products = [{ id: 'p1', sku: 'ABC-1', barcode: '1111', name: 'Old', category: 'tools', unit: 'pcs', locationId: 'l1', expected: 5, unitCost: 1 }];

test('parseProductsCSV validates rows and distinguishes create / update / invalid', () => {
  const csv = [
    'sku,barcode,name,category,unit,location,expected,unit_cost',
    'ABC-1,1111,Updated name,tools,pcs,MAIN-B-01,9,2.50',
    'NEW-1,2222,New item,office,box,main-a-01,3,"1,5"',
    'BAD,,,,,NOPE,-1,x',
    'NEW-1,3333,Duplicate in file,office,pcs,MAIN-A-01,1,',
    'NEW-2,2222,Barcode clash,office,pcs,MAIN-A-01,1,',
  ].join('\n');
  const result = parseProductsCSV(csv, { products, locations });
  assert.equal(result.fatal, null);
  assert.deepEqual(result.rows.map((r) => r.action), ['update', 'create', 'invalid', 'invalid', 'invalid']);
  assert.deepEqual(result.counts, { create: 1, update: 1, invalid: 3 });
  assert.equal(result.rows[0].existingId, 'p1');
  assert.equal(result.rows[0].value.locationId, 'l2');
  assert.equal(result.rows[1].value.unitCost, 1.5);
  assert.equal(result.rows[1].value.locationId, 'l1');
  assert.ok(result.rows[2].errors.location);
  assert.ok(result.rows[2].errors.expected);
  assert.equal(result.rows[3].errors.sku.key, 'csv.duplicateInFile');
  assert.equal(result.rows[4].errors.barcode.key, 'validation.barcodeDuplicate');
});

test('parseProductsCSV reports structural problems', () => {
  assert.equal(parseProductsCSV('', { products, locations }).fatal.key, 'csv.empty');
  const missing = parseProductsCSV('sku,name\nA,B', { products, locations });
  assert.equal(missing.fatal.key, 'csv.missingColumns');
  assert.match(missing.fatal.params.columns, /category/);
  assert.equal(parseProductsCSV('sku,name,category,unit,location,expected\n', { products, locations }).fatal.key, 'csv.noRows');
});

test('parseProductsCSV accepts header aliases, semicolons and a category normaliser', () => {
  const csv = 'SKU;EAN;Name;Category;Unit;Location;Stock\nX-1;4006381333931;Thing;Werkzeuge;PCS;MAIN-A-01;4';
  const result = parseProductsCSV(csv, { products: [], locations, normalizeCategory: (c) => (c === 'Werkzeuge' ? 'tools' : c) });
  assert.equal(result.counts.create, 1);
  assert.equal(result.rows[0].value.category, 'tools');
  assert.equal(result.rows[0].value.unit, 'pcs');
  assert.equal(result.rows[0].value.barcode, '4006381333931');
});

test('productsToCSV exports a file that parseProductsCSV can read back', () => {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const csv = productsToCSV(products, byId);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const back = parseProductsCSV(csv, { products: [], locations });
  assert.equal(back.counts.create, 1);
  assert.equal(back.rows[0].value.sku, 'ABC-1');
  assert.equal(back.rows[0].value.expected, 5);
});

test('sessionReportRows exports counts with variance columns', () => {
  const session = {
    lines: [
      { sku: 'A', barcode: '1', name: 'Alpha', category: 'tools', locationCode: 'L1', unit: 'pcs', expected: 10, counted: 8, unitCost: 2, countedBy: 'u1', countedAt: Date.UTC(2026, 0, 2), recount: false },
      { sku: 'B', barcode: '2', name: 'Beta', category: 'tools', locationCode: 'L1', unit: 'pcs', expected: 4, counted: null, unitCost: 1, recount: true },
    ],
  };
  const rows = sessionReportRows(session, { userName: () => 'Alice' });
  assert.deepEqual(rows[0], SESSION_CSV_COLUMNS);
  assert.deepEqual(rows[1].slice(6, 12), [10, 8, -2, -20, -4, 'shortage']);
  assert.equal(rows[1][13], 'Alice');
  assert.equal(rows[1][14], '2026-01-02T00:00:00.000Z');
  assert.deepEqual(rows[2].slice(7, 12), ['', '', '', '', 'uncounted']);
  assert.equal(rows[2][12], 'yes');
});
