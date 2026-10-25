// Learner progress summary, shared as a link. The data travels in the URL fragment
// (after #), which browsers never send to the server, so it stays between the two of you.

import { state, today } from './store.js';
import { course, unitProgress } from './course.js';
import { story, doneCount, nextChapter, fill } from './story.js';

const DAYS = 35;

export function weekStats(t = today()) {
  let done = 0, right = 0, secs = 0, active = 0;
  for (let d = t - 6; d <= t; d++) {
    const x = state.days[d];
    if (!x) continue;
    active++;
    done += x.done || 0;
    right += x.right || 0;
    secs += x.secs || 0;
  }
  return { done, right, secs, active, accuracy: done ? right / done : null };
}

export function totals() {
  const cards = Object.entries(state.cards).filter(([id]) => course.items[id]).map(([, c]) => c);
  const t = today();
  const allSecs = Object.values(state.days).reduce((n, d) => n + (d.secs || 0), 0);
  return {
    learned: cards.length,
    solid: cards.filter((c) => c.s >= 21).length,
    due: cards.filter((c) => c.due <= t).length,
    total: course.order.length,
    minutes: Math.round(allSecs / 60),
    daysActive: Object.keys(state.days).length,
  };
}

export function stageProgress() {
  return course.stages.map((s) => {
    const units = course.units.filter((u) => u.stage === s.id);
    const learned = units.reduce((n, u) => n + unitProgress(u).learned, 0);
    const total = units.reduce((n, u) => n + u.items.length, 0);
    return { id: s.id, title: s.title, learned, total };
  });
}

export function hardest(n = 6) {
  return Object.entries(state.cards)
    .filter(([id, c]) => course.items[id] && course.items[id].kind !== 'sound' && c.lapses > 0)
    .sort((a, b) => b[1].lapses - a[1].lapses || a[1].s - b[1].s)
    .slice(0, n)
    .map(([id, c]) => ({ sk: course.items[id].sk, en: course.items[id].en, lapses: c.lapses }));
}

export function buildReport() {
  const t = today();
  const days = [];
  for (let d = t - DAYS + 1; d <= t; d++) {
    const x = state.days[d];
    days.push(x ? [x.done || 0, x.right || 0, x.secs || 0] : 0);
  }
  const next = nextChapter();
  return {
    v: 1,
    n: state.name || 'Learner',
    t,
    tot: totals(),
    st: stageProgress().map((s) => [s.title, s.learned, s.total]),
    days,
    hard: hardest().map((h) => [h.sk, h.en, h.lapses]),
    ch: [doneCount(), story.chapters.length, next ? `${next.ch.title} · ${fill(next.ch.place)}` : ''],
  };
}

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function reportUrl() {
  const json = new TextEncoder().encode(JSON.stringify(buildReport()));
  return new URL('report.html', location.href).href + '#d=' + b64url(json);
}

export function decodeReport(hash) {
  const m = /d=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}
