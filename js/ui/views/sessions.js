// Counting sessions list and "new session" dialog.

import { h, fill } from '../dom.js';
import { badge, button, formDialog, pageHeader, progressBar, statusTone, toast } from '../components.js';
import { createTable } from '../table.js';
import { t, formatDate, formatPercent, formatNumber } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { createSession } from '../../core/actions.js';
import { can } from '../../domain/permissions.js';
import { summarize } from '../../domain/discrepancy.js';
import { SESSION_STATUSES } from '../../domain/workflow.js';
import { sessionName, statusLabel, userNameById, warehouseById, warehouseName } from '../format.js';

export function mountSessions(root, { user, navigate }) {
  const canCreate = can(user.role, 'sessions.create');

  function newSession() {
    const data = getData();
    const dlg = formDialog({
      title: t('sessions.new'),
      intro: t('sessions.newIntro'),
      submitLabel: t('sessions.create'),
      fields: [
        { name: 'name', label: t('sessions.name'), value: '', required: true, maxLength: 80, wide: true },
        {
          name: 'warehouseId',
          label: t('sessions.warehouse'),
          type: 'select',
          required: true,
          value: data.warehouses[0]?.id ?? '',
          options: data.warehouses.map((w) => ({ value: w.id, label: warehouseName(w) })),
        },
        { name: 'locationId', label: t('sessions.scope'), type: 'select', value: '', options: [] },
      ],
      onSubmit: (values) => {
        const session = createSession(values);
        toast(t('sessions.created'), 'success');
        navigate(`sessions/${encodeURIComponent(session.id)}`);
      },
    });
    const { warehouseId, locationId } = dlg.fields;
    const fillLocations = () => {
      const options = [
        h('option', { value: '' }, t('sessions.allLocations')),
        ...getData()
          .locations.filter((l) => l.warehouseId === warehouseId.input.value)
          .map((l) => h('option', { value: l.id }, l.code)),
      ];
      locationId.input.replaceChildren(...options);
    };
    warehouseId.input.addEventListener('change', fillLocations);
    fillLocations();
  }

  const table = createTable({
    caption: t('nav.sessions'),
    searchPlaceholder: t('sessions.search'),
    rowKey: (s) => s.id,
    getRows: () => getData().sessions.map((s) => ({ ...s, summary: summarize(s.lines) })),
    searchText: (s) => [sessionName(s), s.name, warehouseById(s.warehouseId), statusLabel(s.status)].join(' '),
    defaultSort: { key: 'createdAt', dir: 'desc' },
    filters: [
      { key: 'status', label: t('sessions.status'), allLabel: t('sessions.allStatuses'), options: SESSION_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })), predicate: (s, v) => s.status === v },
      { key: 'warehouse', label: t('sessions.warehouse'), allLabel: t('products.allWarehouses'), options: getData().warehouses.map((w) => ({ value: w.id, label: warehouseName(w) })), predicate: (s, v) => s.warehouseId === v },
    ],
    columns: [
      {
        key: 'name',
        label: t('sessions.name'),
        sortable: true,
        rowHeader: true,
        sortValue: (s) => sessionName(s),
        render: (s) => h('a', { href: `#/sessions/${encodeURIComponent(s.id)}`, class: 'link-strong' }, sessionName(s)),
      },
      { key: 'warehouse', label: t('sessions.warehouse'), sortable: true, sortValue: (s) => warehouseById(s.warehouseId), render: (s) => warehouseById(s.warehouseId), className: 'hide-sm' },
      { key: 'status', label: t('sessions.status'), sortable: true, sortValue: (s) => statusLabel(s.status), render: (s) => badge(statusLabel(s.status), statusTone(s.status)) },
      {
        key: 'progress',
        label: t('sessions.progress'),
        sortable: true,
        sortValue: (s) => s.summary.progress,
        render: (s) => h('div', { class: 'progress-cell' }, progressBar(s.summary.progress, `${sessionName(s)}: ${formatPercent(s.summary.progress)}`), h('span', { class: 'small' }, `${formatNumber(s.summary.counted)}/${formatNumber(s.summary.total)}`)),
      },
      {
        key: 'discrepancies',
        label: t('sessions.discrepancies'),
        sortable: true,
        className: 'num',
        sortValue: (s) => s.summary.shortageLines + s.summary.surplusLines,
        render: (s) => {
          const n = s.summary.shortageLines + s.summary.surplusLines;
          return n ? badge(formatNumber(n), 'danger') : h('span', { class: 'muted' }, s.summary.counted ? '0' : '—');
        },
      },
      { key: 'createdAt', label: t('sessions.createdAt'), sortable: true, className: 'hide-sm', render: (s) => h('div', {}, h('div', {}, formatDate(s.createdAt)), h('div', { class: 'muted small' }, userNameById(s.createdBy))) },
    ],
    empty: { title: t('sessions.empty'), text: t('sessions.emptyHint'), action: canCreate ? button(t('sessions.new'), { variant: 'primary', iconName: 'plus', onClick: newSession }) : null },
  });

  fill(root, 
    pageHeader(t('nav.sessions'), t('sessions.subtitle'), canCreate ? [button(t('sessions.new'), { variant: 'primary', iconName: 'plus', onClick: newSession })] : []),
    table.el,
  );
  return { refresh: () => table.refresh() };
}
