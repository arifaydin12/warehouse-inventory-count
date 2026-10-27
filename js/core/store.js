// Application state: persisted data, preferences and the signed-in user.

import { KEYS, readJSON, writeJSON, removeKey } from './storage.js';
import { buildSeed, DATA_VERSION } from './seed.js';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '../i18n.js';

const state = {
  data: null,
  prefs: { lang: DEFAULT_LANGUAGE, theme: null, sound: true },
  userId: null,
};

const dataListeners = new Set();
const persistErrorListeners = new Set();

export function getData() {
  return state.data;
}

export function getPrefs() {
  return state.prefs;
}

export function getCurrentUser() {
  return state.data?.users.find((u) => u.id === state.userId) ?? null;
}

export function subscribe(fn) {
  dataListeners.add(fn);
  return () => dataListeners.delete(fn);
}

export function onPersistError(fn) {
  persistErrorListeners.add(fn);
}

function notify() {
  dataListeners.forEach((fn) => fn());
}

function isValidData(data) {
  return (
    data &&
    data.version === DATA_VERSION &&
    ['users', 'warehouses', 'locations', 'products', 'sessions', 'audit'].every((k) => Array.isArray(data[k]))
  );
}

function persist() {
  if (!writeJSON('local', KEYS.data, state.data)) {
    persistErrorListeners.forEach((fn) => fn());
  }
}

export async function initStore() {
  const prefs = readJSON('local', KEYS.prefs);
  if (prefs) {
    state.prefs = {
      lang: isSupportedLanguage(prefs.lang) ? prefs.lang : DEFAULT_LANGUAGE,
      theme: prefs.theme === 'dark' || prefs.theme === 'light' ? prefs.theme : null,
      sound: prefs.sound !== false,
    };
  }
  const stored = readJSON('local', KEYS.data);
  let recovered = false;
  if (isValidData(stored)) {
    state.data = stored;
  } else {
    recovered = stored !== null;
    state.data = await buildSeed();
    persist();
  }
  const session = readJSON('session', KEYS.session);
  if (session && state.data.users.some((u) => u.id === session.userId)) state.userId = session.userId;

  // Keep several tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key !== KEYS.data) return;
    const next = readJSON('local', KEYS.data);
    if (isValidData(next)) {
      state.data = next;
      if (state.userId && !next.users.some((u) => u.id === state.userId)) state.userId = null;
      notify();
    }
  });
  return { recovered };
}

/** Runs `mutator` on the data, persists the result and notifies subscribers. */
export function commit(mutator) {
  const result = mutator(state.data);
  persist();
  notify();
  return result;
}

export function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  writeJSON('local', KEYS.prefs, state.prefs);
}

export function setSessionUser(userId) {
  state.userId = userId;
  if (userId) writeJSON('session', KEYS.session, { userId });
  else removeKey('session', KEYS.session);
}

export async function replaceWithSeed() {
  state.data = await buildSeed();
  if (state.userId && !state.data.users.some((u) => u.id === state.userId)) state.userId = null;
  persist();
  notify();
}
