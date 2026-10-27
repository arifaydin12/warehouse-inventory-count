/* End-to-end check in a real browser (optional; not part of `npm test`).
 *
 *   npm start                      # in another terminal (serves http://localhost:8080/)
 *   node tests/e2e/run.cjs
 *
 * Environment:
 *   E2E_URL            app URL (default http://localhost:8080/)
 *   E2E_SUBPATH_URL    optional second URL serving the app under a sub-path, e.g.
 *                      http://localhost:8081/warehouse-inventory-count/ (checks the service-worker scope)
 *   PUPPETEER_CORE     module path for puppeteer-core (default "puppeteer-core")
 *   BROWSER_PATH       Chrome/Edge executable (required)
 *   SCREENSHOT_DIR     if set, README screenshots are written there
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const URL_BASE = process.env.E2E_URL || 'http://localhost:8080/';
const SUBPATH_URL = process.env.E2E_SUBPATH_URL || '';
const SHOTS = process.env.SCREENSHOT_DIR || '';
const PIN = '1234';

const results = [];
const problems = [];
const step = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ok   ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  assert.ok(process.env.BROWSER_PATH, 'Set BROWSER_PATH to a Chrome or Edge executable');
  return puppeteer.launch({ executablePath: process.env.BROWSER_PATH, headless: true, args: ['--no-sandbox'] });
}

function watch(page) {
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) problems.push(`console.${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    if (!r.url().startsWith('blob:')) problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
  });
}

const text = (page, selector) => page.$eval(selector, (el) => el.textContent.trim());
const exists = async (page, selector) => Boolean(await page.$(selector));

async function clickText(page, selector, label, root = 'body') {
  const ok = await page.evaluate(
    (sel, lbl, rootSel) => {
      const el = [...document.querySelector(rootSel).querySelectorAll(sel)].find((n) => n.textContent.trim().includes(lbl) && !n.disabled);
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    label,
    root,
  );
  assert.ok(ok, `no enabled ${selector} containing "${label}"`);
}

async function login(page, name) {
  await page.goto(URL_BASE, { waitUntil: 'networkidle0' });
  if (await exists(page, '.topbar')) {
    await page.click('button[aria-label="Sign out"]');
    await page.waitForSelector('.login-card');
  }
  await page.waitForSelector('.login-card');
  await clickText(page, '.user-option', name);
  await page.type('#pin', PIN);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.topbar');
}

async function go(page, hash) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForSelector('#page-title');
  await sleep(150);
}

async function readData(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('wic.data.v1')));
}

async function dialogSubmit(page) {
  await page.click('dialog[open] button[type="submit"]');
}

async function waitDialogClosed(page) {
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
}

async function confirmDialog(page, label) {
  await page.waitForSelector('dialog[open]');
  await clickText(page, 'dialog[open] .btn', label);
  await waitDialogClosed(page);
}

async function fillField(page, name, value) {
  const sel = `dialog[open] [name="${name}"]`;
  await page.$eval(sel, (el) => { el.value = ''; });
  if (value !== '') await page.type(sel, String(value));
}

async function waitForDownload(dir, ext, before = new Set()) {
  for (let i = 0; i < 80; i++) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(ext) && !before.has(f));
    if (files.length) return path.join(dir, files[0]);
    await sleep(250);
  }
  throw new Error(`no ${ext} download appeared`);
}

async function scan(page, code, { qty, mode } = {}) {
  if (qty !== undefined) {
    await page.$eval('#scan-qty', (el) => { el.value = ''; });
    await page.type('#scan-qty', String(qty));
  }
  if (mode) await page.click(`input[name="scan-mode"][value="${mode}"]`);
  await page.$eval('#scan-input', (el) => { el.value = ''; el.focus(); });
  await page.type('#scan-input', code);
  await page.keyboard.press('Enter');
  await sleep(120);
  return text(page, '#scan-feedback');
}

(async () => {
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'wic-e2e-'));
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  watch(page);
  const cdp = await browser.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });

  console.log(`E2E against ${URL_BASE}`);

  await step('first load shows the login screen in English with the demo notice', async () => {
    await page.goto(URL_BASE, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.login-card');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.match(await text(page, '.demo-notice'), /Demo mode: data stays in your browser/);
    const options = await page.$$eval('#lang-select option', (o) => o.map((x) => x.value));
    assert.deepEqual(options, ['en', 'de', 'pl']);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'login.png') });
  });

  await step('wrong PIN is rejected, then each role can sign in and sees the right navigation', async () => {
    await page.goto(URL_BASE, { waitUntil: 'networkidle0' });
    await page.type('#pin', '9999');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#login-error:not([hidden])');
    assert.match(await text(page, '#login-error'), /Wrong PIN/);
    const expected = {
      'Anna Kowalska': ['Dashboard', 'Counting sessions', 'Products', 'Warehouses', 'Activity log', 'Users'],
      'Marek Nowak': ['Dashboard', 'Counting sessions', 'Products', 'Warehouses', 'Activity log'],
      'Piotr Zieliński': ['Dashboard', 'Counting sessions', 'Products', 'Warehouses'],
    };
    for (const [name, nav] of Object.entries(expected)) {
      await login(page, name);
      const links = await page.$$eval('.nav-link', (a) => a.map((x) => x.textContent.trim()));
      assert.deepEqual(links, nav, name);
    }
  });

  await step('operator is blocked from admin routes', async () => {
    await login(page, 'Piotr');
    await go(page, '#/users');
    await page.waitForFunction(() => location.hash === '#/dashboard');
    assert.ok(!(await exists(page, '[data-route="users"]')));
    await go(page, '#/products');
    assert.ok(!(await exists(page, '.page-actions .btn-primary')), 'operator has no "Add product" button');
  });

  await step('admin creates a product with validation feedback', async () => {
    await login(page, 'Anna');
    await go(page, '#/products');
    await clickText(page, '.page-actions .btn', 'Add product');
    await page.waitForSelector('dialog[open] form');
    await dialogSubmit(page);
    await page.waitForSelector('dialog[open] .field-error:not([hidden])');
    const errors = await page.$$eval('dialog[open] .field-error:not([hidden])', (e) => e.map((x) => x.textContent));
    assert.ok(errors.length >= 3, 'required-field errors shown');
    await fillField(page, 'sku', 'ELE-1001');
    await fillField(page, 'name', 'E2E Test Gadget');
    await fillField(page, 'category', 'Electronics');
    await page.select('dialog[open] [name="locationId"]', 'l-STORE-C-01');
    await fillField(page, 'expected', '12');
    await fillField(page, 'unitCost', '4,50');
    await dialogSubmit(page);
    await page.waitForFunction(() => document.querySelector('dialog[open] .field-error:not([hidden])')?.textContent.includes('already exists'));
    await fillField(page, 'sku', 'E2E-0001');
    await fillField(page, 'barcode', '4006381333931');
    await dialogSubmit(page);
    await waitDialogClosed(page);
    const data = await readData(page);
    const product = data.products.find((p) => p.sku === 'E2E-0001');
    assert.ok(product, 'product stored');
    assert.equal(product.category, 'electronics');
    assert.equal(product.unitCost, 4.5);
    await page.type('.search-input', 'E2E-0001');
    await page.waitForFunction(() => document.querySelectorAll('.table tbody tr').length === 1);
  });

  await step('products: search, filter, sort and pagination work', async () => {
    await go(page, '#/products');
    await page.type('.search-input', 'cable');
    await page.waitForFunction(() => document.querySelectorAll('.table tbody tr').length === 1);
    await page.$eval('.search-input', (el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => document.querySelectorAll('.table tbody tr').length === 10);
    assert.match(await text(page, '.table-info'), /Showing 1–10 of 40/);
    await page.click('.pager button[aria-label="Next page"]');
    assert.match(await text(page, '.table-info'), /Showing 11–20 of 40/);
    await page.select('.table-toolbar select:nth-of-type(1)', 'safety');
    await page.waitForFunction(() => document.querySelectorAll('.table tbody tr').length === 6);
    await clickText(page, '.sort-btn', 'Expected stock');
    const first = await page.$eval('.table tbody tr td.num', (el) => el.textContent.trim());
    assert.equal(first, '16');
  });

  await step('products: CSV export and CSV import (preview, errors, apply)', async () => {
    await go(page, '#/dashboard');
    await go(page, '#/products'); // fresh table without the previous filters
    const before = new Set(fs.readdirSync(downloads));
    await clickText(page, '.page-actions .btn', 'Export CSV');
    const csvFile = await waitForDownload(downloads, '.csv', before);
    const csv = fs.readFileSync(csvFile, 'utf8');
    assert.ok(csv.startsWith('\ufeffsku,barcode,name'), 'BOM + header');
    assert.equal(csv.trim().split('\r\n').length, 41);

    const importFile = path.join(downloads, 'import.csv');
    fs.writeFileSync(importFile, [
      'sku,barcode,name,category,unit,location,expected,unit_cost',
      'IMP-0001,5900000000011,Imported gloves,safety,pcs,DC-S-01,40,1.20',
      'ELE-1001,,USB-C cable 2 m,electronics,pcs,MAIN-A-01,260,4.50',
      'IMP-0002,,Broken row,safety,pcs,NOWHERE,-4,',
    ].join('\n'));
    await clickText(page, '.page-actions .btn', 'Import CSV');
    await page.waitForSelector('dialog[open] #import-file');
    await (await page.$('#import-file')).uploadFile(importFile);
    await page.waitForSelector('dialog[open] .import-table');
    assert.match(await text(page, 'dialog[open] .import p[aria-live]'), /1 to add, 1 to update, 1 with errors/);
    assert.match(await text(page, 'dialog[open] .error-list'), /Unknown location/);
    await clickText(page, 'dialog[open] .btn', 'Import 2 rows');
    await waitDialogClosed(page);
    const data = await readData(page);
    assert.ok(data.products.some((p) => p.sku === 'IMP-0001'));
    assert.equal(data.products.find((p) => p.sku === 'ELE-1001').name, 'USB-C cable 2 m');
    assert.ok(!data.products.some((p) => p.sku === 'IMP-0002'));
  });

  await step('warehouses: add a location and block deletion of a used one', async () => {
    await go(page, '#/warehouses');
    await clickText(page, '.warehouse-card .btn', 'Manage locations');
    await page.waitForSelector('dialog[open] #new-location');
    await page.type('#new-location', 'main-z-99');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('dialog[open] .location-list')?.textContent.includes('MAIN-Z-99'));
    await page.click('dialog[open] button[aria-label="Delete: MAIN-A-01"]');
    await page.waitForSelector('.toast-error');
    await page.click('dialog[open] button[aria-label="Close"]');
    await waitDialogClosed(page);
  });

  let sessionId;
  await step('manager creates a counting session', async () => {
    await login(page, 'Marek');
    await go(page, '#/sessions');
    await clickText(page, '.page-actions .btn', 'New session');
    await page.waitForSelector('dialog[open] form');
    await dialogSubmit(page);
    await page.waitForSelector('dialog[open] .field-error:not([hidden])');
    await fillField(page, 'name', 'E2E store count');
    await page.select('dialog[open] [name="warehouseId"]', 'w-store');
    await dialogSubmit(page);
    await page.waitForFunction(() => location.hash.startsWith('#/sessions/s-'));
    sessionId = await page.evaluate(() => decodeURIComponent(location.hash.split('/')[2]));
    await page.waitForSelector('#scan-input');
    assert.match(await text(page, '#page-title'), /E2E store count/);
    const data = await readData(page);
    const session = data.sessions.find((s) => s.id === sessionId);
    assert.equal(session.lines.length, 11, '10 seeded + 1 new product in STORE');
  });

  let barcodes;
  await step('operator counts with the barcode input (add, set, unknown code, undo, zero remaining) and submits', async () => {
    const data = await readData(page);
    barcodes = data.sessions.find((s) => s.id === sessionId).lines.map((l) => ({ sku: l.sku, barcode: l.barcode, expected: l.expected }));
    await login(page, 'Piotr');
    await go(page, '#/sessions');
    await clickText(page, '.table a', 'E2E store count');
    await page.waitForSelector('#scan-input');
    assert.ok(await page.$eval('#scan-input', (el) => el === document.activeElement), 'scan input is focused');

    const a = barcodes.find((b) => b.sku === 'OFF-4001');
    const b = barcodes.find((x) => x.sku === 'OFF-4002');
    const c = barcodes.find((x) => x.sku === 'CLE-6001');
    const d = barcodes.find((x) => x.sku === 'OFF-4003');
    assert.match(await scan(page, a.barcode, { qty: 1, mode: 'add' }), /OFF-4001.*counted 1 /);
    assert.match(await scan(page, a.barcode), /counted 2 /);
    assert.match(await scan(page, b.sku.toLowerCase(), { qty: a.expected > 0 ? b.expected - 2 : 0, mode: 'set' }), new RegExp(`counted ${b.expected - 2} `));
    assert.match(await scan(page, 'DOES-NOT-EXIST'), /No item with code “DOES-NOT-EXIST”/);
    assert.match(await scan(page, c.barcode, { qty: 3, mode: 'add' }), /CLE-6001/);
    await clickText(page, '.scan-buttons .btn', 'Undo last');
    assert.match(await text(page, '#scan-feedback'), /Reverted CLE-6001/);
    let state = (await readData(page)).sessions.find((s) => s.id === sessionId).lines;
    assert.equal(state.find((l) => l.sku === 'CLE-6001').counted, null, 'undo restored the uncounted state');
    assert.equal(state.find((l) => l.sku === 'OFF-4001').counted, 2);

    assert.match(await scan(page, d.barcode, { qty: d.expected, mode: 'set' }), /OFF-4003/);

    // Inline edit in the table
    const input = await page.$('input[aria-label="Counted: CLE-6001"]');
    await input.click({ clickCount: 3 });
    await input.type(String(c.expected - 4));
    await page.keyboard.press('Tab');
    await sleep(200);
    state = (await readData(page)).sessions.find((s) => s.id === sessionId).lines;
    assert.equal(state.find((l) => l.sku === 'CLE-6001').counted, c.expected - 4);

    // Submit is blocked until everything is counted
    assert.ok(await page.$eval('.page-actions .btn-primary', (el) => el.disabled), 'submit disabled while items are uncounted');
    await clickText(page, '.scan-panel .btn', 'Mark remaining as zero');
    await confirmDialog(page, 'Confirm');
    await page.waitForFunction(() => !document.querySelector('.page-actions .btn-primary').disabled);
    await clickText(page, '.page-actions .btn', 'Submit for review');
    await confirmDialog(page, 'Submit for review');
    await page.waitForFunction(() => document.querySelector('.meta-row .badge')?.textContent === 'Awaiting review');
    assert.ok(!(await exists(page, '.scan-panel')), 'no counting panel after submission');
    assert.ok(!(await exists(page, '.page-actions .btn-primary')), 'operator cannot approve');
    assert.match(await text(page, '.alert-info'), /waiting for review/);
  });

  await step('manager requests a recount, operator recounts, manager approves and stock is updated', async () => {
    await login(page, 'Marek');
    await go(page, `#/sessions/${sessionId}`);
    await page.waitForSelector('.table .check-col input');
    await clickText(page, '.toolbar-extra .btn', 'Select all discrepancies');
    const selected = await page.$$eval('.table .check-col input:checked', (x) => x.length);
    assert.ok(selected >= 2, `discrepancies selected (${selected})`);
    await clickText(page, '.page-actions .btn', 'Request recount');
    await page.waitForSelector('dialog[open] textarea');
    await page.type('dialog[open] textarea', 'Check the shelf again');
    await clickText(page, 'dialog[open] .btn-primary', 'Request recount');
    await waitDialogClosed(page);
    await page.waitForFunction(() => document.querySelector('.meta-row .badge')?.textContent === 'Recount');
    assert.match(await text(page, '.alert-warn'), /must be recounted/);
    assert.match(await text(page, '.alert-warn'), /Check the shelf again/);

    await login(page, 'Piotr');
    await go(page, `#/sessions/${sessionId}`);
    await page.waitForSelector('#scan-input');
    assert.match(await text(page, '.scan-panel'), /only the flagged items/);
    const flagged = (await readData(page)).sessions.find((s) => s.id === sessionId).lines.filter((l) => l.recount);
    const locked = (await readData(page)).sessions.find((s) => s.id === sessionId).lines.find((l) => !l.recount);
    assert.match(await scan(page, locked.barcode), /not part of the current recount/);
    for (const line of flagged) {
      assert.match(await scan(page, line.barcode, { qty: line.expected, mode: 'set' }), /counted/);
    }
    await clickText(page, '.page-actions .btn', 'Submit for review');
    await confirmDialog(page, 'Submit for review');
    await page.waitForFunction(() => document.querySelector('.meta-row .badge')?.textContent === 'Awaiting review');

    await login(page, 'Marek');
    await go(page, `#/sessions/${sessionId}`);
    await clickText(page, '.page-actions .btn', 'Approve');
    await confirmDialog(page, 'Approve');
    await page.waitForFunction(() => document.querySelector('.meta-row .badge')?.textContent === 'Approved');
    assert.match(await text(page, '.alert-success'), /Approved by Marek Nowak/);
    const data = await readData(page);
    const session = data.sessions.find((s) => s.id === sessionId);
    for (const line of session.lines) {
      assert.equal(data.products.find((p) => p.id === line.productId).expected, line.counted, `${line.sku} stock updated`);
    }
    assert.ok(data.audit.some((e) => e.action === 'session.recount' && e.entityId === sessionId));
    assert.ok(data.audit.some((e) => e.action === 'session.approve' && e.entityId === sessionId));
  });

  await step('report: PDF and CSV downloads of the approved session', async () => {
    const before = new Set(fs.readdirSync(downloads));
    await clickText(page, '.page-actions .btn', 'PDF report');
    const pdf = await waitForDownload(downloads, '.pdf', before);
    await sleep(500);
    const buf = fs.readFileSync(pdf);
    assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(buf.length > 8000, `pdf size ${buf.length}`);
    assert.match(path.basename(pdf), /^count-report-e2e-store-count\.pdf$/);

    const beforeCsv = new Set(fs.readdirSync(downloads));
    await clickText(page, '.page-actions .btn', 'Export CSV');
    const csv = await waitForDownload(downloads, '.csv', beforeCsv);
    const content = fs.readFileSync(csv, 'utf8');
    assert.ok(content.includes('sku,barcode,name,category,location,unit,expected,counted,variance'));
    assert.equal(content.trim().split('\r\n').length, 12);
    fs.copyFileSync(pdf, path.join(downloads, 'last-report.pdf'));
  });

  await step('dashboard shows KPIs and real charts; dark mode toggles', async () => {
    await go(page, '#/dashboard');
    await page.waitForSelector('.chart-holder svg rect');
    assert.ok((await page.$$('.kpi')).length >= 5);
    assert.ok((await page.$$('svg.chart rect')).length > 10);
    assert.ok((await page.$$('svg.chart-donut circle.seg')).length >= 2);
    await page.click('#theme-toggle');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    await page.click('#theme-toggle');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  });

  await step('language switcher translates the UI (de, pl) and persists across reloads', async () => {
    await go(page, '#/dashboard');
    await page.select('#lang-select', 'de');
    await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Übersicht');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'de');
    assert.match(await text(page, '.demo-banner'), /Demo-Modus/);
    await go(page, '#/products');
    assert.equal(await text(page, '#page-title'), 'Produkte');
    await page.select('#lang-select', 'pl');
    await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Produkty');
    assert.match(await text(page, '.demo-banner'), /Tryb demonstracyjny/);
    await go(page, '#/sessions');
    assert.equal(await text(page, '#page-title'), 'Sesje liczenia');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#page-title');
    assert.equal(await text(page, '#page-title'), 'Sesje liczenia');
    // No untranslated keys or "undefined" anywhere in the rendered text
    for (const route of ['dashboard', 'sessions', 'products', 'warehouses', 'audit', 'users']) {
      await go(page, `#/${route}`);
      const body = await page.evaluate(() => document.body.innerText);
      assert.ok(!/\b(undefined|NaN|\[object)\b/.test(body), `${route}: broken text`);
    }
    await page.select('#lang-select', 'en');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
  });

  await step('PDF report is generated in Polish with diacritics', async () => {
    await page.select('#lang-select', 'pl');
    try {
      await go(page, `#/sessions/${sessionId}`);
      for (const f of fs.readdirSync(downloads).filter((n) => n.endsWith('.pdf') && n.startsWith('count-report'))) fs.rmSync(path.join(downloads, f));
      const before = new Set(fs.readdirSync(downloads));
      await clickText(page, '.page-actions .btn', 'Raport PDF');
      const pdf = await waitForDownload(downloads, '.pdf', before);
      await sleep(500);
      assert.equal(fs.readFileSync(pdf).subarray(0, 5).toString(), '%PDF-');
      fs.copyFileSync(pdf, path.join(downloads, 'last-report-pl.pdf'));
    } finally {
      await page.select('#lang-select', 'en');
    }
  });

  await step('activity log shows who did what', async () => {
    await login(page, 'Anna');
    await go(page, '#/audit');
    await page.type('.search-input', 'E2E store count');
    await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('.table tbody tr')];
      return rows.length >= 5 && rows.every((r) => r.textContent.includes('E2E store count'));
    });
    const rows = await page.$$eval('.table tbody tr', (r) => r.map((x) => x.textContent));
    assert.ok(rows.some((r) => r.includes('approved session')));
    assert.ok(rows.some((r) => r.includes('requested a recount')));
  });

  await step('admin manages users: create, validate PIN, last-admin protection, delete', async () => {
    await go(page, '#/users');
    await clickText(page, '.page-actions .btn', 'Add user');
    await page.waitForSelector('dialog[open] form');
    await fillField(page, 'name', 'Test Operator');
    await fillField(page, 'pin', '12');
    await dialogSubmit(page);
    await page.waitForFunction(() => document.querySelector('dialog[open] .field-error:not([hidden])')?.textContent.includes('4 digits'));
    await fillField(page, 'pin', '4321');
    await dialogSubmit(page);
    await waitDialogClosed(page);
    await page.waitForFunction(() => document.body.innerText.includes('Test Operator'));
    await page.click('button[aria-label="Delete: Anna Kowalska"]');
    await confirmDialog(page, 'Delete');
    await page.waitForSelector('.toast-error');
    assert.match(await text(page, '.toast-error'), /cannot delete your own account/);
    await page.click('button[aria-label="Delete: Test Operator"]');
    await confirmDialog(page, 'Delete');
    await page.waitForFunction(() => !document.body.innerText.includes('Test Operator'));
  });

  await step('reset demo data restores the original data', async () => {
    await clickText(page, '.demo-banner .btn', 'Reset demo data');
    await confirmDialog(page, 'Reset demo data');
    await page.waitForFunction(() => document.querySelector('.toast-success'));
    const data = await readData(page);
    assert.equal(data.products.length, 39);
    assert.equal(data.sessions.length, 4);
    assert.ok(!data.products.some((p) => p.sku === 'E2E-0001'));
  });

  await step('responsive: no horizontal overflow from 360px to 1920px on every page', async () => {
    const issues = [];
    for (const [w, h] of [[360, 740], [768, 1024], [1280, 800], [1920, 1080]]) {
      await page.setViewport({ width: w, height: h });
      for (const hash of ['dashboard', 'sessions', 'sessions/s-002', 'products', 'warehouses', 'audit', 'users']) {
        await go(page, `#/${hash}`);
        await sleep(250);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) issues.push(`${w}px #/${hash}: +${overflow}px`);
      }
    }
    await page.setViewport({ width: 1440, height: 900 });
    assert.deepEqual(issues, []);
  });

  await step('mobile navigation drawer opens and closes', async () => {
    await page.setViewport({ width: 360, height: 740 });
    await go(page, '#/dashboard');
    await page.click('#menu-btn');
    assert.equal(await page.$eval('#menu-btn', (el) => el.getAttribute('aria-expanded')), 'true');
    await sleep(300);
    await clickText(page, '.nav-link', 'Products');
    await page.waitForFunction(() => location.hash === '#/products');
    assert.equal(await page.$eval('#menu-btn', (el) => el.getAttribute('aria-expanded')), 'false');
    await page.setViewport({ width: 1440, height: 900 });
  });

  await step('accessibility basics: names for controls, landmarks, one h1', async () => {
    for (const hash of ['dashboard', 'sessions/s-003', 'products', 'warehouses', 'audit', 'users']) {
      await go(page, `#/${hash}`);
      const report = await page.evaluate(() => {
        const unnamed = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter((el) => {
          if (el.closest('[hidden]')) return false;
          const label = el.getAttribute('aria-label') || el.textContent.trim() || (el.labels && el.labels[0]?.textContent.trim()) || el.getAttribute('title') || el.closest('label')?.textContent.trim();
          return !label;
        }).map((el) => el.outerHTML.slice(0, 80));
        return { unnamed, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length, nav: document.querySelectorAll('nav[aria-label]').length };
      });
      assert.deepEqual(report.unnamed, [], hash);
      assert.equal(report.h1, 1, hash);
      assert.equal(report.main, 1, hash);
      assert.equal(report.nav, 1, hash);
    }
  });

  if (SHOTS) {
    await step('screenshots', async () => {
      await login(page, 'Marek');
      await go(page, '#/dashboard');
      await page.waitForSelector('.chart-holder svg rect');
      await sleep(600);
      await page.screenshot({ path: path.join(SHOTS, 'screenshot.png') });
      await go(page, '#/sessions/s-002');
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, 'report.png') });
      await go(page, '#/sessions/s-003');
      await page.waitForSelector('#scan-input');
      const data = await readData(page);
      const s3 = data.sessions.find((s) => s.id === 's-003');
      const next = s3.lines.find((l) => l.counted === null);
      await scan(page, next.barcode, { qty: 4, mode: 'add' });
      await sleep(400);
      await page.screenshot({ path: path.join(SHOTS, 'counting.png') });
    });
  }

  await step('camera scanning: BarcodeDetector (stubbed) counts a detected barcode', async () => {
    const cam = await browser.newPage();
    watch(cam);
    await cam.setViewport({ width: 1440, height: 900 });
    await cam.evaluateOnNewDocument(() => {
      window.__detections = [];
      window.BarcodeDetector = class {
        static async getSupportedFormats() { return ['ean_13', 'code_128']; }
        async detect() { return window.__detections.length ? [{ rawValue: window.__detections.shift() }] : []; }
      };
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        setInterval(() => { ctx.fillStyle = `hsl(${Math.random() * 360}, 60%, 50%)`; ctx.fillRect(0, 0, 64, 48); }, 40);
        return canvas.captureStream(20);
      };
    });
    await login(cam, 'Piotr');
    await go(cam, '#/sessions/s-003');
    await cam.waitForSelector('#scan-input');
    const data = await readData(cam);
    const target = data.sessions.find((s) => s.id === 's-003').lines.find((l) => l.counted === null);
    await clickText(cam, '.scan-buttons .btn', 'Scan with camera');
    await cam.waitForSelector('dialog[open] video');
    await cam.waitForFunction(() => document.querySelector('dialog[open] .camera p')?.textContent.includes('Point the camera'));
    await cam.evaluate((code) => window.__detections.push(code), target.barcode);
    await cam.waitForFunction((sku) => {
      const d = JSON.parse(localStorage.getItem('wic.data.v1'));
      return d.sessions.find((s) => s.id === 's-003').lines.find((l) => l.sku === sku).counted === 1;
    }, { timeout: 8000 }, target.sku);
    await cam.click('dialog[open] button[aria-label="Close"]');
    await waitDialogClosed(cam);
    await cam.close();
  });

  await step('camera button is hidden when BarcodeDetector is unavailable', async () => {
    const plain = await browser.newPage();
    watch(plain);
    await plain.evaluateOnNewDocument(() => { delete window.BarcodeDetector; });
    await login(plain, 'Piotr');
    await go(plain, '#/sessions/s-003');
    await plain.waitForSelector('#scan-input');
    assert.ok(!(await plain.evaluate(() => [...document.querySelectorAll('.scan-buttons .btn')].some((b) => b.textContent.includes('camera')))));
    await plain.close();
  });
  await step('offline: service worker serves the app without a network', async () => {
    const offline = await browser.newPage();
    watch(offline);
    await offline.setViewport({ width: 1440, height: 900 });
    await offline.goto(URL_BASE, { waitUntil: 'networkidle0' });
    const registration = await offline.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, active: Boolean(reg.active) };
    });
    assert.ok(registration.active, 'service worker active');
    assert.equal(registration.scope, new URL('./', URL_BASE).href, 'scope matches the app base URL');
    await offline.reload({ waitUntil: 'networkidle0' });
    assert.ok(await offline.evaluate(() => Boolean(navigator.serviceWorker.controller)), 'page is controlled');
    const cached = await offline.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).length);
    assert.ok(cached >= 45, `precache populated (${cached})`);
    await offline.setOfflineMode(true);
    await offline.reload({ waitUntil: 'load' });
    await offline.waitForSelector('.login-card, .topbar', { timeout: 10000 });
    await login(offline, 'Piotr');
    await offline.waitForSelector('.topbar');
    await go(offline, '#/sessions');
    assert.ok((await offline.$$('.table tbody tr')).length >= 3, 'data and UI work offline');
    await go(offline, '#/products');
    assert.ok((await offline.$$('.table tbody tr')).length > 0);
    await offline.close();
  });

  if (SUBPATH_URL) {
    await step('sub-path hosting: app and service worker scope work under a sub-path', async () => {
      const sub = await browser.newPage();
      watch(sub);
      await sub.goto(SUBPATH_URL, { waitUntil: 'networkidle0' });
      await sub.waitForSelector('.login-card');
      const reg = await sub.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      assert.equal(reg, new URL('./', SUBPATH_URL).href);
      await sub.reload({ waitUntil: 'networkidle0' });
      await sub.setOfflineMode(true);
      await sub.reload({ waitUntil: 'load' });
      await sub.waitForSelector('.login-card');
      await sub.close();
    });
  }

  await step('no console errors, warnings, page errors or failed requests during the run', async () => {
    assert.deepEqual(problems, []);
  });

  console.log(`\nDownloads kept in ${downloads}`);
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
