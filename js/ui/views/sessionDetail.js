// Counting session: scan/count, review (approve / recount) and report export.

import { h, clear, fill, downloadText, slug } from '../dom.js';
import { icon } from '../icons.js';
import { badge, button, confirmDialog, emptyState, kpiCard, openDialog, progressBar, reportError, statusTone, toast, withBusy, field } from '../components.js';
import { createTable } from '../table.js';
import { t, tn, formatNumber, formatDateTime, formatMoney, formatPercent, formatSigned } from '../../i18n.js';
import { getData, getPrefs, setPrefs } from '../../core/store.js';
import {
  scanCode, setLineCount, restoreLine, submitSession, approveSession, requestRecount,
  cancelSession, markRemainingZero, logExport, ActionError, ValidationError,
} from '../../core/actions.js';
import { can } from '../../domain/permissions.js';
import { lineStatus, lineVariance, summarize, varianceValue, variancePercent, discrepantLines } from '../../domain/discrepancy.js';
import { canSubmit, isCountingStatus, isLineEditable, stockAdjustments } from '../../domain/workflow.js';
import { sessionReportRows, toCSV } from '../../domain/csv.js';
import { auditText, categoryLabel, lineName, sessionName, statusLabel, userNameById, warehouseById } from '../format.js';
import { cameraScanSupported, openCameraScanner } from '../../services/camera.js';
import { beep } from '../../services/sound.js';

