// "Can-do" statements: real-world abilities, achieved when the units behind them are both
// learned and retained (most items recalled after a week or more), not just completed.

import { state, today } from './store.js';
import { unitById } from './course.js';

export const CAN_DO = [
  { text: 'I can read any Slovak word out loud', units: ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] },
  { text: 'I can greet people and be polite', units: ['u1'] },
  { text: 'I can introduce myself', units: ['u2'] },
  { text: 'I can say when I don\'t understand, and ask for help', units: ['u2b'] },
  { text: 'I can talk about my family', units: ['u3'] },
  { text: 'I can order food and drinks', units: ['u4'] },
  { text: 'I can count and ask what something costs', units: ['u6'] },
  { text: 'I can say how I feel', units: ['u7'] },
  { text: 'I can find my way around town', units: ['u9', 'c3'] },
  { text: 'I can say what I did yesterday', units: ['g5'] },
  { text: 'I can describe my daily routine', units: ['d3'] },
  { text: 'I can describe symptoms at the doctor', units: ['c1'] },
  { text: 'I can shop for clothes', units: ['c2'] },
  { text: 'I can open a psychiatric interview in Slovak', units: ['m1', 'm2', 'm3'] },
  { text: 'I can ask about sleep, appetite and risk', units: ['m4', 'm5'] },
  { text: 'I can explain a treatment plan', units: ['m6'] },
  { text: 'I can make plans and say what I\'d like', units: ['q4', 'x2'] },
  { text: 'I can give my opinion and say why', units: ['x4'] },
  { text: 'I can keep up with family gossip', units: ['k1', 'k2', 'k3', 'k4', 'k5'] },
  { text: 'I can toast at a Slovak wedding', units: ['o2', 'o3'] },
  { text: 'I can talk about my hobbies and weekend plans', units: ['f1'] },
  { text: 'I can tell the time and give a date', units: ['f2'] },
  { text: 'I can talk about my work and my holidays', units: ['f3', 'f4'] },
  { text: 'I can say whether something is done or still going on', units: ['y1'] },
  { text: 'I can say who owns what, and point things out', units: ['y2', 'y3', 'y4'] },
  { text: 'I can talk about my childhood', units: ['a1'] },
  { text: 'I can invite someone, accept, or say no nicely', units: ['a3'] },
  { text: 'I can say how much or how many', units: ['z1'] },
  { text: 'I can tell a story in order: first, then, in the end', units: ['z2', 'z3'] },
  { text: 'I can give a patient polite instructions', units: ['z4'] },
  { text: 'I can talk about countries, languages and jobs', units: ['b1', 'b2'] },
  { text: 'I can buy medicine at the pharmacy', units: ['b3'] },
  { text: 'I can react naturally to good and bad news', units: ['b4'] },
  { text: 'I can say when things happened: ago, in, for', units: ['w1'] },
  { text: 'I can give advice: you should, better, no need', units: ['w4'] },
  { text: 'I can say how something made me feel, and why', units: ['n1'] },
  { text: 'I can return something and complain politely', units: ['n3'] },
  { text: 'I can imagine: if I had…, I would…', units: ['v1'] },
  { text: 'I can pass on what someone said or asked', units: ['v2'] },
];

// An item counts as retained once its memory is stable for about a week (FSRS stability ≥ 7 days).
const RETAINED_S = 7;

export function canDoStatus(cd) {
  const items = cd.units.map(unitById).filter(Boolean).flatMap((u) => u.items);
  if (!items.length) return null;
  const learned = items.filter((i) => state.cards[i.id]).length / items.length;
  const retained = items.filter((i) => (state.cards[i.id]?.s || 0) >= RETAINED_S).length / items.length;
  return { learned, retained, achieved: learned >= 0.8 && retained >= 0.6 };
}

/**
 * Of the reviews in the last `days` days that came at least a week after the previous one,
 * the share she got right. This is "what you can still produce a week later".
 */
export function weekLaterRecall(days = 30) {
  const t = today();
  const checks = (state.log || []).filter(([d, , gap]) => d > t - days && gap >= 7);
  const ok = checks.filter(([, , , g]) => g >= 2).length;
  return { checks: checks.length, rate: checks.length ? ok / checks.length : null };
}
