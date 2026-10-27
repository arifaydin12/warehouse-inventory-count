// Realistic demo data. Dates are relative to `now`, so the dashboard always looks current.
// All people and companies are fictional.

import { makeEan13 } from '../domain/barcode.js';
import { buildSessionLines, requestRecount, stockAdjustments } from '../domain/workflow.js';
import { applyCount } from '../domain/discrepancy.js';
import { hashPin } from './auth.js';

export const DATA_VERSION = 1;
export const DEMO_PIN = '1234';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const USERS = [
  { id: 'u-admin', name: 'Anna Kowalska', role: 'admin' },
  { id: 'u-manager', name: 'Marek Nowak', role: 'manager' },
  { id: 'u-operator', name: 'Piotr Zieliński', role: 'operator' },
];

const WAREHOUSES = [
  { id: 'w-main', code: 'MAIN', name: 'Main Warehouse', de: 'Hauptlager', pl: 'Magazyn główny' },
  { id: 'w-dc', code: 'DC', name: 'Distribution Center', de: 'Distributionszentrum', pl: 'Centrum dystrybucyjne' },
  { id: 'w-store', code: 'STORE', name: 'Store Backroom', de: 'Filiallager', pl: 'Zaplecze sklepu' },
];

const LOCATIONS = [
  ['w-main', 'MAIN-A-01'], ['w-main', 'MAIN-A-02'], ['w-main', 'MAIN-A-03'],
  ['w-main', 'MAIN-B-01'], ['w-main', 'MAIN-B-02'], ['w-main', 'MAIN-B-03'],
  ['w-main', 'MAIN-R-01'],
  ['w-dc', 'DC-P-01'], ['w-dc', 'DC-P-02'], ['w-dc', 'DC-S-01'],
  ['w-store', 'STORE-O-01'], ['w-store', 'STORE-C-01'],
];

