// "Cesta domov": story chapters that unlock as units are learned.

import { state, save, today } from './store.js';
import { course, unitById, unitProgress } from './course.js';

export const story = { title: '', subtitle: '', config: {}, characters: {}, chapters: [] };

export async function loadStory() {
  try {
    const res = await fetch('data/story.json');
    Object.assign(story, await res.json());
  } catch { /* no story offline on first run: the tab just shows nothing */ }
}

export const partnerName = () => story.config.partner || 'Jakub';

/** Fills {partner}, {name} and {hometown} placeholders. */
export function fill(text) {
  return String(text)
    .replaceAll('{partner}', partnerName())
    .replaceAll('{name}', state.name || 'you')
    .replaceAll('{hometown}', story.config.hometown || 'his hometown');
}

// A unit counts as done once 80% of its items have been learned.
const UNIT_DONE = 0.8;
export const unitDone = (u) => { const p = unitProgress(u); return p.learned / p.total >= UNIT_DONE; };

export function chapterStatus(ch, index) {
  const units = ch.requires.map(unitById).filter(Boolean);
  const remaining = units.filter((u) => !unitDone(u));
  const learned = units.reduce((n, u) => n + unitProgress(u).learned, 0);
  const total = units.reduce((n, u) => n + u.items.length, 0);
  const prev = story.chapters[index - 1];
  const prevDone = !prev || !!state.story.done[prev.id];
  return {
    done: !!state.story.done[ch.id],
    unlocked: remaining.length === 0 && prevDone,
    prevDone,
    remaining,
    pct: total ? Math.min(1, learned / (total * UNIT_DONE)) : 0,
  };
}

/** The first chapter not yet completed, with its status (or null when the story is finished). */
export function nextChapter() {
  for (let i = 0; i < story.chapters.length; i++) {
    const ch = story.chapters[i];
    if (!state.story.done[ch.id]) return { ch, index: i, status: chapterStatus(ch, i) };
  }
  return null;
}

export function completeChapter(id) {
  state.story.done[id] = today();
  save();
}

export const doneCount = () => story.chapters.filter((c) => state.story.done[c.id]).length;

// --- scene runner -----------------------------------------------------------------------

/** Creates the state for playing a chapter. */
export function startScene(index) {
  return { index, ch: story.chapters[index], i: 0, log: [], pending: null, hint: null, finished: false };
}

/** Advances to the next beat. Returns the audio to play ({sk, voice}) or null. */
export function advance(scene) {
  scene.hint = null;
  const beat = scene.ch.beats[scene.i];
  if (!beat) { scene.finished = true; return null; }
  if (beat.t === 'choice') {
    scene.pending = beat;
    return beat.audio ? { sk: beat.audio, voice: 'lukas' } : null;
  }
  scene.i++;
  scene.log.push(beat);
  if (beat.t === 'say') return { sk: beat.sk, voice: story.characters[beat.who]?.voice };
  return null;
}

/** Handles picking option `n` of the pending choice. Returns audio to play or null. */
export function choose(scene, n) {
  const opt = scene.pending.options[n];
  if (!opt.ok) { scene.hint = opt.hint || 'Not quite. Try another one.'; return null; }
  scene.log.push({ t: 'me', sk: opt.sk });
  scene.pending = null;
  scene.hint = null;
  scene.i++;
  if (opt.reply) {
    scene.log.push({ t: 'say', ...opt.reply });
    return { sk: opt.reply.sk, voice: story.characters[opt.reply.who]?.voice };
  }
  return null;
}

/** Every Slovak string that should have audio (used by the audio generator too). */
export function storyTexts(data = story) {
  const out = new Set();
  for (const ch of data.chapters) {
    for (const b of ch.beats) {
      if (b.t === 'say') out.add(b.sk);
      if (b.audio) out.add(b.audio);
      for (const o of b.options || []) {
        if (!o.sk.includes('{')) out.add(o.sk);
        if (o.reply) out.add(o.reply.sk);
      }
    }
  }
  return [...out];
}

