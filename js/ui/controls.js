// Language switcher and theme toggle (used on the login page and in the app header).

import { h } from './dom.js';
import { icon } from './icons.js';
import { LANGUAGES, getLanguage, setLanguage, t } from '../i18n.js';
import { getPrefs, setPrefs } from '../core/store.js';

export function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function currentTheme() {
  return getPrefs().theme || systemTheme();
}

export function applyTheme() {
  const theme = currentTheme();
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#1d4ed8');
}

export function languageSelect() {
  return h(
    'label',
    { class: 'lang-switch' },
    icon('globe'),
    h('span', { class: 'sr-only' }, t('common.language')),
    h(
      'select',
      {
        id: 'lang-select',
        class: 'input input-sm',
        onChange: (e) => {
          setPrefs({ lang: e.target.value });
          setLanguage(e.target.value);
        },
      },
      LANGUAGES.map((l) => h('option', { value: l.code, selected: l.code === getLanguage() }, l.label)),
    ),
  );
}

export function themeToggle() {
  const dark = currentTheme() === 'dark';
  return h(
    'button',
    {
      type: 'button',
      id: 'theme-toggle',
      class: 'icon-btn',
      'aria-pressed': String(dark),
      'aria-label': t('common.darkMode'),
      title: t('common.darkMode'),
      onClick: () => {
        setPrefs({ theme: dark ? 'light' : 'dark' });
        applyTheme();
        const next = themeToggle();
        document.getElementById('theme-toggle').replaceWith(next);
        next.focus();
      },
    },
    icon(dark ? 'sun' : 'moon'),
  );
}
