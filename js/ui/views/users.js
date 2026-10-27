// User management (admin only).

import { h, fill } from '../dom.js';
import { icon } from '../icons.js';
import { badge, button, confirmDialog, formDialog, pageHeader, reportError, toast } from '../components.js';
import { createTable } from '../table.js';
import { t, formatDate } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { saveUser, deleteUser } from '../../core/actions.js';
import { ROLES } from '../../domain/permissions.js';

export function mountUsers(root, { user: actor }) {
  function userForm(user = null) {
    formDialog({
      title: user ? t('users.edit') : t('users.add'),
      fields: [
        { name: 'name', label: t('users.name'), value: user?.name ?? '', required: true, maxLength: 50, autocomplete: 'off' },
        { name: 'role', label: t('users.role'), type: 'select', value: user?.role ?? 'operator', options: ROLES.map((r) => ({ value: r, label: t(`role.${r}`) })) },
        { name: 'pin', label: t('users.pin'), value: '', type: 'password', inputMode: 'numeric', maxLength: 4, required: !user, hint: user ? t('users.pinKeepHint') : t('users.pinHint'), autocomplete: 'new-password' },
      ],
      onSubmit: async (values) => {
        await saveUser(values, user?.id ?? null);
        toast(t('users.saved'), 'success');
      },
    });
  }

  async function remove(user) {
    const ok = await confirmDialog({ title: t('users.delete'), message: t('users.deleteConfirm', { name: user.name }), confirmLabel: t('common.delete'), danger: true });
    if (!ok) return;
    try {
      deleteUser(user.id);
      toast(t('users.deleted'), 'success');
    } catch (e) {
      reportError(e);
    }
  }

  const table = createTable({
    caption: t('nav.users'),
    searchPlaceholder: t('users.search'),
    rowKey: (u) => u.id,
    getRows: () => getData().users,
    searchText: (u) => `${u.name} ${t(`role.${u.role}`)}`,
    defaultSort: { key: 'name', dir: 'asc' },
    filters: [{ key: 'role', label: t('users.role'), allLabel: t('users.allRoles'), options: ROLES.map((r) => ({ value: r, label: t(`role.${r}`) })), predicate: (u, v) => u.role === v }],
    columns: [
      { key: 'name', label: t('users.name'), sortable: true, rowHeader: true, render: (u) => h('span', { class: 'strong' }, u.name, u.id === actor.id ? [' ', badge(t('users.you'), 'info')] : null) },
      { key: 'role', label: t('users.role'), sortable: true, sortValue: (u) => t(`role.${u.role}`), render: (u) => badge(t(`role.${u.role}`), u.role === 'admin' ? 'info' : u.role === 'manager' ? 'warn' : 'neutral') },
      { key: 'createdAt', label: t('users.created'), sortable: true, className: 'hide-sm', render: (u) => formatDate(u.createdAt) },
      {
        key: 'actions',
        label: t('common.actions'),
        mobileLabel: false,
        className: 'actions',
        render: (u) =>
          h(
            'div',
            { class: 'row-actions' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${t('common.edit')}: ${u.name}`, onClick: () => userForm(u) }, icon('edit')),
            h('button', { type: 'button', class: 'icon-btn icon-btn-danger', 'aria-label': `${t('common.delete')}: ${u.name}`, onClick: () => remove(u) }, icon('trash')),
          ),
      },
    ],
    empty: { title: t('users.empty') },
  });

  fill(root, 
    pageHeader(t('nav.users'), t('users.subtitle'), [button(t('users.add'), { variant: 'primary', iconName: 'plus', onClick: () => userForm() })]),
    table.el,
  );
  return { refresh: () => table.refresh() };
}
