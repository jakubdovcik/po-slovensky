// Progress lives in localStorage on her phone. Every access is guarded:
// private mode or blocked storage must never break the app.

const KEY = 'poslovensky.v1';

const DEFAULT_STATE = {
  v: 1,
  cards: {},          // itemId -> FSRS card state
  introduced: {},     // itemId -> day number first seen
  days: {},           // day number -> { done: count of answers }
  pairs: {},          // "a|b" -> { seen, wrong }
  settings: { newPerDay: 8, voice: 'mix', autoplay: true, clinicMix: true },
};

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...structuredClone(DEFAULT_STATE), ...parsed,
        settings: { ...DEFAULT_STATE.settings, ...parsed.settings } };
    }
  } catch { /* fall through to defaults */ }
  return structuredClone(DEFAULT_STATE);
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function exportState() {
  return JSON.stringify(state);
}

export function importState(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed.cards !== 'object') throw new Error('Not a Po slovensky backup');
  state = { ...structuredClone(DEFAULT_STATE), ...parsed,
    settings: { ...DEFAULT_STATE.settings, ...parsed.settings } };
  save();
}

export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  save();
}

// Days roll over at 4am local time so a late-night session counts for "today".
export function today(now = new Date()) {
  const shifted = new Date(now.getTime() - 4 * 3600 * 1000);
  return Math.floor(Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()) / 86400000);
}

export function dayToDate(day) {
  const d = new Date(day * 86400000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Ask Safari not to evict our data (honoured for home-screen apps).
try { navigator.storage?.persist?.(); } catch { /* ignore */ }
