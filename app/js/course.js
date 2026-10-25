// Loads the course and builds lookup tables, plus the session/exercise logic.

import { state, save, today } from './store.js';
import { review, retrievability } from './fsrs.js';

export const course = { stages: [], units: [], items: {}, order: [] };

export async function loadCourse() {
  const res = await fetch('data/course.json');
  const data = await res.json();
  course.stages = data.stages;
  course.units = data.units;
  for (const unit of data.units) {
    for (const item of unit.items) {
      const kind = item.kind || (/[\s.?!]/.test(item.sk.trim()) ? 'phrase' : 'word');
      course.items[item.id] = { ...item, kind, unit: unit.id, stage: unit.stage };
      course.order.push(item.id);
    }
  }
}

export const unitById = (id) => course.units.find((u) => u.id === id);

// --- helpers -----------------------------------------------------------------

export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const tokens = (sk) => sk.replace(/[.,!?…]/g, '').split(/\s+/).filter(Boolean);

export function normalize(s) {
  return s.normalize('NFC').toLowerCase()
    .replace(/[.,!?;:"„“”'’…¿¡()-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
export const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** exact → grade 3; right letters but missing accents, or a single typo → grade 2; otherwise wrong. */
export function checkTyped(input, targets) {
  const n = normalize(input);
  if (!n) return { result: 'wrong', target: targets[0] };
  for (const t of targets) if (normalize(t) === n) return { result: 'exact', target: t };
  for (const t of targets) {
    if (stripAccents(normalize(t)) === stripAccents(n)) return { result: 'accents', target: t };
  }
  for (const t of targets) {
    const nt = stripAccents(normalize(t));
    if (nt.length >= 6 && levenshtein(nt, stripAccents(n)) <= 1) return { result: 'typo', target: t };
  }
  return { result: 'wrong', target: targets[0] };
}

// --- distractors -------------------------------------------------------------

function distractors(item, field, n = 3) {
  const pool = (units) => course.order
    .map((id) => course.items[id])
    .filter((o) => o.id !== item.id && o.kind !== 'sound' && units.includes(o.unit) &&
      o[field] !== item[field] && (o.kind === item.kind || item.kind === 'phrase' && o.kind === 'phrase'));
  let candidates = shuffle(pool([item.unit]));
  if (candidates.length < n) {
    const idx = course.units.findIndex((u) => u.id === item.unit);
    const near = course.units.slice(Math.max(0, idx - 2), idx + 3).map((u) => u.id);
    candidates = [...candidates, ...shuffle(pool(near).filter((o) => !candidates.includes(o)))];
  }
  const seen = new Set([item[field]]);
  const out = [];
  for (const c of candidates) {
    if (seen.has(c[field])) continue;
    seen.add(c[field]);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

// --- exercise selection --------------------------------------------------------

// Recognition first, then production as soon as the memory is stable enough:
// recall beats recognition, so it's used as soon as possible.
export function makeExercise(id, { easy = false, isNew = false } = {}) {
  const item = course.items[id];
  const card = state.cards[id];
  const s = card?.s ?? 0;

  if (item.kind === 'sound') {
    const example = pick(item.examples);
    if (!easy && !isNew && s >= 5) return { type: 'dictation', item, target: example.sk, targetEn: example.en };
    const others = shuffle(unitById(item.unit).items
      .filter((o) => o.id !== item.id).flatMap((o) => o.examples));
    const opts = shuffle([...item.examples, ...others].slice(0, Math.max(4, item.examples.length)))
      .filter((v, i, a) => a.findIndex((x) => x.sk === v.sk) === i);
    if (!opts.some((o) => o.sk === example.sk)) opts[0] = example;
    return { type: 'sound_pick', item, target: example.sk, targetEn: example.en, options: shuffle(opts).slice(0, 4) };
  }

  const words = tokens(item.sk).length;
  let type;
  if (item.blank) {
    // Grammar items: fill-the-gap trains the pattern; later, produce the whole sentence.
    if (isNew || easy) type = 'cloze';
    else if (s < 6) type = pick(['cloze', 'cloze', words >= 3 ? 'build' : 'read_choose']);
    else type = pick(['cloze', 'type']);
    if (type === 'cloze') return { type, item, options: shuffle(item.choices) };
  }
  if (isNew) type = 'listen_choose';
  else if (easy) type = 'read_choose';
  else if (s < 2) type = pick(['listen_choose', 'read_choose']);
  else if (s < 6) type = words >= 3 ? pick(['build', 'read_choose', 'listen_choose']) : pick(['read_choose', 'type']);
  else type = words <= 4 ? pick(['type', 'dictation']) : pick(['type', 'build']);

  if (type === 'listen_choose') {
    const ds = distractors(item, 'en');
    if (ds.length < 2) type = 'type';
    else return { type, item, options: shuffle([item, ...ds]).map((o) => ({ id: o.id, label: o.en })) };
  }
  if (type === 'read_choose') {
    const ds = distractors(item, 'sk');
    if (ds.length < 2) type = 'type';
    else return { type, item, options: shuffle([item, ...ds]).map((o) => ({ id: o.id, label: o.sk })) };
  }
  if (type === 'build') {
    const own = tokens(item.sk);
    const extra = shuffle(distractors(item, 'sk', 4).flatMap((o) => tokens(o.sk)))
      .filter((t) => !own.some((w) => normalize(w) === normalize(t))).slice(0, 2);
    return { type, item, bank: shuffle([...own, ...extra]).map((t, i) => ({ t, i })), chosen: [] };
  }
  return { type, item, target: item.sk, targets: [item.sk, ...(item.alt || [])] };
}

// --- session building ----------------------------------------------------------

const MAX_REVIEWS = 40;

export function introducedToday() {
  const t = today();
  return Object.values(state.introduced).filter((d) => d === t).length;
}

export function dueIds(t = today()) {
  return Object.entries(state.cards)
    .filter(([id, c]) => c.due <= t && course.items[id])
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export function newIds(unitId = null) {
  const unseen = course.order.filter((id) => !state.cards[id] && (!unitId || course.items[id].unit === unitId));
  if (unitId || !state.settings.clinicMix) return unseen;
  // Clinic track mixed in: after the sounds stage, every third new item is a clinic one.
  const stageOf = (id) => course.items[id].stage;
  if (unseen.some((id) => stageOf(id) === 'sounds')) return unseen;
  const main = unseen.filter((id) => stageOf(id) !== 'clinic');
  const clinic = unseen.filter((id) => stageOf(id) === 'clinic');
  const out = [];
  while (main.length || clinic.length) {
    out.push(...main.splice(0, 2));
    out.push(...clinic.splice(0, 1));
  }
  return out;
}

export function todaySummary() {
  const due = Math.min(MAX_REVIEWS, dueIds().length);
  const fresh = Math.min(newIds().length, Math.max(0, state.settings.newPerDay - introducedToday()));
  return { due, fresh, minutes: Math.max(1, Math.round((due * 8 + fresh * 25) / 60)) };
}

function earPairs(units, max) {
  const all = units.filter((u) => u.pairs).flatMap((u) => u.pairs);
  if (!all.length) return [];
  // Weight pairs she gets wrong more often.
  const weighted = all.flatMap((p) => {
    const st = state.pairs[p.a + '|' + p.b] || { seen: 0, wrong: 0 };
    return Array(1 + Math.round(4 * (st.wrong + 1) / (st.seen + 2))).fill(p);
  });
  const out = [];
  for (const p of shuffle(weighted)) {
    if (out.length >= max) break;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

export function buildSession({ unitId = null, extra = false } = {}) {
  const t = today();
  let reviews = dueIds(t).filter((id) => !unitId || course.items[id].unit === unitId);
  reviews = shuffle(reviews.slice(0, MAX_REVIEWS));

  if (extra || (unitId && !reviews.length && !newIds(unitId).length)) {
    // Practising beyond today's plan: the items closest to being forgotten.
    reviews = Object.entries(state.cards)
      .filter(([id]) => course.items[id] && (!unitId || course.items[id].unit === unitId))
      .map(([id, c]) => [id, retrievability(Math.max(0, t - c.last), c.s)])
      .sort((a, b) => a[1] - b[1]).slice(0, 15).map(([id]) => id);
    reviews = shuffle(reviews);
  }

  const quota = unitId ? state.settings.newPerDay : Math.max(0, state.settings.newPerDay - introducedToday());
  const fresh = extra ? [] : newIds(unitId).slice(0, quota);

  // Ear warm-up only for sounds she has already been taught; a brand-new unit's
  // contrasts come at the end of the session, after its lessons.
  const started = course.units.filter((u) => u.items.some((i) => state.cards[i.id]));
  const freshUnits = [...new Set(fresh.map((id) => course.items[id].unit))]
    .map(unitById).filter((u) => !started.includes(u));
  const queue = earPairs(started, 6).map((pair) => ({ kind: 'pair', pair }));
  const latePairs = earPairs(freshUnits, 4).map((pair) => ({ kind: 'pair', pair }));

  const rq = reviews.map((id) => ({ kind: 'review', id }));
  queue.push(...rq.splice(0, 3));
  const lessoned = new Set(started.map((u) => u.id));
  for (let i = 0; i < fresh.length; i += 2) {
    const group = fresh.slice(i, i + 2);
    // The first time she reaches a unit, show its explanation before the first new item.
    for (const id of group) {
      const unit = course.items[id].unit;
      if (!lessoned.has(unit)) { lessoned.add(unit); queue.push({ kind: 'lesson', unit }); }
    }
    queue.push(...group.map((id) => ({ kind: 'intro', id })));
    queue.push(...rq.splice(0, 2));
    queue.push(...group.map((id) => ({ kind: 'review', id, isNew: true })));
  }
  queue.push(...rq, ...latePairs);
  return queue;
}

// --- recording results (activity/time is logged by the session in app.js) ---------

export function gradeItem(id, grade) {
  const t = today();
  state.cards[id] = review(state.cards[id] || null, grade, t);
  if (state.introduced[id] == null) state.introduced[id] = t;
  save();
}

export function recordPair(pair, correct) {
  const key = pair.a + '|' + pair.b;
  const st = state.pairs[key] || { seen: 0, wrong: 0 };
  state.pairs[key] = { seen: st.seen + 1, wrong: st.wrong + (correct ? 0 : 1) };
  save();
}

export function unitProgress(unit) {
  const learned = unit.items.filter((i) => state.cards[i.id]).length;
  return { learned, total: unit.items.length };
}
