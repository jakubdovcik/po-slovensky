// Listening dialogues (audio first, transcript after) and free speaking prompts.
// Each unlocks once half of its lessons' items are learned.

import { state, save, today, logActivity } from './store.js';
import { unitById, unitProgress } from './course.js';

export const practice = { dialogues: [], prompts: [] };

export async function loadPractice() {
  try { Object.assign(practice, await (await fetch('data/practice.json')).json()); } catch { /* offline first run */ }
}

const rec = () => (state.practice ||= { heard: {}, spoke: {}, speakDay: 0 });

export function unlocked(x) {
  return x.requires.every((id) => {
    const u = unitById(id);
    if (!u) return false;
    const p = unitProgress(u);
    return p.learned / p.total >= 0.5;
  });
}

export const heard = (id) => rec().heard[id] || null;
export const spoke = (id) => rec().spoke[id] || null;

export function availableDialogues() {
  return practice.dialogues.filter(unlocked);
}

export function nextDialogue() {
  return availableDialogues().find((d) => !heard(d.id)) || null;
}

export function availablePrompts() {
  return practice.prompts.filter(unlocked);
}

/** A speaking prompt for today's session: at most one per day, preferring ones not answered yet. */
export function promptForToday() {
  if (rec().speakDay === today()) return null;
  const list = availablePrompts();
  if (!list.length) return null;
  const fresh = list.filter((p) => !spoke(p.id));
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function markHeard(id, score, total) {
  rec().heard[id] = { day: today(), score, total };
  save();
}

export function markSpoke(id) {
  rec().spoke[id] = today();
  rec().speakDay = today();
  logActivity({ answered: 1, correct: 1 });
  save();
}

export function skipSpeakingToday() {
  rec().speakDay = today();
  save();
}
