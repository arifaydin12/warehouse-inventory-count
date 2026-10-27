// Entry point: loads state, starts the app and registers the service worker.

import { initStore, onPersistError } from './core/store.js';
import { startApp } from './app.js';
import { toast } from './ui/components.js';
import { t } from './i18n.js';

const root = document.getElementById('app');

window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error(event.reason);
  toast(t('error.unexpected'), 'error');
});

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  try {
    // Relative URL + scope keep the worker correct when hosted under a sub-path (GitHub Pages).
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

async function boot() {
  try {
    const { recovered } = await initStore();
    onPersistError(() => toast(t('error.storageFull'), 'error', 8000));
    startApp(root);
    if (recovered) toast(t('error.dataRecovered'), 'info', 8000);
    document.documentElement.classList.add('ready');
    registerServiceWorker();
  } catch (error) {
    console.error(error);
    root.replaceChildren();
    const box = document.createElement('div');
    box.className = 'boot-error';
    box.setAttribute('role', 'alert');
    box.textContent = 'The application could not start. Please reload the page or clear this site\'s data.';
    root.append(box);
  }
}

boot();
