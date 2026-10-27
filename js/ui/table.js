// Data table with search, filters, sorting and pagination.
// Keeps its own view state (query, sort, page) across data refreshes.

import { h, clear, fill, nextId, debounce } from './dom.js';
import { icon } from './icons.js';
import { t, getLocale } from '../i18n.js';
import { emptyState } from './components.js';

/**
 * config:
 *  caption, columns: [{ key, label, sortable, sortValue(row), render(row), className, headerClass }]
 *  getRows(): all rows (before search / filters)
 *  rowKey(row), searchText(row), searchPlaceholder
 *  filters: [{ key, label, options: [{ value, label }], predicate(row, value) }]
 *  defaultSort: { key, dir }, pageSize, empty: { title, text, action }, toolbarExtra: Node[]
 *  rowClass(row)
 */
export function createTable(config) {
  const view = {
    query: '',
    sort: config.defaultSort ? { ...config.defaultSort } : null,
    page: 1,
    pageSize: config.pageSize || 10,
    filters: Object.fromEntries((config.filters || []).map((f) => [f.key, f.initial ?? ''])),
  };
  const collator = new Intl.Collator(getLocale(), { numeric: true, sensitivity: 'base' });
  const id = nextId('tbl');

  const searchInput = h('input', {
    type: 'search',
    class: 'input search-input',
    placeholder: config.searchPlaceholder || t('common.search'),
    'aria-label': config.searchPlaceholder || t('common.search'),
    autocomplete: 'off',
    'data-focus-id': `${id}-search`,
    onInput: debounce((e) => {
      view.query = e.target.value;
      view.page = 1;
      render();
    }, 150),
  });
  const filterEls = (config.filters || []).map((f) => {
    const select = h(
      'select',
      {
        class: 'input',
        'aria-label': f.label,
        onChange: (e) => {
          view.filters[f.key] = e.target.value;
          view.page = 1;
          render();
        },
      },
      h('option', { value: '' }, f.allLabel || f.label),
      f.options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(view.filters[f.key]) }, o.label)),
    );
    return select;
  });

  const toolbar = h(
    'div',
    { class: 'table-toolbar' },
    h('div', { class: 'search-wrap' }, icon('search'), searchInput),
    ...filterEls,
    h('div', { class: 'toolbar-extra' }, config.toolbarExtra || []),
  );
  const tableWrap = h('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': config.caption });
  const footer = h('div', { class: 'table-footer' });
  const el = h('div', { class: 'table-card' }, toolbar, tableWrap, footer);

  function derive() {
    let rows = config.getRows();
    for (const f of config.filters || []) {
      const value = view.filters[f.key];
      if (value !== '' && value !== undefined) rows = rows.filter((r) => f.predicate(r, value));
    }
    const q = view.query.trim().toLowerCase();
    if (q && config.searchText) rows = rows.filter((r) => config.searchText(r).toLowerCase().includes(q));
    if (view.sort) {
      const col = config.columns.find((c) => c.key === view.sort.key);
      if (col) {
        const get = col.sortValue || ((r) => r[col.key]);
        const dir = view.sort.dir === 'desc' ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          if (va === vb) return 0;
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
          return collator.compare(String(va), String(vb)) * dir;
        });
      }
    }
    return rows;
  }

  function headerCell(col) {
    const isSorted = view.sort?.key === col.key;
    const th = h('th', {
      scope: 'col',
      class: col.headerClass || col.className || '',
      'aria-sort': col.sortable ? (isSorted ? (view.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : null,
    });
    if (!col.sortable) {
      th.append(col.label);
      return th;
    }
    th.append(
      h(
        'button',
        {
          type: 'button',
          class: 'sort-btn',
          'data-focus-id': `${id}-sort-${col.key}`,
          onClick: () => {
            view.sort = isSorted && view.sort.dir === 'asc' ? { key: col.key, dir: 'desc' } : { key: col.key, dir: 'asc' };
            render();
          },
        },
        h('span', {}, col.label),
        isSorted ? icon(view.sort.dir === 'asc' ? 'sortUp' : 'sortDown', { size: 14 }) : null,
      ),
    );
    return th;
  }

  function render() {
    const active = document.activeElement;
    const focusId = el.contains(active) ? active.getAttribute?.('data-focus-id') : null;
    const selection = active instanceof HTMLInputElement && active.type !== 'number' ? [active.selectionStart, active.selectionEnd] : null;

    const all = config.getRows();
    const rows = derive();
    const pages = Math.max(1, Math.ceil(rows.length / view.pageSize));
    view.page = Math.min(view.page, pages);
    const start = (view.page - 1) * view.pageSize;
    const pageRows = rows.slice(start, start + view.pageSize);

    clear(tableWrap);
    if (all.length === 0 && config.empty) {
      tableWrap.append(emptyState(config.empty));
    } else if (rows.length === 0) {
      tableWrap.append(emptyState({ title: t('table.noMatches'), text: t('table.noMatchesHint') }));
    } else {
      tableWrap.append(
        h(
          'table',
          { class: 'table' },
          h('caption', { class: 'sr-only' }, config.caption),
          h('thead', {}, h('tr', {}, config.columns.map(headerCell))),
          h(
            'tbody',
            {},
            pageRows.map((row) =>
              h(
                'tr',
                { class: config.rowClass ? config.rowClass(row) : '', 'data-key': config.rowKey(row) },
                config.columns.map((col) => {
                  const content = col.render ? col.render(row) : row[col.key];
                  const cell = h(col.rowHeader ? 'th' : 'td', { class: col.className || '', scope: col.rowHeader ? 'row' : null });
                  fill(cell, content ?? '');
                  if (col.label && col.mobileLabel !== false) cell.setAttribute('data-label', col.label);
                  return cell;
                }),
              ),
            ),
          ),
        ),
      );
    }

    clear(footer);
    if (rows.length > 0) {
      footer.append(
        h(
          'p',
          { class: 'muted table-info', 'aria-live': 'polite' },
          t('table.showing', { from: start + 1, to: start + pageRows.length, total: rows.length }),
        ),
        h(
          'div',
          { class: 'pager' },
          h(
            'label',
            { class: 'pager-size' },
            h('span', { class: 'muted' }, t('table.rowsPerPage')),
            h(
              'select',
              {
                class: 'input input-sm',
                onChange: (e) => {
                  view.pageSize = Number(e.target.value);
                  view.page = 1;
                  render();
                },
              },
              [10, 25, 50].map((n) => h('option', { value: n, selected: n === view.pageSize }, n)),
            ),
          ),
          h(
            'button',
            { type: 'button', class: 'icon-btn', disabled: view.page <= 1, 'aria-label': t('table.previous'), onClick: () => { view.page -= 1; render(); } },
            icon('chevronLeft'),
          ),
          h('span', { class: 'pager-page' }, t('table.pageOf', { page: view.page, pages })),
          h(
            'button',
            { type: 'button', class: 'icon-btn', disabled: view.page >= pages, 'aria-label': t('table.next'), onClick: () => { view.page += 1; render(); } },
            icon('chevronRight'),
          ),
        ),
      );
    }

    if (focusId) {
      const target = el.querySelector(`[data-focus-id="${CSS.escape(focusId)}"]`);
      if (target) {
        target.focus({ preventScroll: true });
        if (selection && target instanceof HTMLInputElement) target.setSelectionRange(selection[0], selection[1]);
      }
    }
  }

  render();
  return {
    el,
    refresh: render,
    getVisibleRows: derive,
    state: view,
    setFilter(key, value) {
      view.filters[key] = value;
      const index = (config.filters || []).findIndex((f) => f.key === key);
      if (index >= 0) filterEls[index].value = value;
      view.page = 1;
      render();
    },
  };
}
