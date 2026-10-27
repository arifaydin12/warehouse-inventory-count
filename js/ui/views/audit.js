// Activity / audit log.

import { h, fill, downloadText } from '../dom.js';
import { badge, button, pageHeader, toast } from '../components.js';
import { createTable } from '../table.js';
import { t, formatDateTime } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { logExport } from '../../core/actions.js';
import { toCSV } from '../../domain/csv.js';
import { auditText } from '../format.js';

const GROUPS = ['auth', 'product', 'warehouse', 'location', 'session', 'user', 'export', 'data'];
const TONES = { auth: 'neutral', product: 'info', warehouse: 'info', location: 'info', session: 'warn', user: 'danger', export: 'neutral', data: 'danger' };

const groupOf = (entry) => entry.action.split('.')[0];

export function mountAudit(root) {
  function exportCsv() {
    const rows = table.getVisibleRows();
    if (!rows.length) {
      toast(t('table.noMatches'), 'error');
      return;
    }
    const csv = toCSV([
      ['time', 'user', 'action', 'description'],
      ...rows.map((e) => [new Date(e.ts).toISOString(), e.userName, e.action, auditText(e)]),
    ], { bom: true });
    downloadText(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    logExport('audit', { count: rows.length });
    toast(t('products.exported', { n: rows.length }), 'success');
  }

  const table = createTable({
    caption: t('nav.audit'),
    searchPlaceholder: t('audit.search'),
    rowKey: (e) => e.id,
    getRows: () => getData().audit,
    searchText: (e) => `${e.userName} ${auditText(e)}`,
    defaultSort: { key: 'ts', dir: 'desc' },
    filters: [
      { key: 'group', label: t('audit.type'), allLabel: t('audit.allTypes'), options: GROUPS.map((g) => ({ value: g, label: t(`audit.group.${g}`) })), predicate: (e, v) => groupOf(e) === v },
      { key: 'user', label: t('audit.user'), allLabel: t('audit.allUsers'), options: getData().users.map((u) => ({ value: u.id, label: u.name })), predicate: (e, v) => e.userId === v },
    ],
    columns: [
      { key: 'ts', label: t('audit.time'), sortable: true, rowHeader: true, className: 'nowrap', render: (e) => h('time', { datetime: new Date(e.ts).toISOString() }, formatDateTime(e.ts)) },
      { key: 'userName', label: t('audit.user'), sortable: true, render: (e) => e.userName },
      { key: 'group', label: t('audit.type'), sortable: true, sortValue: (e) => t(`audit.group.${groupOf(e)}`), className: 'hide-sm', render: (e) => badge(t(`audit.group.${groupOf(e)}`), TONES[groupOf(e)] || 'neutral') },
      { key: 'text', label: t('audit.description'), sortable: false, render: (e) => auditText(e) },
    ],
    empty: { title: t('audit.empty') },
  });

  fill(root, pageHeader(t('nav.audit'), t('audit.subtitle'), [button(t('products.exportCsv'), { iconName: 'download', onClick: exportCsv })]), table.el);
  return { refresh: () => table.refresh() };
}
