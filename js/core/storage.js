// Thin wrappers around localStorage / sessionStorage that never throw
// (private mode, disabled storage and quota errors fall back to memory).

const memory = { local: new Map(), session: new Map() };

function backend(kind) {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    const probe = '__wic_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const KEYS = {
  data: 'wic.data.v1',
  prefs: 'wic.prefs.v1',
  session: 'wic.session.v1',
  lockout: 'wic.lockout.v1',
};

export function readJSON(kind, key) {
  try {
    const store = backend(kind);
    const raw = store ? store.getItem(key) : memory[kind].get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns true on success, false when the value could not be persisted. */
export function writeJSON(kind, key, value) {
  const raw = JSON.stringify(value);
  try {
    const store = backend(kind);
    if (store) store.setItem(key, raw);
    else memory[kind].set(key, raw);
    return true;
  } catch {
    memory[kind].set(key, raw);
    return false;
  }
}

export function removeKey(kind, key) {
  try {
    const store = backend(kind);
    if (store) store.removeItem(key);
  } catch {
    /* ignore */
  }
  memory[kind].delete(key);
}
