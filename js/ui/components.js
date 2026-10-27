// Shared UI building blocks: toasts, dialogs, form fields, badges, KPI cards.

import { h, nextId, $ } from './dom.js';
import { icon } from './icons.js';
import { t, te } from '../i18n.js';
import { ActionError, ValidationError } from '../core/actions.js';

// --- Toasts ---------------------------------------------------------------------------------

export function toast(message, type = 'info', timeout = 4500) {
  let region = $('#toast-region');
  if (!region) {
    region = h('div', { id: 'toast-region', class: 'toast-region', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const el = h(
    'div',
    { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' },
    icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info'),
    h('span', {}, message),
  );
  region.append(el);
  const remove = () => el.remove();
  setTimeout(remove, timeout);
  el.addEventListener('click', remove);
  return el;
}

/** Shows any thrown error as a toast. Returns true if the error was an expected application error. */
export function reportError(error) {
  if (error instanceof ActionError) {
    toast(t(error.key, error.params), 'error');
    return true;
  }
  if (error instanceof ValidationError) {
    toast(Object.values(error.errors).map(te).join(' · '), 'error');
    return true;
  }
  console.error(error);
  toast(t('error.unexpected'), 'error');
  return false;
}

// --- Dialogs --------------------------------------------------------------------------------

export function openDialog({ title, body, actions = [], size = 'md', onClose, describedBy }) {
  const titleId = nextId('dlg-title');
  const dialog = h('dialog', { class: `dialog dialog-${size}`, 'aria-labelledby': titleId, 'aria-describedby': describedBy });
  const closeButton = h(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), onClick: () => close() },
    icon('close'),
  );
  dialog.append(
    h('header', { class: 'dialog-header' }, h('h2', { id: titleId }, title), closeButton),
    h('div', { class: 'dialog-body' }, body),
  );
  if (actions.length) dialog.append(h('footer', { class: 'dialog-footer' }, actions));

  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    onClose?.(result);
  }
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('mousedown', (e) => {
    if (e.target === dialog) close();
  });
  document.body.append(dialog);
  dialog.showModal();
  return { el: dialog, close };
}

export function confirmDialog({ title, message, confirmLabel = t('common.confirm'), danger = false }) {
  return new Promise((resolve) => {
    const descId = nextId('dlg-desc');
    let result = false;
    const confirm = h(
      'button',
      {
        type: 'button',
        class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
        onClick: () => {
          result = true;
          dlg.close();
        },
      },
      confirmLabel,
    );
    const cancel = h('button', { type: 'button', class: 'btn', autofocus: true, onClick: () => dlg.close() }, t('common.cancel'));
    const dlg = openDialog({
      title,
      body: h('p', { id: descId }, message),
      actions: [cancel, confirm],
      size: 'sm',
      describedBy: descId,
      onClose: () => resolve(result),
    });
  });
}

// --- Forms ----------------------------------------------------------------------------------

/**
 * Builds a labelled form control.
 * spec: { name, label, type, value, options, required, hint, placeholder, inputMode, maxLength, list, autocomplete, min }
 */
export function field(spec) {
  const id = nextId(`f-${spec.name}`);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  let input;
  if (spec.type === 'select') {
    input = h(
      'select',
      { id, name: spec.name, class: 'input' },
      (spec.options || []).map((o) => h('option', { value: o.value, selected: String(o.value) === String(spec.value ?? '') }, o.label)),
    );
  } else if (spec.type === 'textarea') {
    input = h('textarea', { id, name: spec.name, class: 'input', rows: 3, maxlength: spec.maxLength }, spec.value ?? '');
  } else {
    input = h('input', {
      id,
      name: spec.name,
      class: 'input',
      type: spec.type || 'text',
      value: spec.value ?? '',
      placeholder: spec.placeholder,
      inputmode: spec.inputMode,
      maxlength: spec.maxLength,
      list: spec.list,
      autocomplete: spec.autocomplete ?? 'off',
      min: spec.min,
      autocapitalize: 'off',
      spellcheck: 'false',
    });
  }
  if (spec.required) input.setAttribute('aria-required', 'true');
  const errorEl = h('p', { class: 'field-error', id: errorId, hidden: true });
  const describedBy = [spec.hint ? hintId : null].filter(Boolean);
  if (describedBy.length) input.setAttribute('aria-describedby', describedBy.join(' '));

  const el = h(
    'div',
    { class: spec.wide ? 'field field-wide' : 'field' },
    h('label', { for: id }, spec.label, spec.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    input,
    spec.hint ? h('p', { class: 'field-hint', id: hintId }, spec.hint) : null,
    errorEl,
  );

  function setError(error) {
    if (error) {
      errorEl.textContent = te(error);
      errorEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [...describedBy, errorId].join(' '));
    } else {
      errorEl.textContent = '';
      errorEl.hidden = true;
      input.removeAttribute('aria-invalid');
      if (describedBy.length) input.setAttribute('aria-describedby', describedBy.join(' '));
      else input.removeAttribute('aria-describedby');
    }
  }
  return { el, input, setError, name: spec.name };
}

/**
 * Opens a dialog with a validated form.
 * onSubmit(values) may throw ValidationError (shown per field) or ActionError (shown at the top).
 */
export function formDialog({ title, fields, submitLabel = t('common.save'), onSubmit, intro, size = 'md', extra }) {
  const built = fields.map(field);
  const byName = Object.fromEntries(built.map((f) => [f.name, f]));
  const formError = h('div', { class: 'alert alert-error', role: 'alert', hidden: true });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel);
  const cancel = h('button', { type: 'button', class: 'btn', onClick: () => dlg.close() }, t('common.cancel'));
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    intro ? h('p', { class: 'muted' }, intro) : null,
    formError,
    ...built.map((f) => f.el),
    extra,
    h('div', { class: 'dialog-footer-inline' }, cancel, submit),
  );
  if (built[0]) built[0].input.setAttribute('autofocus', '');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    built.forEach((f) => f.setError(null));
    formError.hidden = true;
    const values = Object.fromEntries(built.map((f) => [f.name, f.input.value]));
    submit.disabled = true;
    try {
      await onSubmit(values);
      dlg.close(true);
    } catch (error) {
      if (error instanceof ValidationError) {
        let first = null;
        for (const [name, err] of Object.entries(error.errors)) {
          if (byName[name]) {
            byName[name].setError(err);
            first = first || byName[name];
          } else {
            formError.textContent = te(err);
            formError.hidden = false;
          }
        }
        first?.input.focus();
      } else if (error instanceof ActionError) {
        formError.textContent = t(error.key, error.params);
        formError.hidden = false;
      } else {
        console.error(error);
        formError.textContent = t('error.unexpected');
        formError.hidden = false;
      }
    } finally {
      submit.disabled = false;
    }
  });

  const dlg = openDialog({ title, body: form, size });
  return { ...dlg, fields: byName };
}

