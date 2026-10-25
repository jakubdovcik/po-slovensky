// Progress lives in localStorage on the device, one record per learner profile.
// Every access is guarded: private mode or blocked storage must never break the app.

const KEY = 'poslovensky.v1';
const PROFILES_KEY = 'poslovensky.profiles';

const DEFAULT_STATE = {
  v: 1,
  name: '',           // learner's first name (used in the story)
  cards: {},          // itemId -> FSRS card state
  introduced: {},     // itemId -> day number first seen
  days: {},           // day number -> { done, right, secs }
  pairs: {},          // "a|b" -> { seen, wrong }
  story: { done: {} },// chapterId -> day completed
  settings: { newPerDay: 8, voice: 'mix', autoplay: true, clinicMix: true, showTranslations: true },
};

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const remove = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

let profileData = (() => {
  try { return JSON.parse(read(PROFILES_KEY)) || null; } catch { return null; }
})() || { current: 'main', list: [{ id: 'main' }] };

const keyFor = (id) => (id === 'main' ? KEY : `${KEY}.${id}`);

function hydrate(parsed) {
  const base = structuredClone(DEFAULT_STATE);
  if (!parsed) return base;
  return { ...base, ...parsed,
    story: { ...base.story, ...parsed.story },
    settings: { ...base.settings, ...parsed.settings } };
}

function load(id) {
  try { return hydrate(JSON.parse(read(keyFor(id)))); } catch { return hydrate(null); }
}

export let state = load(profileData.current);

export function save() {
  write(keyFor(profileData.current), JSON.stringify(state));
}

// --- learner profiles ------------------------------------------------------------

export function profiles() {
  return profileData.list.map((p) => ({ id: p.id, name: p.id === profileData.current ? state.name : load(p.id).name,
    current: p.id === profileData.current }));
}

export function switchProfile(id) {
  save();
  profileData.current = id;
  write(PROFILES_KEY, JSON.stringify(profileData));
  state = load(id);
}

export function addProfile(name) {
  const id = 'p' + Date.now().toString(36);
  profileData.list.push({ id });
  write(keyFor(id), JSON.stringify({ ...hydrate(null), name }));
  switchProfile(id);
}

export function deleteProfile(id) {
  if (id === 'main' || profileData.list.length < 2) return;
  profileData.list = profileData.list.filter((p) => p.id !== id);
  remove(keyFor(id));
  if (profileData.current === id) switchProfile('main');
  else write(PROFILES_KEY, JSON.stringify(profileData));
}

// --- activity log (per day) ------------------------------------------------------

/** Records answers and time spent today. `secs` is active time since the last action. */
export function logActivity({ answered = 0, correct = 0, secs = 0 }) {
  const t = today();
  const d = state.days[t] || {};
  state.days[t] = { done: (d.done || 0) + answered, right: (d.right || 0) + correct, secs: Math.round((d.secs || 0) + secs) };
  save();
}

// --- backup ------------------------------------------------------------------------

export function exportState() {
  return JSON.stringify(state);
}

export function importState(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed.cards !== 'object') throw new Error('Not a Po slovensky backup');
  state = hydrate(parsed);
  save();
}

export function resetState() {
  state = { ...hydrate(null), name: state.name };
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