// sku, en, de, pl, category, unit, unit cost, expected stock, location
const PRODUCTS = [
  ['ELE-1001', 'USB-C cable, 1 m', 'USB-C-Kabel, 1 m', 'Kabel USB-C, 1 m', 'electronics', 'pcs', 3.9, 240, 'MAIN-A-01'],
  ['ELE-1002', 'Wireless mouse', 'Kabellose Maus', 'Mysz bezprzewodowa', 'electronics', 'pcs', 12.5, 85, 'MAIN-A-01'],
  ['ELE-1003', 'Mechanical keyboard', 'Mechanische Tastatur', 'Klawiatura mechaniczna', 'electronics', 'pcs', 49, 40, 'MAIN-A-02'],
  ['ELE-1004', 'Monitor 24"', 'Monitor 24"', 'Monitor 24"', 'electronics', 'pcs', 119, 18, 'MAIN-A-02'],
  ['ELE-1005', 'LED desk lamp', 'LED-Schreibtischlampe', 'Lampka biurkowa LED', 'electronics', 'pcs', 18.9, 52, 'MAIN-A-03'],
  ['ELE-1006', 'Power strip, 5 sockets', 'Steckdosenleiste, 5-fach', 'Listwa zasilająca, 5 gniazd', 'electronics', 'pcs', 9.9, 120, 'MAIN-A-03'],
  ['ELE-1007', 'AA batteries, 4-pack', 'AA-Batterien, 4er-Pack', 'Baterie AA, 4 szt.', 'electronics', 'pack', 3.2, 300, 'MAIN-A-03'],
  ['ELE-1008', 'Handheld barcode scanner', 'Handheld-Barcodescanner', 'Ręczny skaner kodów kreskowych', 'electronics', 'pcs', 79, 12, 'MAIN-A-02'],
  ['TOO-2001', 'Cordless drill, 18 V', 'Akkuschrauber, 18 V', 'Wiertarko-wkrętarka akumulatorowa, 18 V', 'tools', 'pcs', 89, 22, 'MAIN-B-01'],
  ['TOO-2002', 'Hex key set', 'Innensechskantschlüssel-Satz', 'Zestaw kluczy imbusowych', 'tools', 'pcs', 7.5, 64, 'MAIN-B-01'],
  ['TOO-2003', 'Adjustable wrench, 250 mm', 'Rollgabelschlüssel, 250 mm', 'Klucz nastawny, 250 mm', 'tools', 'pcs', 14.9, 45, 'MAIN-B-02'],
  ['TOO-2004', 'Tape measure, 5 m', 'Maßband, 5 m', 'Miara zwijana, 5 m', 'tools', 'pcs', 4.8, 130, 'MAIN-B-02'],
  ['TOO-2005', 'Claw hammer', 'Klauenhammer', 'Młotek ciesielski', 'tools', 'pcs', 11, 38, 'MAIN-B-02'],
  ['TOO-2006', 'Screwdriver set, 12 pieces', 'Schraubendreher-Set, 12-teilig', 'Zestaw wkrętaków, 12 elementów', 'tools', 'pcs', 16.5, 56, 'MAIN-B-03'],
  ['TOO-2007', 'Utility knife', 'Cuttermesser', 'Nóż do tapet', 'tools', 'pcs', 3.5, 150, 'MAIN-B-03'],
  ['TOO-2008', 'Spirit level, 60 cm', 'Wasserwaage, 60 cm', 'Poziomica, 60 cm', 'tools', 'pcs', 9.2, 41, 'MAIN-B-03'],
  ['PAC-3001', 'Cardboard box 40×30×20 cm', 'Karton 40×30×20 cm', 'Karton 40×30×20 cm', 'packaging', 'pcs', 0.85, 900, 'DC-P-01'],
  ['PAC-3002', 'Stretch film, roll', 'Stretchfolie, Rolle', 'Folia stretch, rolka', 'packaging', 'pcs', 6.4, 150, 'DC-P-01'],
  ['PAC-3003', 'Packing tape, 48 mm', 'Packband, 48 mm', 'Taśma pakowa, 48 mm', 'packaging', 'pcs', 1.2, 480, 'DC-P-01'],
  ['PAC-3004', 'Bubble wrap, roll', 'Luftpolsterfolie, Rolle', 'Folia bąbelkowa, rolka', 'packaging', 'pcs', 14, 35, 'DC-P-02'],
  ['PAC-3005', 'Euro pallet EPAL', 'Europalette EPAL', 'Paleta EUR EPAL', 'packaging', 'pallet', 11.5, 80, 'DC-P-02'],
  ['PAC-3006', 'Padded envelope C4', 'Luftpolstertasche C4', 'Koperta bąbelkowa C4', 'packaging', 'pcs', 0.45, 1200, 'DC-P-02'],
  ['PAC-3007', 'Shipping labels A6, roll', 'Versandetiketten A6, Rolle', 'Etykiety wysyłkowe A6, rolka', 'packaging', 'pcs', 5.9, 210, 'DC-P-01'],
  ['OFF-4001', 'A4 copy paper, 500 sheets', 'Kopierpapier A4, 500 Blatt', 'Papier ksero A4, 500 arkuszy', 'office', 'pack', 4.6, 200, 'STORE-O-01'],
  ['OFF-4002', 'Ballpoint pens, box of 50', 'Kugelschreiber, 50er-Box', 'Długopisy, pudełko 50 szt.', 'office', 'box', 8.9, 30, 'STORE-O-01'],
  ['OFF-4003', 'Stapler', 'Heftgerät', 'Zszywacz', 'office', 'pcs', 5.4, 44, 'STORE-O-01'],
  ['OFF-4004', 'Ring binder A4', 'Ordner A4', 'Segregator A4', 'office', 'pcs', 1.9, 260, 'STORE-O-01'],
  ['OFF-4005', 'Sticky notes, 12 pads', 'Haftnotizen, 12 Blöcke', 'Karteczki samoprzylepne, 12 bloczków', 'office', 'pack', 4.1, 90, 'STORE-O-01'],
  ['OFF-4006', 'Whiteboard markers, 4 colours', 'Whiteboard-Marker, 4 Farben', 'Markery do tablic, 4 kolory', 'office', 'pack', 3.8, 70, 'STORE-O-01'],
  ['SAF-5001', 'Safety gloves, pair', 'Schutzhandschuhe, Paar', 'Rękawice ochronne, para', 'safety', 'pcs', 2.3, 400, 'DC-S-01'],
  ['SAF-5002', 'Safety helmet', 'Schutzhelm', 'Kask ochronny', 'safety', 'pcs', 8.7, 75, 'DC-S-01'],
  ['SAF-5003', 'High-visibility vest', 'Warnweste', 'Kamizelka odblaskowa', 'safety', 'pcs', 3.1, 180, 'DC-S-01'],
  ['SAF-5004', 'Safety glasses', 'Schutzbrille', 'Okulary ochronne', 'safety', 'pcs', 2.9, 140, 'DC-S-01'],
  ['SAF-5005', 'Ear plugs, box of 200', 'Gehörschutzstöpsel, 200er-Box', 'Stopery do uszu, pudełko 200 szt.', 'safety', 'box', 18, 24, 'DC-S-01'],
  ['SAF-5006', 'First-aid kit', 'Erste-Hilfe-Set', 'Apteczka pierwszej pomocy', 'safety', 'pcs', 21, 16, 'DC-S-01'],
  ['CLE-6001', 'Floor cleaner, 5 l', 'Bodenreiniger, 5 l', 'Środek do mycia podłóg, 5 l', 'cleaning', 'pcs', 7.8, 36, 'STORE-C-01'],
  ['CLE-6002', 'Microfibre cloths, 10-pack', 'Mikrofasertücher, 10er-Pack', 'Ściereczki z mikrofibry, 10 szt.', 'cleaning', 'pack', 5.2, 80, 'STORE-C-01'],
  ['CLE-6003', 'Disinfectant spray, 500 ml', 'Desinfektionsspray, 500 ml', 'Spray dezynfekujący, 500 ml', 'cleaning', 'pcs', 3.6, 110, 'STORE-C-01'],
  ['CLE-6004', 'Refuse sacks 120 l, roll', 'Müllsäcke 120 l, Rolle', 'Worki na śmieci 120 l, rolka', 'cleaning', 'pcs', 4.3, 95, 'STORE-C-01'],
];

