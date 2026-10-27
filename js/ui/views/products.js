// Product catalogue: table, create/edit/delete, CSV import and export.

import { h, clear, fill, downloadText } from '../dom.js';
import { icon } from '../icons.js';
import { badge, button, confirmDialog, formDialog, openDialog, pageHeader, reportError, toast } from '../components.js';
import { createTable } from '../table.js';
import { t, formatNumber, formatMoney, categoryLabel } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { saveProduct, deleteProduct, importProducts, logExport } from '../../core/actions.js';
import { can } from '../../domain/permissions.js';
import { UNITS } from '../../domain/validation.js';
import { KNOWN_CATEGORIES } from '../../domain/categories.js';
import { PRODUCT_CSV_COLUMNS, parseProductsCSV, productsToCSV, toCSV } from '../../domain/csv.js';
import { normalizeCategory, productName, unitLabel, warehouseName } from '../format.js';

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function mountProducts(root, { user }) {
  const canEdit = can(user.role, 'products.edit');
  const canDelete = can(user.role, 'products.delete');
  const canImport = can(user.role, 'products.import');

  const locationsById = () => new Map(getData().locations.map((l) => [l.id, l]));
  const warehousesById = () => new Map(getData().warehouses.map((w) => [w.id, w]));

  const rows = () => {
    const locs = locationsById();
    return getData().products.map((p) => ({ ...p, location: locs.get(p.locationId) }));
  };

  const categories = () => {
    const all = new Set([...KNOWN_CATEGORIES, ...getData().products.map((p) => p.category)]);
    return [...all];
  };

  function productForm(product = null) {
    const data = getData();
    const wh = warehousesById();
    const listId = 'category-options';
    const datalist = h('datalist', { id: listId }, categories().map((c) => h('option', { value: categoryLabel(c) })));
    formDialog({
      title: product ? t('products.edit') : t('products.add'),
      size: 'lg',
      extra: datalist,
      fields: [
        { name: 'sku', label: t('products.sku'), value: product?.sku ?? '', required: true, hint: t('products.skuHint'), maxLength: 24 },
        { name: 'barcode', label: t('products.barcode'), value: product?.barcode ?? '', hint: t('products.barcodeHint'), maxLength: 32, inputMode: 'numeric' },
        { name: 'name', label: t('products.name'), value: product ? productName(product) : '', required: true, wide: true, maxLength: 80 },
        { name: 'category', label: t('products.category'), value: product ? categoryLabel(product.category) : '', required: true, list: listId, maxLength: 40 },
        { name: 'unit', label: t('products.unit'), type: 'select', value: product?.unit ?? 'pcs', options: UNITS.map((u) => ({ value: u, label: unitLabel(u) })) },
        {
          name: 'locationId',
          label: t('products.location'),
          type: 'select',
          value: product?.locationId ?? '',
          required: true,
          options: [
            { value: '', label: t('products.selectLocation') },
            ...data.locations.map((l) => ({ value: l.id, label: `${l.code} — ${warehouseName(wh.get(l.warehouseId))}` })),
          ],
        },
        { name: 'expected', label: t('products.expected'), type: 'number', value: product?.expected ?? 0, min: 0, required: true, inputMode: 'numeric', hint: t('products.expectedHint') },
        { name: 'unitCost', label: t('products.unitCost'), value: product?.unitCost ?? '', inputMode: 'decimal', hint: t('products.unitCostHint') },
      ],
      onSubmit: (values) => {
        const saved = saveProduct({ ...values, category: normalizeCategory(values.category) }, product?.id ?? null);
        toast(t(product ? 'products.saved' : 'products.created', { name: saved.name }), 'success');
      },
    });
  }

  async function remove(product) {
    const ok = await confirmDialog({ title: t('products.delete'), message: t('products.deleteConfirm', { name: productName(product) }), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      deleteProduct(product.id);
      toast(t('products.deleted'), 'success');
    } catch (e) {
      reportError(e);
    }
  }

  function exportCsv() {
    const visible = table.getVisibleRows();
    if (visible.length === 0) {
      toast(t('table.noMatches'), 'error');
      return;
    }
    const ordered = visible.map(({ location, ...p }) => p);
    downloadText(`products-${new Date().toISOString().slice(0, 10)}.csv`, productsToCSV(ordered, locationsById()));
    logExport('products', { count: ordered.length });
    toast(t('products.exported', { n: ordered.length }), 'success');
  }

  function downloadTemplate() {
    const first = getData().locations[0]?.code ?? 'MAIN-A-01';
    const sample = [PRODUCT_CSV_COLUMNS, ['DEM-0001', '5901234123457', 'Sample product', 'office', 'pcs', first, 25, '4.90']];
    downloadText('products-template.csv', toCSV(sample, { bom: true }));
  }

  function importDialog() {
    let parsed = null;
    const preview = h('div', { class: 'import-preview' });
    const status = h('p', { class: 'muted', 'aria-live': 'polite' }, t('import.choose'));
    const fileInput = h('input', {
      type: 'file',
      accept: '.csv,text/csv',
      class: 'input',
      id: 'import-file',
      'aria-describedby': 'import-help',
      onChange: async (e) => {
        const file = e.target.files?.[0];
        parsed = null;
        confirm.disabled = true;
        clear(preview);
        if (!file) return;
        if (file.size > MAX_IMPORT_BYTES) {
          status.textContent = t('import.tooLarge');
          return;
        }
        status.textContent = t('common.loading');
        try {
          const text = await file.text();
          parsed = parseProductsCSV(text, { products: getData().products, locations: getData().locations, normalizeCategory });
          renderPreview();
        } catch (err) {
          console.error(err);
          status.textContent = t('import.readError');
        }
      },
    });
    const confirm = h('button', { type: 'button', class: 'btn btn-primary', disabled: true, onClick: () => run() }, t('import.run'));

    function renderPreview() {
      clear(preview);
      if (parsed.fatal) {
        status.textContent = '';
        preview.append(h('div', { class: 'alert alert-error', role: 'alert' }, t(parsed.fatal.key, parsed.fatal.params)));
        return;
      }
      const { create, update, invalid } = parsed.counts;
      status.textContent = t('import.summary', { create, update, invalid });
      confirm.disabled = create + update === 0;
      confirm.textContent = t('import.runN', { n: create + update });
      const shown = parsed.rows.slice(0, 100);
      preview.append(
        h(
          'div',
          { class: 'table-wrap import-table', tabindex: '0', role: 'region', 'aria-label': t('import.preview') },
          h(
            'table',
            { class: 'table table-compact' },
            h('thead', {}, h('tr', {}, ['#', t('products.sku'), t('products.name'), t('import.result')].map((c) => h('th', { scope: 'col' }, c)))),
            h(
              'tbody',
              {},
              shown.map((r) =>
                h(
                  'tr',
                  {},
                  h('td', {}, r.line),
                  h('td', {}, r.input.sku || '—'),
                  h('td', {}, r.input.name || '—'),
                  h(
                    'td',
                    {},
                    r.action === 'invalid'
                      ? h('div', {}, badge(t('import.invalid'), 'danger'), h('ul', { class: 'error-list' }, Object.entries(r.errors).map(([f, err]) => h('li', {}, `${t(`import.field.${f}`)}: ${t(err.key, err.params)}`))))
                      : badge(t(r.action === 'create' ? 'import.create' : 'import.update'), r.action === 'create' ? 'success' : 'info'),
                  ),
                ),
              ),
            ),
          ),
        ),
        parsed.rows.length > shown.length ? h('p', { class: 'muted small' }, t('import.truncated', { n: shown.length })) : null,
      );
    }

    function run() {
      try {
        const result = importProducts(parsed.rows);
        toast(t('import.done', result), 'success');
        dlg.close();
      } catch (e) {
        reportError(e);
      }
    }

    const dlg = openDialog({
      title: t('import.title'),
      size: 'lg',
      body: h(
        'div',
        { class: 'import' },
        h('p', { id: 'import-help', class: 'muted' }, t('import.help', { columns: PRODUCT_CSV_COLUMNS.join(', ') })),
        h('div', { class: 'field' }, h('label', { for: 'import-file' }, t('import.file')), fileInput),
        button(t('import.template'), { iconName: 'download', onClick: downloadTemplate }),
        status,
        preview,
      ),
      actions: [h('button', { type: 'button', class: 'btn', onClick: () => dlg.close() }, t('common.cancel')), confirm],
    });
  }

  const table = createTable({
    caption: t('nav.products'),
    searchPlaceholder: t('products.search'),
    rowKey: (r) => r.id,
    getRows: rows,
    searchText: (r) => [r.sku, r.barcode, r.name, productName(r), categoryLabel(r.category), r.location?.code].join(' '),
    defaultSort: { key: 'sku', dir: 'asc' },
    filters: [
      {
        key: 'category',
        label: t('products.category'),
        allLabel: t('products.allCategories'),
        options: categories().map((c) => ({ value: c, label: categoryLabel(c) })),
        predicate: (r, v) => r.category === v,
      },
      {
        key: 'warehouse',
        label: t('products.warehouse'),
        allLabel: t('products.allWarehouses'),
        options: getData().warehouses.map((w) => ({ value: w.id, label: warehouseName(w) })),
        predicate: (r, v) => r.location?.warehouseId === v,
      },
    ],
    columns: [
      { key: 'sku', label: t('products.sku'), sortable: true, rowHeader: true, className: 'mono', render: (r) => r.sku },
      { key: 'name', label: t('products.name'), sortable: true, sortValue: (r) => productName(r), render: (r) => h('div', {}, h('div', { class: 'strong' }, productName(r)), r.barcode ? h('div', { class: 'muted small mono' }, r.barcode) : null) },
      { key: 'category', label: t('products.category'), sortable: true, sortValue: (r) => categoryLabel(r.category), render: (r) => badge(categoryLabel(r.category)) },
      { key: 'location', label: t('products.location'), sortable: true, sortValue: (r) => r.location?.code, className: 'mono', render: (r) => r.location?.code ?? '—' },
      { key: 'unit', label: t('products.unit'), sortable: true, sortValue: (r) => unitLabel(r.unit), render: (r) => unitLabel(r.unit), className: 'hide-sm' },
      { key: 'expected', label: t('products.expected'), sortable: true, className: 'num', render: (r) => formatNumber(r.expected) },
      { key: 'unitCost', label: t('products.unitCost'), sortable: true, className: 'num hide-sm', render: (r) => formatMoney(r.unitCost || 0) },
      ...(canEdit
        ? [
            {
              key: 'actions',
              label: t('common.actions'),
              mobileLabel: false,
              className: 'actions',
              render: (r) =>
                h(
                  'div',
                  { class: 'row-actions' },
                  h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${t('common.edit')}: ${r.sku}`, title: t('common.edit'), onClick: () => productForm(r) }, icon('edit')),
                  canDelete ? h('button', { type: 'button', class: 'icon-btn icon-btn-danger', 'aria-label': `${t('common.delete')}: ${r.sku}`, title: t('common.delete'), onClick: () => remove(r) }, icon('trash')) : null,
                ),
            },
          ]
        : []),
    ],
    empty: { title: t('products.empty'), text: t('products.emptyHint'), action: canEdit ? button(t('products.add'), { variant: 'primary', iconName: 'plus', onClick: () => productForm() }) : null },
  });

  const actions = [
    button(t('products.exportCsv'), { iconName: 'download', onClick: exportCsv }),
    canImport ? button(t('import.title'), { iconName: 'upload', onClick: importDialog }) : null,
    canEdit ? button(t('products.add'), { variant: 'primary', iconName: 'plus', onClick: () => productForm() }) : null,
  ];

  fill(root, 
    pageHeader(t('nav.products'), t('products.subtitle'), actions),
    canEdit ? null : h('div', { class: 'alert alert-info' }, icon('info'), h('span', {}, t('products.readOnly'))),
    table.el,
  );
  const signature = () => [...categories(), ...getData().warehouses.map((w) => w.id)].join('|');
  const initial = signature();
  return {
    refresh: () => (signature() === initial ? table.refresh() : mountProducts(root, { user })),
  };
}

