// Warehouses and storage locations.

import { h, clear, fill } from '../dom.js';
import { icon } from '../icons.js';
import { badge, button, confirmDialog, emptyState, formDialog, openDialog, pageHeader, reportError, toast } from '../components.js';
import { t, tn, formatNumber } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { saveWarehouse, deleteWarehouse, addLocation, deleteLocation, ValidationError } from '../../core/actions.js';
import { can } from '../../domain/permissions.js';
import { warehouseName } from '../format.js';

export function mountWarehouses(root, { user }) {
  const canEdit = can(user.role, 'warehouses.edit');
  const canDelete = can(user.role, 'warehouses.delete');
  let locationsDialog = null;

  function stats(warehouse) {
    const data = getData();
    const locations = data.locations.filter((l) => l.warehouseId === warehouse.id);
    const ids = new Set(locations.map((l) => l.id));
    const products = data.products.filter((p) => ids.has(p.locationId));
    return { locations, products, units: products.reduce((n, p) => n + p.expected, 0) };
  }

  function warehouseForm(warehouse = null) {
    formDialog({
      title: warehouse ? t('warehouses.edit') : t('warehouses.add'),
      fields: [
        { name: 'name', label: t('warehouses.name'), value: warehouse ? warehouseName(warehouse) : '', required: true, maxLength: 60 },
        { name: 'code', label: t('warehouses.code'), value: warehouse?.code ?? '', required: true, hint: t('warehouses.codeHint'), maxLength: 8 },
      ],
      onSubmit: (values) => {
        saveWarehouse(values, warehouse?.id ?? null);
        toast(t('warehouses.saved'), 'success');
      },
    });
  }

  async function remove(warehouse) {
    const ok = await confirmDialog({ title: t('warehouses.delete'), message: t('warehouses.deleteConfirm', { name: warehouseName(warehouse) }), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      deleteWarehouse(warehouse.id);
      toast(t('warehouses.deleted'), 'success');
    } catch (e) {
      reportError(e);
    }
  }

  function manageLocations(warehouse) {
    const list = h('ul', { class: 'location-list' });
    const codeInput = h('input', { id: 'new-location', class: 'input', maxlength: 20, autocomplete: 'off', placeholder: `${warehouse.code}-A-01`, autocapitalize: 'characters' });
    const error = h('p', { class: 'field-error', role: 'alert', hidden: true });

    function renderList() {
      const data = getData();
      clear(list);
      const locations = data.locations.filter((l) => l.warehouseId === warehouse.id);
      if (locations.length === 0) list.append(h('li', { class: 'muted' }, t('locations.empty')));
      for (const l of locations) {
        const count = data.products.filter((p) => p.locationId === l.id).length;
        list.append(
          h(
            'li',
            {},
            h('span', { class: 'mono strong' }, l.code),
            h('span', { class: 'muted small' }, tn('locations.products', count)),
            canEdit
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'icon-btn icon-btn-danger',
                    'aria-label': `${t('common.delete')}: ${l.code}`,
                    onClick: () => {
                      try {
                        deleteLocation(l.id);
                        renderList();
                      } catch (e) {
                        reportError(e);
                      }
                    },
                  },
                  icon('trash'),
                )
              : null,
          ),
        );
      }
    }
    renderList();

    const form = h(
      'form',
      {
        class: 'inline-form',
        novalidate: true,
        onSubmit: (e) => {
          e.preventDefault();
          error.hidden = true;
          codeInput.removeAttribute('aria-invalid');
          try {
            addLocation(warehouse.id, { code: codeInput.value });
            codeInput.value = '';
            renderList();
            codeInput.focus();
          } catch (err) {
            if (err instanceof ValidationError) {
              error.textContent = t(err.errors.code.key, err.errors.code.params);
              error.hidden = false;
              codeInput.setAttribute('aria-invalid', 'true');
              codeInput.focus();
            } else reportError(err);
          }
        },
      },
      h('label', { for: 'new-location', class: 'sr-only' }, t('locations.code')),
      codeInput,
      button(t('locations.add'), { variant: 'primary', iconName: 'plus', type: 'submit' }),
    );

    locationsDialog = openDialog({
      title: t('locations.title', { name: warehouseName(warehouse) }),
      body: h('div', {}, list, canEdit ? form : null, error),
      onClose: () => {
        locationsDialog = null;
      },
    });
  }

  function render() {
    const data = getData();
    const cards = data.warehouses.map((w) => {
      const s = stats(w);
      return h(
        'section',
        { class: 'card warehouse-card', 'aria-labelledby': `wh-${w.id}` },
        h('div', { class: 'card-head' }, h('div', {}, h('h2', { id: `wh-${w.id}` }, warehouseName(w)), badge(w.code, 'info')), h(
          'div',
          { class: 'row-actions' },
          canEdit ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${t('common.edit')}: ${warehouseName(w)}`, onClick: () => warehouseForm(w) }, icon('edit')) : null,
          canDelete ? h('button', { type: 'button', class: 'icon-btn icon-btn-danger', 'aria-label': `${t('common.delete')}: ${warehouseName(w)}`, onClick: () => remove(w) }, icon('trash')) : null,
        )),
        h(
          'dl',
          { class: 'stat-list' },
          h('div', {}, h('dt', {}, t('warehouses.locations')), h('dd', {}, formatNumber(s.locations.length))),
          h('div', {}, h('dt', {}, t('warehouses.products')), h('dd', {}, formatNumber(s.products.length))),
          h('div', {}, h('dt', {}, t('warehouses.units')), h('dd', {}, formatNumber(s.units))),
        ),
        h('ul', { class: 'chips' }, s.locations.map((l) => h('li', { class: 'chip mono' }, l.code))),
        h('div', { class: 'card-foot' }, button(canEdit ? t('warehouses.manageLocations') : t('warehouses.viewLocations'), { iconName: 'warehouse', onClick: () => manageLocations(w) })),
      );
    });
    fill(root, 
      pageHeader(t('nav.warehouses'), t('warehouses.subtitle'), canEdit ? [button(t('warehouses.add'), { variant: 'primary', iconName: 'plus', onClick: () => warehouseForm() })] : []),
      cards.length ? h('div', { class: 'grid grid-3' }, cards) : emptyState({ title: t('warehouses.empty'), text: t('warehouses.emptyHint') }),
    );
  }
  render();
  return {
    refresh() {
      render();
    },
    destroy() {
      locationsDialog?.close();
    },
  };
}

