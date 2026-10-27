// Application shell: routing, navigation chrome, login gating.

import { h, clear, fill, $ } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { badge, button, confirmDialog, toast, reportError } from './ui/components.js';
import { applyTheme, languageSelect, themeToggle } from './ui/controls.js';
import { t, getLanguage, setLanguage, onLanguageChange } from './i18n.js';
import { getCurrentUser, getPrefs, subscribe } from './core/store.js';
import { logout, resetDemoData } from './core/actions.js';
import { can, canAccessRoute } from './domain/permissions.js';
import { mountLogin } from './ui/views/login.js';
import { mountDashboard } from './ui/views/dashboard.js';
import { mountProducts } from './ui/views/products.js';
import { mountWarehouses } from './ui/views/warehouses.js';
import { mountSessions } from './ui/views/sessions.js';
import { mountSessionDetail } from './ui/views/sessionDetail.js';
import { mountAudit } from './ui/views/audit.js';
import { mountUsers } from './ui/views/users.js';

const NAV = [
  { route: 'dashboard', icon: 'dashboard', label: 'nav.dashboard' },
  { route: 'sessions', icon: 'clipboard', label: 'nav.sessions' },
  { route: 'products', icon: 'box', label: 'nav.products' },
  { route: 'warehouses', icon: 'warehouse', label: 'nav.warehouses' },
  { route: 'audit', icon: 'log', label: 'nav.audit' },
  { route: 'users', icon: 'users', label: 'nav.users' },
];

const VIEWS = {
  dashboard: mountDashboard,
  products: mountProducts,
  warehouses: mountWarehouses,
  sessions: mountSessions,
  audit: mountAudit,
  users: mountUsers,
};

let rootEl;
let currentView = null;
let firstRender = true;

export function parseRoute() {
  const [name = 'dashboard', param = null] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'dashboard', param: param ? decodeURIComponent(param) : null };
}

export function navigate(path) {
  location.hash = `#/${path}`;
}

function destroyView() {
  currentView?.destroy?.();
  currentView = null;
}

/** Renders the whole application (login or shell + current route). */
export function render() {
  destroyView();
  const user = getCurrentUser();
  document.title = t('app.name');
  if (!user) {
    currentView = mountLogin(clear(rootEl), { onSuccess: () => { navigate('dashboard'); render(); } });
    return;
  }
  renderShell(user);
  renderRoute();
}

function renderShell(user) {
  const route = parseRoute();
  const nav = h(
    'nav',
    { class: 'sidebar', id: 'sidebar', 'aria-label': t('nav.main') },
    NAV.filter((n) => canAccessRoute(user.role, n.route)).map((n) =>
      h(
        'a',
        { href: `#/${n.route}`, class: 'nav-link', 'data-route': n.route, 'aria-current': route.name === n.route ? 'page' : null, onClick: closeMenu },
        icon(n.icon),
        h('span', {}, t(n.label)),
      ),
    ),
  );

  const menuBtn = h(
    'button',
    {
      type: 'button',
      class: 'icon-btn menu-btn',
      id: 'menu-btn',
      'aria-label': t('nav.menu'),
      'aria-expanded': 'false',
      'aria-controls': 'sidebar',
      onClick: () => {
        const open = !document.body.classList.contains('menu-open');
        document.body.classList.toggle('menu-open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
      },
    },
    icon('menu', { size: 22 }),
  );

  const header = h(
    'header',
    { class: 'topbar' },
    menuBtn,
    h('a', { href: '#/dashboard', class: 'brand' }, h('span', { class: 'brand-mark' }, icon('clipboard', { size: 20 })), h('span', { class: 'brand-name' }, t('app.name'))),
    h('div', { class: 'topbar-spacer' }),
    languageSelect(),
    themeToggle(),
    h(
      'div',
      { class: 'user-chip' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')),
      h('div', { class: 'user-chip-text' }, h('span', { class: 'user-chip-name' }, user.name), badge(t(`role.${user.role}`), 'info')),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'icon-btn',
        'aria-label': t('common.logout'),
        title: t('common.logout'),
        onClick: () => {
          logout();
          navigate('dashboard');
          render();
        },
      },
      icon('logout'),
    ),
  );

  const banner = h(
    'div',
    { class: 'demo-banner', role: 'note' },
    icon('info'),
    h('span', {}, t('demo.notice')),
    can(user.role, 'data.reset')
      ? button(t('demo.reset'), {
          variant: 'sm',
          onClick: async () => {
            const ok = await confirmDialog({ title: t('demo.reset'), message: t('demo.resetConfirm'), confirmLabel: t('demo.reset'), danger: true });
            if (!ok) return;
            try {
              await resetDemoData();
              toast(t('demo.resetDone'), 'success');
              navigate('dashboard');
              render();
            } catch (e) {
              reportError(e);
            }
          },
        })
      : null,
  );

  fill(rootEl, 
    h('a', { class: 'skip-link', href: '#main', onClick: (e) => { e.preventDefault(); $('#main')?.focus(); } }, t('common.skipToContent')),
    header,
    banner,
    h('div', { class: 'layout' }, nav, h('main', { id: 'main', class: 'main', tabindex: '-1' })),
    h('div', { class: 'scrim', onClick: closeMenu }),
  );
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  $('#menu-btn')?.setAttribute('aria-expanded', 'false');
}

function renderRoute() {
  const user = getCurrentUser();
  const main = $('#main');
  if (!user || !main) return;
  currentView?.destroy?.();
  currentView = null;
  const route = parseRoute();
  closeMenu();
  const isDetail = route.name === 'sessions' && route.param;
  const navRoute = route.name;
  document.querySelectorAll('.nav-link').forEach((a) => {
    if (a.dataset.route === navRoute) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  clear(main);
  if (!VIEWS[route.name] || !canAccessRoute(user.role, route.name)) {
    if (VIEWS[route.name]) toast(t('error.forbidden'), 'error');
    navigate('dashboard');
    return;
  }
  try {
    const ctx = { user, param: route.param, navigate };
    currentView = isDetail ? mountSessionDetail(main, ctx) : VIEWS[route.name](main, ctx);
  } catch (error) {
    console.error(error);
    main.append(h('div', { class: 'alert alert-error', role: 'alert' }, t('error.unexpected')));
  }
  const title = $('#page-title', main);
  if (title) document.title = `${title.textContent} · ${t('app.name')}`;
  // Move focus to the page heading for screen-reader users, unless the view already placed focus (e.g. scan input).
  if (!firstRender && !main.contains(document.activeElement)) title?.focus({ preventScroll: true });
  firstRender = false;
  window.scrollTo(0, 0);
}

export function startApp(root) {
  rootEl = root;
  applyTheme();
  setLanguage(getPrefs().lang);

  window.addEventListener('hashchange', () => {
    if (getCurrentUser()) renderRoute();
  });
  onLanguageChange(() => {
    render();
    $('#lang-select')?.focus();
  });
  subscribe(() => {
    if (!getCurrentUser()) {
      // The signed-in user was removed (for example in another tab).
      if ($('#main') && !$('.login-page')) render();
      return;
    }
    try {
      currentView?.refresh?.();
    } catch (error) {
      console.error(error);
    }
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  render();
  return { language: getLanguage() };
}
