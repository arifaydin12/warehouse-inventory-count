// Login screen: choose a demo user and enter the PIN.

import { h, clear, fill } from '../dom.js';
import { icon } from '../icons.js';
import { badge, button, confirmDialog, toast, reportError } from '../components.js';
import { languageSelect, themeToggle } from '../controls.js';
import { t } from '../../i18n.js';
import { getData } from '../../core/store.js';
import { login, lockoutSeconds, resetDemoData, ActionError } from '../../core/actions.js';
import { DEMO_PIN } from '../../core/seed.js';

export function mountLogin(root, { onSuccess }) {
  const users = getData().users;
  let selected = users.find((u) => u.role === 'admin')?.id ?? users[0]?.id ?? null;
  let timer = null;

  const error = h('p', { class: 'alert alert-error', role: 'alert', hidden: true, id: 'login-error' });
  const pin = h('input', {
    id: 'pin',
    class: 'input pin-input',
    type: 'password',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    maxlength: 4,
    autocomplete: 'off',
    'aria-describedby': 'pin-hint login-error',
    placeholder: '••••',
  });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, icon('lock'), h('span', {}, t('login.signIn')));

  const userList = h('div', { class: 'user-list', role: 'radiogroup', 'aria-label': t('login.selectUser') });

  function renderUsers() {
    clear(userList);
    for (const u of users) {
      userList.append(
        h(
          'label',
          { class: `user-option${u.id === selected ? ' is-selected' : ''}` },
          h('input', {
            type: 'radio',
            name: 'user',
            value: u.id,
            checked: u.id === selected,
            onChange: () => {
              selected = u.id;
              renderUsers();
              pin.focus();
            },
          }),
          h('span', { class: 'avatar', 'aria-hidden': 'true' }, u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')),
          h('span', { class: 'user-name' }, u.name),
          badge(t(`role.${u.role}`), u.role === 'admin' ? 'info' : u.role === 'manager' ? 'warn' : 'neutral'),
        ),
      );
    }
  }
  renderUsers();

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
  }

  function updateLock() {
    const seconds = lockoutSeconds();
    submit.disabled = seconds > 0;
    if (seconds > 0) {
      showError(t('login.locked', { seconds }));
      timer = timer || setInterval(updateLock, 1000);
    } else {
      if (timer) {
        clearInterval(timer);
        timer = null;
        error.hidden = true;
      }
    }
  }

  const form = h(
    'form',
    {
      class: 'login-form',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        error.hidden = true;
        pin.removeAttribute('aria-invalid');
        submit.disabled = true;
        try {
          const user = await login(selected, pin.value.trim());
          clearInterval(timer);
          onSuccess(user);
        } catch (e) {
          if (e instanceof ActionError) {
            showError(t(e.key, e.params));
            pin.setAttribute('aria-invalid', 'true');
            pin.value = '';
            pin.focus();
          } else {
            reportError(e);
          }
        } finally {
          updateLock();
          if (lockoutSeconds() === 0) submit.disabled = false;
        }
      },
    },
    h('fieldset', { class: 'fieldset' }, h('legend', {}, t('login.selectUser')), userList),
    h('div', { class: 'field' }, h('label', { for: 'pin' }, t('login.pin')), pin, h('p', { class: 'field-hint', id: 'pin-hint' }, t('login.demoHint', { pin: DEMO_PIN }))),
    error,
    submit,
  );

  const reset = button(t('demo.reset'), {
    variant: 'ghost',
    iconName: 'refresh',
    onClick: async () => {
      const ok = await confirmDialog({ title: t('demo.reset'), message: t('demo.resetConfirm'), confirmLabel: t('demo.reset'), danger: true });
      if (!ok) return;
      try {
        await resetDemoData({ requireAdmin: false });
        toast(t('demo.resetDone'), 'success');
        mountLogin(clear(root), { onSuccess });
      } catch (e) {
        reportError(e);
      }
    },
  });

  fill(root, 
    h(
      'div',
      { class: 'login-page' },
      h('div', { class: 'login-tools' }, languageSelect(), themeToggle()),
      h(
        'main',
        { class: 'login-card', id: 'main' },
        h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark' }, icon('clipboard', { size: 26 })), h('div', {}, h('h1', {}, t('app.name')), h('p', { class: 'muted' }, t('app.tagline')))),
        h('div', { class: 'demo-notice', role: 'note' }, icon('info'), h('span', {}, t('demo.notice'))),
        form,
        h('div', { class: 'login-footer' }, reset),
      ),
    ),
  );
  updateLock();
  return {
    refresh() {},
    destroy() {
      clearInterval(timer);
    },
  };
}
