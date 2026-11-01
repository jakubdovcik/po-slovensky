// Progress lives in localStorage on the device, one record per learner profile.
// Every access is guarded: private mode or blocked storage must never break the app.

const KEY = 'poslovensky.v1';
const PROFILES_KEY = 'poslovensky.profiles';

const DEFAULT_STATE = {
  v: 1,
  name: '',           // learner's first name (used in the story)
  avatar: '',         // emoji chosen on the profile screen
  createdAt: 0,       // when this learner started (ms)
  cards: {},          // itemId -> FSRS card state
  introduced: {},     // itemId -> day number first seen
  days: {},           // day number -> { done, right, secs }
  pairs: {},          // "a|b" -> { seen, wrong }
  story: { done: {} },// chapterId -> day completed
  custom: null,       // private units for this learner only ({ stage, units }), synced to her account
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

const saveListeners = [];
/** Called after every (non-silent) save, e.g. to schedule a cloud sync. */
export function onSave(fn) { saveListeners.push(fn); }

export function save({ silent = false } = {}) {
  state.updatedAt = Date.now();
  write(keyFor(profileData.current), JSON.stringify(state));
  if (!silent) saveListeners.forEach((fn) => fn());
}

export const currentProfileId = () => profileData.current;

/** Replaces the current learner's state (after merging with the cloud copy). */
export function replaceState(next) {
  state = hydrate(next);
  save({ silent: true });
}

/**
 * Combines two copies of the same learner's progress (e.g. phone + iPad) without losing
 * anything: the most recently reviewed version of each card wins, the rest is unioned.
 */
export function mergeStates(local, remote) {
  const r = hydrate(remote);
  const out = hydrate(structuredClone(local));
  out.name = out.name || r.name;
  out.avatar = out.avatar || r.avatar;
  out.createdAt = Math.min(out.createdAt || Infinity, r.createdAt || Infinity);
  if (!Number.isFinite(out.createdAt)) out.createdAt = 0;
  for (const [id, c] of Object.entries(r.cards)) {
    const m = out.cards[id];
    if (!m || c.last > m.last || (c.last === m.last && c.reps > m.reps)) out.cards[id] = c;
  }
  for (const [id, d] of Object.entries(r.introduced)) out.introduced[id] = out.introduced[id] == null ? d : Math.min(out.introduced[id], d);
  for (const [d, x] of Object.entries(r.days)) {
    const m = out.days[d] || {};
    out.days[d] = { done: Math.max(m.done || 0, x.done || 0), right: Math.max(m.right || 0, x.right || 0), secs: Math.max(m.secs || 0, x.secs || 0) };
  }
  for (const [k, x] of Object.entries(r.pairs)) {
    const m = out.pairs[k] || { seen: 0, wrong: 0 };
    out.pairs[k] = { seen: Math.max(m.seen, x.seen), wrong: Math.max(m.wrong, x.wrong) };
  }
  for (const [k, d] of Object.entries(r.story.done)) out.story.done[k] = out.story.done[k] == null ? d : Math.min(out.story.done[k], d);
  out.trailBest = Math.max(out.trailBest || 0, r.trailBest || 0);
  if (!out.custom?.units?.length && r.custom?.units?.length) out.custom = r.custom;
  return out;
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