// --- Small widgets --------------------------------------------------------------------------

export function badge(text, tone = 'neutral') {
  return h('span', { class: `badge badge-${tone}` }, text);
}

export function statusTone(status) {
  return (
    { open: 'info', submitted: 'warn', recount: 'warn', approved: 'success', cancelled: 'neutral', match: 'success', shortage: 'danger', surplus: 'info', uncounted: 'neutral' }[
      status
    ] || 'neutral'
  );
}

export function kpiCard({ label, value, hint, tone }) {
  return h(
    'div',
    { class: `kpi${tone ? ` kpi-${tone}` : ''}` },
    h('div', { class: 'kpi-label' }, label),
    h('div', { class: 'kpi-value' }, value),
    hint ? h('div', { class: 'kpi-hint' }, hint) : null,
  );
}

export function progressBar(percent, label) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return h(
    'div',
    { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': label },
    h('div', { class: 'progress-fill', style: { width: `${value}%` } }),
  );
}

export function emptyState({ title, text, action }) {
  return h(
    'div',
    { class: 'empty' },
    icon('box', { size: 32 }),
    h('h3', {}, title),
    text ? h('p', { class: 'muted' }, text) : null,
    action || null,
  );
}

export function loadingState(text = t('common.loading')) {
  return h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, text));
}

export function pageHeader(title, subtitle, actions = []) {
  return h(
    'div',
    { class: 'page-header' },
    h('div', {}, h('h1', { id: 'page-title', tabindex: '-1' }, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
    h('div', { class: 'page-actions' }, actions),
  );
}

export function button(label, { onClick, variant = '', iconName, type = 'button', disabled = false, title } = {}) {
  return h(
    'button',
    { type, class: `btn${variant ? ` btn-${variant}` : ''}`, onClick, disabled, title },
    iconName ? icon(iconName) : null,
    h('span', {}, label),
  );
}

/** Runs an async action while showing a busy state on the button. */
export async function withBusy(btn, fn) {
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}