/** Count overrides per scenario: sku -> difference between counted and expected. */
const SESSION_A_DIFFS = { 'ELE-1003': -2, 'TOO-2002': 1, 'ELE-1007': -4, 'TOO-2005': -1 };
const SESSION_B_DIFFS = { 'PAC-3002': -12, 'PAC-3004': 3, 'SAF-5003': -5, 'SAF-5006': -1, 'PAC-3005': -2 };
const SESSION_C_DIFFS = { 'OFF-4003': -1 };
const SESSION_D_DIFFS = { 'TOO-2001': -3, 'TOO-2006': 2 };

export async function buildSeed(now = Date.now()) {
  const users = [];
  for (const u of USERS) {
    const salt = `seed-${u.id}`;
    users.push({ ...u, salt, pinHash: await hashPin(DEMO_PIN, salt), createdAt: now - 30 * DAY });
  }

  const warehouses = WAREHOUSES.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    i18n: { de: { name: w.de }, pl: { name: w.pl } },
  }));

  const locations = LOCATIONS.map(([warehouseId, code]) => ({ id: `l-${code}`, warehouseId, code }));
  const locationsById = new Map(locations.map((l) => [l.id, l]));

  const products = PRODUCTS.map(([sku, en, de, pl, category, unit, unitCost, expected, loc], i) => ({
    id: `p-${sku}`,
    sku,
    barcode: makeEan13(`590${String(1_000_000 + i * 7919).padStart(9, '0')}`),
    name: en,
    i18n: { de: { name: de }, pl: { name: pl } },
    category,
    unit,
    locationId: `l-${loc}`,
    expected,
    unitCost,
    createdAt: now - 30 * DAY,
    updatedAt: now - 30 * DAY,
  }));

  const audit = [];
  const log = (ts, userId, action, entity, entityId, params = {}) => {
    const user = users.find((u) => u.id === userId);
    audit.push({ id: `a-${audit.length + 1}`, ts, userId, userName: user.name, action, entity, entityId, params });
  };

  log(now - 30 * DAY, 'u-admin', 'product.import', 'product', null, { count: products.length });

  const scoped = (warehouseId, locationFilter = () => true) =>
    buildSessionLines(
      products.filter((p) => locationsById.get(p.locationId).warehouseId === warehouseId && locationFilter(locationsById.get(p.locationId))),
      locationsById,
    );

  /** Counts every line (expected + diff), spreading count times between `from` and `to`. */
  const countLines = (lines, diffs, userId, from, to, onlyFirst = Infinity) =>
    lines.map((line, i) => {
      if (i >= onlyFirst) return line;
      const at = Math.round(from + ((to - from) * (i + 1)) / (lines.length + 1));
      const target = Math.max(0, line.expected + (diffs[line.sku] ?? 0));
      return applyCount(line, target, 'set', { at, by: userId });
    });

  const sessions = [];

  // A: approved cycle count of the main warehouse
  {
    const created = now - 10 * DAY;
    const lines = countLines(scoped('w-main'), SESSION_A_DIFFS, 'u-operator', now - 9 * DAY, now - 8 * DAY - 2 * HOUR);
    const session = {
      id: 's-001',
      name: 'Monthly cycle count – Main Warehouse',
      i18n: {
        de: { name: 'Monatliche Stichtagsinventur – Hauptlager' },
        pl: { name: 'Miesięczna inwentaryzacja cykliczna – Magazyn główny' },
      },
      warehouseId: 'w-main',
      locationId: '',
      status: 'approved',
      createdBy: 'u-manager',
      createdAt: created,
      submittedAt: now - 8 * DAY - HOUR,
      reviewedAt: now - 8 * DAY,
      reviewedBy: 'u-manager',
      reviewNote: '',
      lines,
    };
    sessions.push(session);
    log(created, 'u-manager', 'session.create', 'session', session.id, { name: session.name });
    log(session.submittedAt, 'u-operator', 'session.submit', 'session', session.id, { name: session.name });
    log(session.reviewedAt, 'u-manager', 'session.approve', 'session', session.id, { name: session.name });
    for (const adj of stockAdjustments(session)) {
      const p = products.find((x) => x.id === adj.productId);
      p.expected = adj.to;
      p.updatedAt = session.reviewedAt;
    }
  }

  // B: submitted, waiting for review
  {
    const created = now - 3 * DAY;
    const lines = countLines(scoped('w-dc'), SESSION_B_DIFFS, 'u-operator', now - 2 * DAY - 6 * HOUR, now - 2 * DAY);
    const session = {
      id: 's-002',
      name: 'Distribution Center – packaging & safety gear',
      i18n: {
        de: { name: 'Distributionszentrum – Verpackung & Schutzausrüstung' },
        pl: { name: 'Centrum dystrybucyjne – opakowania i środki ochrony' },
      },
      warehouseId: 'w-dc',
      locationId: '',
      status: 'submitted',
      createdBy: 'u-manager',
      createdAt: created,
      submittedAt: now - 2 * DAY + HOUR,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: '',
      lines,
    };
    sessions.push(session);
    log(created, 'u-manager', 'session.create', 'session', session.id, { name: session.name });
    log(session.submittedAt, 'u-operator', 'session.submit', 'session', session.id, { name: session.name });
  }

  // C: open, partially counted today
  {
    const created = now - 4 * HOUR;
    const lines = countLines(scoped('w-store'), SESSION_C_DIFFS, 'u-operator', now - 3 * HOUR, now - 10 * 60_000, 6);
    const session = {
      id: 's-003',
      name: 'Store backroom spot check',
      i18n: { de: { name: 'Stichprobe Filiallager' }, pl: { name: 'Kontrola wyrywkowa zaplecza sklepu' } },
      warehouseId: 'w-store',
      locationId: '',
      status: 'open',
      createdBy: 'u-manager',
      createdAt: created,
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: '',
      lines,
    };
    sessions.push(session);
    log(created, 'u-manager', 'session.create', 'session', session.id, { name: session.name });
  }

  // D: recount requested for two tool lines
  {
    const created = now - 4 * DAY;
    const counted = countLines(
      scoped('w-main', (l) => l.code.startsWith('MAIN-B')),
      SESSION_D_DIFFS,
      'u-operator',
      now - 3 * DAY - 5 * HOUR,
      now - 3 * DAY,
    );
    const lines = requestRecount(counted, ['p-TOO-2001', 'p-TOO-2006']);
    const session = {
      id: 's-004',
      name: 'Tool rack check',
      i18n: { de: { name: 'Prüfung Werkzeugregal' }, pl: { name: 'Kontrola regału z narzędziami' } },
      warehouseId: 'w-main',
      locationId: '',
      status: 'recount',
      createdBy: 'u-manager',
      createdAt: created,
      submittedAt: now - 3 * DAY + HOUR,
      reviewedAt: now - 2 * DAY,
      reviewedBy: 'u-manager',
      reviewNote: '',
      lines,
    };
    sessions.push(session);
    log(created, 'u-manager', 'session.create', 'session', session.id, { name: session.name });
    log(session.submittedAt, 'u-operator', 'session.submit', 'session', session.id, { name: session.name });
    log(session.reviewedAt, 'u-manager', 'session.recount', 'session', session.id, { name: session.name, count: 2 });
  }

  log(now - 9 * DAY - 30 * 60_000, 'u-operator', 'auth.login', 'user', 'u-operator');
  log(now - 4 * HOUR + 5 * 60_000, 'u-operator', 'auth.login', 'user', 'u-operator');
  audit.sort((a, b) => a.ts - b.ts);
  audit.forEach((entry, i) => {
    entry.id = `a-${i + 1}`;
  });

  return {
    version: DATA_VERSION,
    seededAt: now,
    users,
    warehouses,
    locations,
    products,
    sessions,
    audit,
  };
}
