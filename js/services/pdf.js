// PDF report for a counting session, generated in the browser with pdfmake (vendored, loaded on demand).

import { t, formatNumber, formatMoney, formatPercent, formatDateTime, formatSigned } from '../i18n.js';
import { lineVariance, summarize, varianceValue, discrepantLines } from '../domain/discrepancy.js';
import { lineName, sessionName, statusLabel, userNameById, warehouseById } from '../ui/format.js';
import { getData } from '../core/store.js';
import { slug } from '../ui/dom.js';

let loading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(el);
  });
}

/** Loads pdfmake and its fonts once (paths are relative to this module, so sub-path hosting works). */
export function loadPdfMake() {
  if (window.pdfMake?.vfs) return Promise.resolve(window.pdfMake);
  if (!loading) {
    const base = new URL('../../vendor/pdfmake/', import.meta.url);
    loading = loadScript(new URL('pdfmake.min.js', base).href)
      .then(() => loadScript(new URL('vfs_fonts.js', base).href))
      .then(() => window.pdfMake)
      .catch((error) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

const COLORS = { short: '#b91c1c', surplus: '#1d4ed8', head: '#1e293b', muted: '#64748b', line: '#cbd5e1', band: '#f1f5f9' };

function kv(label, value) {
  return [{ text: label, color: COLORS.muted, fontSize: 9 }, { text: String(value ?? '—'), fontSize: 10 }];
}

function lineRow(line) {
  const variance = lineVariance(line);
  const color = variance === null || variance === 0 ? undefined : variance < 0 ? COLORS.short : COLORS.surplus;
  return [
    { text: line.sku, fontSize: 8 },
    { text: lineName(line), fontSize: 8 },
    { text: line.locationCode, fontSize: 8 },
    { text: formatNumber(line.expected), alignment: 'right', fontSize: 8 },
    { text: line.counted === null ? '—' : formatNumber(line.counted), alignment: 'right', fontSize: 8 },
    { text: formatSigned(variance), alignment: 'right', fontSize: 8, color, bold: variance !== 0 && variance !== null },
    { text: variance === null ? '—' : formatMoney(varianceValue(line)), alignment: 'right', fontSize: 8, color },
  ];
}

function linesTable(lines) {
  const header = [t('products.sku'), t('products.name'), t('products.location'), t('pdf.expected'), t('pdf.counted'), t('pdf.variance'), t('pdf.value')].map((text, i) => ({
    text,
    bold: true,
    fontSize: 8,
    color: '#ffffff',
    fillColor: COLORS.head,
    alignment: i >= 3 ? 'right' : 'left',
  }));
  return {
    table: { headerRows: 1, widths: [52, '*', 62, 44, 44, 44, 56], body: [header, ...lines.map(lineRow)] },
    layout: {
      hLineColor: () => COLORS.line,
      vLineWidth: () => 0,
      hLineWidth: () => 0.5,
      fillColor: (row) => (row > 0 && row % 2 === 0 ? COLORS.band : null),
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

/** Builds the pdfmake document definition for a session (exported for testing in the browser). */
export function sessionReportDefinition(session) {
  const summary = summarize(session.lines);
  const discrepancies = discrepantLines(session.lines).sort((a, b) => Math.abs(varianceValue(b)) - Math.abs(varianceValue(a)));
  const sorted = [...session.lines].sort((a, b) => a.sku.localeCompare(b.sku));
  const data = getData();
  const generatedAt = formatDateTime(Date.now());

  return {
    info: { title: `${t('pdf.title')} – ${sessionName(session)}`, author: t('app.name'), subject: t('pdf.title') },
    pageSize: 'A4',
    pageMargins: [36, 48, 36, 54],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#0f172a' },
    footer: (page, pages) => ({
      margin: [36, 12, 36, 0],
      columns: [
        { text: t('pdf.footer', { date: generatedAt }), fontSize: 8, color: COLORS.muted },
        { text: t('pdf.page', { page, pages }), fontSize: 8, color: COLORS.muted, alignment: 'right' },
      ],
    }),
    content: [
      { text: t('pdf.title'), fontSize: 20, bold: true, color: COLORS.head },
      { text: sessionName(session), fontSize: 13, margin: [0, 2, 0, 12], color: COLORS.muted },
      {
        columns: [
          {
            width: '*',
            table: {
              widths: [90, '*'],
              body: [
                kv(t('sessions.warehouse'), warehouseById(session.warehouseId)),
                kv(t('sessions.scope'), session.locationId ? data.locations.find((l) => l.id === session.locationId)?.code : t('sessions.allLocations')),
                kv(t('sessions.status'), statusLabel(session.status)),
                kv(t('sessions.createdAt'), `${formatDateTime(session.createdAt)} · ${userNameById(session.createdBy)}`),
                kv(t('pdf.submitted'), session.submittedAt ? formatDateTime(session.submittedAt) : '—'),
                kv(t('pdf.reviewed'), session.reviewedAt ? `${formatDateTime(session.reviewedAt)} · ${userNameById(session.reviewedBy)}` : '—'),
              ],
            },
            layout: 'noBorders',
          },
          {
            width: 190,
            table: {
              widths: ['*', 'auto'],
              body: [
                [t('pdf.items'), formatNumber(summary.total)],
                [t('pdf.countedItems'), formatNumber(summary.counted)],
                [t('line.match'), formatNumber(summary.matched)],
                [t('line.shortage'), formatNumber(summary.shortageLines)],
                [t('line.surplus'), formatNumber(summary.surplusLines)],
                [t('dashboard.accuracy'), formatPercent(summary.accuracy)],
                [t('pdf.netUnits'), formatSigned(summary.netUnits)],
                [{ text: t('pdf.netValue'), bold: true }, { text: formatMoney(summary.netValue), bold: true, color: summary.netValue < 0 ? COLORS.short : undefined }],
              ].map(([a, b]) => [
                typeof a === 'string' ? { text: a, fontSize: 9 } : a,
                typeof b === 'string' ? { text: b, fontSize: 9, alignment: 'right' } : { alignment: 'right', fontSize: 9, ...b },
              ]),
            },
            layout: { hLineColor: () => COLORS.line, vLineWidth: () => 0, hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.5), fillColor: () => COLORS.band },
          },
        ],
        columnGap: 18,
      },
      { text: t('pdf.discrepancies'), style: 'h2', margin: [0, 18, 0, 6] },
      discrepancies.length ? linesTable(discrepancies) : { text: t('pdf.noDiscrepancies'), color: COLORS.muted, italics: true },
      { text: t('pdf.allItems'), style: 'h2', margin: [0, 18, 0, 6], pageBreak: discrepancies.length > 12 ? 'before' : undefined },
      linesTable(sorted),
      {
        margin: [0, 36, 0, 0],
        unbreakable: true,
        columns: [
          { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] }, { text: t('pdf.countedBy'), fontSize: 8, color: COLORS.muted, margin: [0, 3, 0, 0] }] },
          { stack: [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] }, { text: t('pdf.approvedBy'), fontSize: 8, color: COLORS.muted, margin: [0, 3, 0, 0] }] },
        ],
      },
    ],
    styles: { h2: { fontSize: 12, bold: true, color: COLORS.head } },
  };
}

export function sessionPdfFilename(session) {
  return `count-report-${slug(sessionName(session)) || 'session'}.pdf`;
}

export async function downloadSessionPdf(session) {
  const pdfMake = await loadPdfMake();
  const definition = sessionReportDefinition(session);
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(definition).download(sessionPdfFilename(session), resolve);
    } catch (error) {
      reject(error);
    }
  });
}