export function mountSessionDetail(root, { user, param: sessionId, navigate }) {
  const find = () => getData().sessions.find((s) => s.id === sessionId);
  if (!find()) {
    fill(root, 
      emptyState({
        title: t('sessions.notFound'),
        action: h('a', { class: 'btn btn-primary', href: '#/sessions' }, t('sessions.backToList')),
      }),
    );
    return { refresh() {} };
  }

  const perms = {
    count: can(user.role, 'sessions.count'),
    submit: can(user.role, 'sessions.submit'),
    review: can(user.role, 'sessions.review'),
    cancel: can(user.role, 'sessions.cancel'),
    export: can(user.role, 'reports.export'),
  };

  let renderedStatus = null;
  let table = null;
  let scanPanel = null;
  const recountSelection = new Set();
  const undoStack = [];
  const recentScans = [];

  // Holders updated independently on refresh.
  const headerHolder = h('div');
  const noticeHolder = h('div');
  const panelHolder = h('div');
  const summaryHolder = h('div');
  const tableHolder = h('div');
  const activityHolder = h('div');

  // --- Header & actions --------------------------------------------------------------------

  function renderHeader() {
    const s = find();
    const sum = summarize(s.lines);
    const submitState = canSubmit(s);
    const actions = [];

    if (perms.export) {
      actions.push(
        (() => {
          const btn = button(t('report.pdf'), { iconName: 'file' });
          btn.addEventListener('click', () =>
            withBusy(btn, async () => {
              try {
                const { downloadSessionPdf } = await import('../../services/pdf.js');
                await downloadSessionPdf(find());
                logExport('pdf', { name: s.name });
                toast(t('report.pdfDone'), 'success');
              } catch (e) {
                reportError(e);
              }
            }),
          );
          return btn;
        })(),
        button(t('report.csv'), { iconName: 'download', onClick: exportCsv }),
      );
    }
    if (isCountingStatus(s.status) && perms.submit) {
      actions.push(
        button(t('sessions.submit'), {
          variant: 'primary',
          iconName: 'check',
          disabled: !submitState.ok,
          title: submitState.ok ? undefined : t(submitState.reason, { n: submitState.remaining }),
          onClick: doSubmit,
        }),
      );
    }
    if (s.status === 'submitted' && perms.review) {
      actions.push(
        button(t('sessions.requestRecount'), { iconName: 'refresh', onClick: doRecount }),
        button(t('sessions.approve'), { variant: 'primary', iconName: 'check', onClick: doApprove }),
      );
    }
    if (['open', 'submitted', 'recount'].includes(s.status) && perms.cancel) {
      actions.push(button(t('sessions.cancel'), { variant: 'ghost-danger', iconName: 'close', onClick: doCancel }));
    }

    const scope = s.locationId ? getData().locations.find((l) => l.id === s.locationId)?.code : t('sessions.allLocations');
    fill(headerHolder, 
      h('a', { href: '#/sessions', class: 'back-link' }, icon('chevronLeft'), t('sessions.backToList')),
      h(
        'div',
        { class: 'page-header' },
        h(
          'div',
          {},
          h('h1', { id: 'page-title', tabindex: '-1' }, sessionName(s)),
          h('div', { class: 'meta-row' }, badge(statusLabel(s.status), statusTone(s.status)), h('span', { class: 'muted' }, `${warehouseById(s.warehouseId)} · ${scope}`)),
        ),
        h('div', { class: 'page-actions' }, actions),
      ),
      h(
        'dl',
        { class: 'meta-grid' },
        meta(t('sessions.createdAt'), `${formatDateTime(s.createdAt)} · ${userNameById(s.createdBy)}`),
        meta(t('pdf.submitted'), s.submittedAt ? formatDateTime(s.submittedAt) : '—'),
        meta(t('pdf.reviewed'), s.reviewedAt ? `${formatDateTime(s.reviewedAt)} · ${userNameById(s.reviewedBy)}` : '—'),
        meta(t('sessions.progress'), `${formatNumber(sum.counted)} / ${formatNumber(sum.total)}`),
      ),
    );

    fill(noticeHolder, 
      s.status === 'recount'
        ? h('div', { class: 'alert alert-warn' }, icon('refresh'), h('span', {}, t('sessions.recountNotice', { n: s.lines.filter((l) => l.recount).length }), s.reviewNote ? ` ${t('sessions.reviewNote', { note: s.reviewNote })}` : ''))
        : null,
      s.status === 'submitted' && !perms.review ? h('div', { class: 'alert alert-info' }, icon('info'), h('span', {}, t('sessions.waitingReview'))) : null,
      s.status === 'cancelled' ? h('div', { class: 'alert alert-info' }, icon('info'), h('span', {}, t('sessions.cancelledNotice'))) : null,
      s.status === 'approved' ? h('div', { class: 'alert alert-success' }, icon('check'), h('span', {}, t('sessions.approvedNotice', { user: userNameById(s.reviewedBy), date: formatDateTime(s.reviewedAt) }))) : null,
    );
  }

  const meta = (label, value) => h('div', {}, h('dt', {}, label), h('dd', {}, value));

  function exportCsv() {
    const s = find();
    const rows = sessionReportRows(s, { name: lineName, userName: userNameById });
    downloadText(`count-${slug(sessionName(s)) || 'session'}.csv`, toCSV(rows, { bom: true }));
    logExport('csv', { name: s.name });
    toast(t('report.csvDone'), 'success');
  }

  async function doSubmit() {
    const s = find();
    const sum = summarize(s.lines);
    const n = sum.shortageLines + sum.surplusLines;
    const ok = await confirmDialog({
      title: t('sessions.submit'),
      message: t('sessions.submitConfirm', { n }),
      confirmLabel: t('sessions.submit'),
    });
    if (!ok) return;
    try {
      submitSession(s.id);
      toast(t('sessions.submitted'), 'success');
    } catch (e) {
      reportError(e);
    }
  }

  async function doApprove() {
    const s = find();
    const adjustments = stockAdjustments(s).length;
    const ok = await confirmDialog({
      title: t('sessions.approve'),
      message: t('sessions.approveConfirm', { n: adjustments }),
      confirmLabel: t('sessions.approve'),
    });
    if (!ok) return;
    try {
      approveSession(s.id);
      toast(t('sessions.approved'), 'success');
    } catch (e) {
      reportError(e);
    }
  }

  function doRecount() {
    const s = find();
    const available = discrepantLines(s.lines);
    if (available.length === 0) {
      toast(t('sessions.error.noDiscrepancies'), 'error');
      return;
    }
    if (recountSelection.size === 0) available.forEach((l) => recountSelection.add(l.productId));
    const noteField = field({ name: 'note', label: t('sessions.recountNote'), type: 'textarea', maxLength: 200, hint: t('sessions.recountNoteHint') });
    const countText = h('p', {}, tn('sessions.recountLines', recountSelection.size));
    const dlg = openDialog({
      title: t('sessions.requestRecount'),
      size: 'sm',
      body: h('div', { class: 'form' }, countText, noteField.el, h('p', { class: 'muted small' }, t('sessions.recountHelp'))),
      actions: [
        button(t('common.cancel'), { onClick: () => dlg.close() }),
        button(t('sessions.requestRecount'), {
          variant: 'primary',
          onClick: () => {
            try {
              requestRecount(s.id, [...recountSelection], noteField.input.value);
              recountSelection.clear();
              toast(t('sessions.recountRequested'), 'success');
              dlg.close();
            } catch (e) {
              reportError(e);
            }
          },
        }),
      ],
    });
  }

  async function doCancel() {
    const ok = await confirmDialog({ title: t('sessions.cancel'), message: t('sessions.cancelConfirm'), confirmLabel: t('sessions.cancel'), danger: true });
    if (!ok) return;
    try {
      cancelSession(find().id);
      toast(t('sessions.cancelled'), 'success');
    } catch (e) {
      reportError(e);
    }
  }

  // --- Scan panel -------------------------------------------------------------------------

  function buildScanPanel() {
    const s = find();
    const scanInput = h('input', {
      id: 'scan-input',
      class: 'input input-lg mono',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      inputmode: 'text',
      placeholder: t('scan.placeholder'),
      'aria-describedby': 'scan-hint scan-feedback',
    });
    const qtyInput = h('input', { id: 'scan-qty', class: 'input', type: 'number', min: 0, step: 1, value: 1, inputmode: 'numeric' });
    let mode = 'add';
    const feedback = h('div', { id: 'scan-feedback', class: 'scan-feedback', role: 'status', 'aria-live': 'polite' }, t('scan.ready'));
    const recentList = h('ol', { class: 'recent-scans', 'aria-label': t('scan.recent') });
    const undoBtn = button(t('scan.undo'), { iconName: 'undo', disabled: true, onClick: undo });

    function setFeedback(kind, message) {
      feedback.className = `scan-feedback scan-${kind}`;
      feedback.textContent = message;
    }

    function renderRecent() {
      clear(recentList);
      for (const r of recentScans.slice(0, 5)) {
        recentList.append(h('li', {}, h('span', { class: 'mono' }, r.sku), h('span', {}, ` ${r.name}`), h('strong', {}, ` → ${formatNumber(r.counted)}`)));
      }
      undoBtn.disabled = undoStack.length === 0;
    }

    function handleCode(raw, { fromCamera = false } = {}) {
      const qty = qtyInput.value === '' ? NaN : Number(qtyInput.value);
      try {
        const { line, before } = scanCode(sessionId, raw, qty, mode);
        undoStack.push(before);
        recentScans.unshift({ sku: line.sku, name: lineName(line), counted: line.counted });
        const diff = lineVariance(line);
        setFeedback(diff === 0 ? 'ok' : 'warn', t('scan.counted', { sku: line.sku, name: lineName(line), counted: line.counted, expected: line.expected }));
        if (getPrefs().sound) beep(true);
        renderRecent();
        if (mode === 'add') qtyInput.value = '1';
        if (!fromCamera) {
          scanInput.value = '';
          scanInput.focus();
        }
        return true;
      } catch (e) {
        if (e instanceof ActionError) setFeedback('error', t(e.key, e.params));
        else if (e instanceof ValidationError) setFeedback('error', Object.values(e.errors).map((x) => t(x.key, x.params)).join(' '));
        else reportError(e);
        if (getPrefs().sound) beep(false);
        scanInput.select();
        return false;
      }
    }

    function undo() {
      const before = undoStack.pop();
      if (!before) return;
      try {
        restoreLine(sessionId, before);
        recentScans.shift();
        setFeedback('ok', t('scan.undone', { sku: before.sku }));
        renderRecent();
      } catch (e) {
        reportError(e);
      }
      scanInput.focus();
    }

    const form = h(
      'form',
      {
        class: 'scan-form',
        novalidate: true,
        onSubmit: (e) => {
          e.preventDefault();
          if (!scanInput.value.trim()) {
            setFeedback('error', t('scan.empty'));
            scanInput.focus();
            return;
          }
          handleCode(scanInput.value);
        },
      },
      h('div', { class: 'field scan-field' }, h('label', { for: 'scan-input' }, t('scan.label')), scanInput, h('p', { class: 'field-hint', id: 'scan-hint' }, t('scan.hint'))),
      h('div', { class: 'field qty-field' }, h('label', { for: 'scan-qty' }, t('scan.quantity')), qtyInput),
      h(
        'fieldset',
        { class: 'fieldset mode-field' },
        h('legend', {}, t('scan.mode')),
        ['add', 'set'].map((m) =>
          h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'scan-mode', value: m, checked: m === mode, onChange: () => { mode = m; } }), h('span', {}, t(`scan.mode.${m}`))),
        ),
      ),
      h('div', { class: 'scan-buttons' }, button(t('scan.count'), { variant: 'primary', iconName: 'scan', type: 'submit' }), cameraScanSupported()
        ? button(t('scan.camera'), { iconName: 'camera', onClick: () => openCameraScanner({ onCode: (code) => handleCode(code, { fromCamera: true }) }) })
        : null, undoBtn),
    );

    const zeroBtn = perms.count
      ? button(t('scan.zeroRemaining'), {
          iconName: 'alert',
          onClick: async () => {
            const remaining = find().lines.filter((l) => isLineEditable(find(), l) && lineStatus(l) === 'uncounted').length;
            if (!remaining) {
              toast(t('scan.nothingRemaining'), 'info');
              return;
            }
            const ok = await confirmDialog({ title: t('scan.zeroRemaining'), message: t('scan.zeroConfirm', { n: remaining }), confirmLabel: t('common.confirm') });
            if (!ok) return;
            try {
              markRemainingZero(sessionId);
              toast(t('scan.zeroDone', { n: remaining }), 'success');
            } catch (e) {
              reportError(e);
            }
          },
        })
      : null;

    const sound = h(
      'label',
      { class: 'checkbox' },
      h('input', { type: 'checkbox', checked: getPrefs().sound, onChange: (e) => setPrefs({ sound: e.target.checked }) }),
      h('span', {}, t('scan.sound')),
    );

    renderRecent();
    const panel = h(
      'section',
      { class: 'card scan-panel', 'aria-labelledby': 'scan-title' },
      h('div', { class: 'card-head' }, h('h2', { id: 'scan-title' }, t('scan.title')), h('div', { class: 'row-actions' }, sound, zeroBtn)),
      s.status === 'recount' ? h('p', { class: 'muted small' }, t('scan.recountOnly')) : null,
      form,
      feedback,
      recentList,
    );
    return { el: panel, focus: () => scanInput.focus() };
  }

  // --- Summary, lines table, activity -------------------------------------------------------

  function renderSummary() {
    const s = find();
    const sum = summarize(s.lines);
    fill(summaryHolder, 
      h(
        'section',
        { class: 'kpi-grid kpi-grid-6', 'aria-label': t('sessions.summary') },
        kpiCard({ label: t('sessions.progress'), value: formatPercent(sum.progress), hint: `${formatNumber(sum.counted)} / ${formatNumber(sum.total)}` }),
        kpiCard({ label: t('line.match'), value: formatNumber(sum.matched), tone: 'success' }),
        kpiCard({ label: t('line.shortage'), value: formatNumber(sum.shortageLines), hint: t('sessions.units', { n: formatNumber(sum.shortageUnits) }), tone: sum.shortageLines ? 'danger' : null }),
        kpiCard({ label: t('line.surplus'), value: formatNumber(sum.surplusLines), hint: t('sessions.units', { n: formatNumber(sum.surplusUnits) }), tone: sum.surplusLines ? 'info' : null }),
        kpiCard({ label: t('line.uncounted'), value: formatNumber(sum.uncounted) }),
        kpiCard({ label: t('sessions.netValue'), value: formatMoney(sum.netValue), hint: `${formatSigned(sum.netUnits)} ${t('sessions.unitsShort')}`, tone: sum.netValue < 0 ? 'danger' : null }),
      ),
      progressBar(sum.progress, t('sessions.progress')),
    );
  }

  function buildTable() {
    const s = find();
    const reviewing = s.status === 'submitted' && perms.review;
    const rows = () =>
      find().lines.map((l) => ({ ...l, id: l.productId, status: lineStatus(l), variance: lineVariance(l), editable: isLineEditable(find(), l) && perms.count }));

    const columns = [];
    if (reviewing) {
      columns.push({
        key: 'select',
        label: t('sessions.recountCol'),
        mobileLabel: false,
        className: 'check-col',
        render: (r) =>
          r.status === 'shortage' || r.status === 'surplus'
            ? h('input', {
                type: 'checkbox',
                'aria-label': `${t('sessions.selectRecount')}: ${r.sku}`,
                checked: recountSelection.has(r.productId),
                'data-focus-id': `sel-${r.productId}`,
                onChange: (e) => {
                  if (e.target.checked) recountSelection.add(r.productId);
                  else recountSelection.delete(r.productId);
                },
              })
            : '',
      });
    }
    columns.push(
      { key: 'sku', label: t('products.sku'), sortable: true, rowHeader: true, className: 'mono', render: (r) => r.sku },
      {
        key: 'name',
        label: t('products.name'),
        sortable: true,
        sortValue: (r) => lineName(r),
        render: (r) => h('div', {}, h('div', { class: 'strong' }, lineName(r), r.recount ? [' ', badge(t('line.recount'), 'warn')] : null), h('div', { class: 'muted small' }, `${categoryLabel(r.category)}${r.barcode ? ` · ${r.barcode}` : ''}`)),
      },
      { key: 'locationCode', label: t('products.location'), sortable: true, className: 'mono hide-sm', render: (r) => r.locationCode },
      { key: 'expected', label: t('pdf.expected'), sortable: true, className: 'num', render: (r) => formatNumber(r.expected) },
      {
        key: 'counted',
        label: t('pdf.counted'),
        sortable: true,
        className: 'num count-col',
        sortValue: (r) => r.counted,
        render: (r) =>
          r.editable
            ? h('input', {
                type: 'number',
                min: 0,
                step: 1,
                class: 'input input-count',
                inputmode: 'numeric',
                value: r.counted ?? '',
                placeholder: '—',
                'aria-label': `${t('pdf.counted')}: ${r.sku}`,
                'data-focus-id': `count-${r.productId}`,
                onChange: (e) => {
                  try {
                    setLineCount(sessionId, r.productId, e.target.value);
                  } catch (err) {
                    reportError(err);
                    table.refresh();
                  }
                },
              })
            : r.counted === null
              ? '—'
              : formatNumber(r.counted),
      },
      {
        key: 'variance',
        label: t('pdf.variance'),
        sortable: true,
        className: 'num',
        sortValue: (r) => (r.variance === null ? null : Math.abs(r.variance)),
        render: (r) => {
          if (r.variance === null) return h('span', { class: 'muted' }, '—');
          const pct = variancePercent(r);
          return h('span', { class: `variance variance-${r.status}` }, formatSigned(r.variance), pct !== null && r.variance !== 0 ? h('span', { class: 'muted small' }, ` (${formatSigned(pct)}%)`) : null);
        },
      },
      { key: 'value', label: t('pdf.value'), sortable: true, className: 'num hide-sm', sortValue: (r) => (r.variance === null ? null : varianceValue(r)), render: (r) => (r.variance === null ? '—' : formatMoney(varianceValue(r))) },
      { key: 'status', label: t('sessions.result'), sortable: true, className: 'hide-md', sortValue: (r) => t(`line.${r.status}`), render: (r) => badge(t(`line.${r.status}`), statusTone(r.status)) },
    );

    table = createTable({
      caption: t('sessions.lines'),
      searchPlaceholder: t('sessions.searchLines'),
      columns,
      rowKey: (r) => r.id,
      getRows: rows,
      searchText: (r) => [r.sku, r.barcode, r.name, lineName(r), r.locationCode, categoryLabel(r.category)].join(' '),
      defaultSort: { key: 'sku', dir: 'asc' },
      pageSize: 25,
      rowClass: (r) => `row-${r.status}${r.recount ? ' row-recount' : ''}`,
      filters: [
        {
          key: 'result',
          label: t('sessions.result'),
          allLabel: t('sessions.allResults'),
          options: [
            { value: 'uncounted', label: t('line.uncounted') },
            { value: 'match', label: t('line.match') },
            { value: 'shortage', label: t('line.shortage') },
            { value: 'surplus', label: t('line.surplus') },
            { value: 'discrepancy', label: t('sessions.discrepanciesOnly') },
            { value: 'recount', label: t('line.recount') },
          ],
          predicate: (r, v) => (v === 'discrepancy' ? r.status === 'shortage' || r.status === 'surplus' : v === 'recount' ? r.recount : r.status === v),
        },
      ],
      toolbarExtra: reviewing
        ? [
            button(t('sessions.selectAllDiscrepancies'), {
              iconName: 'check',
              onClick: () => {
                discrepantLines(find().lines).forEach((l) => recountSelection.add(l.productId));
                table.refresh();
              },
            }),
          ]
        : [],
    });
    return table.el;
  }

  function renderActivity() {
    const entries = getData().audit.filter((e) => e.entityId === sessionId).reverse().slice(0, 8);
    clear(activityHolder);
    if (!entries.length) return;
    activityHolder.append(
      h(
        'section',
        { class: 'card' },
        h('h2', {}, t('sessions.activity')),
        h('ul', { class: 'activity-list' }, entries.map((e) => h('li', {}, h('span', { class: 'activity-text' }, h('strong', {}, e.userName), ' – ', auditText(e)), h('time', { class: 'muted small', datetime: new Date(e.ts).toISOString() }, formatDateTime(e.ts))))),
      ),
    );
  }

  // --- Lifecycle -------------------------------------------------------------------------------

  function renderAll() {
    const s = find();
    renderedStatus = s.status;
    renderHeader();
    renderSummary();
    fill(tableHolder, buildTable());
    renderActivity();
    scanPanel = null;
    clear(panelHolder);
    if (isCountingStatus(s.status) && perms.count) {
      scanPanel = buildScanPanel();
      panelHolder.append(scanPanel.el);
    }
    fill(root, headerHolder, noticeHolder, panelHolder, summaryHolder, tableHolder, activityHolder);
    if (scanPanel && s.status === 'open' && matchMedia('(pointer: fine)').matches) scanPanel.focus();
  }

  renderAll();
  return {
    refresh() {
      const s = find();
      if (!s) {
        navigate('sessions');
        return;
      }
      if (s.status !== renderedStatus) {
        renderAll();
        return;
      }
      renderHeader();
      renderSummary();
      table.refresh();
      renderActivity();
    },
  };
}
