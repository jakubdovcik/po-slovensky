import { state, save, today, dayToDate, exportState, importState, resetState } from './store.js';
import {
  course, loadCourse, unitById, makeExercise, buildSession, gradeItem, recordPair,
  checkTyped, todaySummary, normalize, stripAccents, tokens,
} from './course.js';
import * as audio from './audio.js';

const app = document.getElementById('app');
let view = { name: 'home' };
let sess = null;
let recordedUrl = null;
let recording = false;

// --- tiny helpers ----------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;

const ICON = {
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  slow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15c0-4 3-7 7.5-7S18 11 18 15H3z" fill="currentColor"/><path d="M18 13h1.5a1.5 1.5 0 0 0 0-3H18M5 15l-1 3M15.5 15l1 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z M5 17a3 3 0 0 1 3-3h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const ACCENTS = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ľ', 'ň', 'ó', 'ô', 'š', 'ť', 'ú', 'ý', 'ž'];
const PRAISE = ['Správne!', 'Výborne!', 'Super!', 'Presne tak!', 'Skvelé!'];
const GENDER = { m: 'masculine', f: 'feminine', n: 'neuter', pl: 'plural' };

const genderChip = (g) => g ? `<span class="g g-${g}" title="${GENDER[g]}">${g === 'pl' ? 'pl.' : g}</span>` : '';
const playBtn = (text, cls = '') => `<button class="icon-btn ${cls}" data-action="play" data-text="${attr(text)}" aria-label="Play">${ICON.speaker}</button>`;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function unitProgress(unit) {
  const learned = unit.items.filter((i) => state.cards[i.id]).length;
  return { learned, total: unit.items.length };
}

// --- rendering --------------------------------------------------------------------

function render() {
  if (view.name !== 'session') audio.stop();
  const screens = { home, unit: unitScreen, phrasebook, progress, settings, session: sessionScreen, summary };
  app.innerHTML = screens[view.name]();
  app.dataset.view = view.name;
  afterRender();
}

function tabbar() {
  const tab = (name, icon, label) =>
    `<button class="tab ${view.name === name || (name === 'home' && view.name === 'unit') ? 'on' : ''}" data-action="nav" data-to="${name}">${ICON[icon]}<span>${label}</span></button>`;
  return `<nav class="tabbar">${tab('home', 'home', 'Learn')}${tab('phrasebook', 'book', 'Phrases')}${tab('progress', 'chart', 'Progress')}${tab('settings', 'gear', 'Settings')}</nav>`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 10) return ['Dobré ráno', 'Good morning'];
  if (h < 18) return ['Dobrý deň', 'Good day'];
  return ['Dobrý večer', 'Good evening'];
}

function home() {
  const [sk, en] = greeting();
  const { due, fresh, minutes } = todaySummary();
  const nothing = due === 0 && fresh === 0;
  const anyCards = Object.keys(state.cards).length > 0;
  const showInstall = isIOS() && !isStandalone() && !sessionStorage.getItem('hideInstall');

  const todayCard = nothing
    ? `<section class="card today done">
        <div class="today-title">Hotovo, all done for today</div>
        <p class="muted">Nothing is due. Come back tomorrow, or practice a little more if you feel like it.</p>
        ${anyCards ? '<button class="btn secondary" data-action="start" data-extra="1">Practice a bit more</button>' : ''}
      </section>`
    : `<section class="card today">
        <div class="today-title">Today</div>
        <div class="today-stats">
          ${due ? `<div><b>${due}</b><span>to review</span></div>` : ''}
          ${fresh ? `<div><b>${fresh}</b><span>new</span></div>` : ''}
          <div><b>~${minutes}</b><span>min</span></div>
        </div>
        <button class="btn primary big" data-action="start">${anyCards ? 'Start' : 'Start your first lesson'}</button>
      </section>`;

  const stages = course.stages.map((stage) => {
    const units = course.units.filter((u) => u.stage === stage.id).map((u) => {
      const { learned, total } = unitProgress(u);
      const pct = Math.round(100 * learned / total);
      return `<button class="unit-row" data-action="unit" data-id="${u.id}">
          <div class="unit-text"><div class="unit-title">${esc(u.title)}</div>
          <div class="bar"><i style="width:${pct}%"></i></div></div>
          <div class="unit-count ${learned === total ? 'complete' : ''}">${learned === total ? ICON.check : `${learned}/${total}`}</div>
        </button>`;
    }).join('');
    return `<section class="stage"><h2>${esc(stage.title)}</h2><p class="muted small">${esc(stage.subtitle)}</p><div class="card list">${units}</div></section>`;
  }).join('');

  return `<main class="screen">
      <header class="hello"><h1 lang="sk">${sk}!</h1><p class="muted">${en}</p></header>
      ${showInstall ? `<section class="card hint"><b>Tip:</b> tap <b>Share</b> → <b>Add to Home Screen</b> to install this like an app (it works offline too).<button class="link" data-action="hide-install">Hide</button></section>` : ''}
      ${todayCard}
      ${stages}
    </main>${tabbar()}`;
}

function soundItemBlock(item) {
  return `<div class="sound-item">
      <div class="sound-symbol" lang="sk">${esc(item.sk)}</div>
      <div class="muted">${esc(item.en)}</div>
      ${item.explain ? `<p class="explain">${item.explain}</p>` : ''}
      <div class="examples">${item.examples.map((e) =>
        `<button class="example" data-action="play" data-text="${attr(e.sk)}"><span lang="sk">${esc(e.sk)}</span><small>${esc(e.en)}</small>${ICON.speaker}</button>`).join('')}</div>
    </div>`;
}

function unitScreen() {
  const unit = unitById(view.id);
  const { learned, total } = unitProgress(unit);
  const items = unit.items.map((i) => course.items[i.id]);
  const rows = items.map((it) => it.kind === 'sound'
    ? `<div class="card">${soundItemBlock(it)}</div>`
    : `<button class="row" data-action="play" data-text="${attr(it.sk)}">
        <span class="row-main"><span class="sk" lang="sk">${esc(it.sk)}</span> ${genderChip(it.g)}<span class="en">${esc(it.en)}</span></span>
        ${state.cards[it.id] ? `<span class="learned">${ICON.check}</span>` : ''}
      </button>`).join('');
  const pairs = unit.pairs ? `<h3>Listen for the difference</h3><div class="card list">${unit.pairs.map((p) =>
      `<div class="pair-row"><button class="chip" data-action="play" data-text="${attr(p.a)}" lang="sk">${esc(p.a)} <small>${esc(p.ea)}</small></button>
       <span class="muted">vs</span>
       <button class="chip" data-action="play" data-text="${attr(p.b)}" lang="sk">${esc(p.b)} <small>${esc(p.eb)}</small></button></div>`).join('')}</div>` : '';
  const label = learned === total ? 'Review this unit' : learned ? 'Continue this unit' : 'Learn this unit';
  return `<main class="screen">
      <header class="topbar"><button class="icon-btn" data-action="nav" data-to="home" aria-label="Back">${ICON.back}</button><h1>${esc(unit.title)}</h1></header>
      <section class="card intro-note"><p>${unit.intro}</p></section>
      <button class="btn primary" data-action="start" data-unit="${unit.id}">${label}</button>
      <h3>${unit.stage === 'sounds' ? 'Sounds' : 'Words & phrases'} <span class="muted small">${learned}/${total} learned · tap to hear</span></h3>
      <div class="${items[0].kind === 'sound' ? 'stack' : 'card list'}">${rows}</div>
      ${pairs}
    </main>${tabbar()}`;
}

function phrasebook() {
  const q = stripAccents(normalize(view.q || ''));
  const groups = course.units.filter((u) => u.stage !== 'sounds').map((u) => {
    const items = u.items.map((i) => course.items[i.id]).filter((it) =>
      !q || stripAccents(normalize(it.sk)).includes(q) || normalize(it.en).includes(q));
    if (!items.length) return '';
    return `<h3>${esc(u.title)}</h3><div class="card list">${items.map((it) =>
      `<button class="row" data-action="play" data-text="${attr(it.sk)}">
        <span class="row-main"><span class="sk" lang="sk">${esc(it.sk)}</span> ${genderChip(it.g)}<span class="en">${esc(it.en)}</span>
        ${it.note ? `<span class="note">${esc(it.note)}</span>` : ''}</span>
        ${state.cards[it.id] ? `<span class="learned">${ICON.check}</span>` : ''}
      </button>`).join('')}</div>`;
  }).join('');
  return `<main class="screen">
      <header class="topbar"><h1>Phrasebook</h1></header>
      <input class="search" type="search" placeholder="Search Slovak or English…" value="${attr(view.q || '')}" data-input="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      ${groups || '<p class="muted center">Nothing found.</p>'}
    </main>${tabbar()}`;
}

function recentPhrases() {
  const t = today();
  return Object.entries(state.introduced)
    .filter(([id, d]) => t - d < 7 && course.items[id] && course.items[id].kind !== 'sound')
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => course.items[id]);
}

function progress() {
  const t = today();
  const now = dayToDate(t);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Monday first
  const firstDayNum = t - (now.getDate() - 1);
  let practiced = 0;
  let cells = '<span></span>'.repeat(offset);
  for (let d = 0; d < daysInMonth; d++) {
    const num = firstDayNum + d;
    const did = !!state.days[num];
    if (did) practiced++;
    cells += `<span class="day ${did ? 'did' : ''} ${num === t ? 'is-today' : ''} ${num > t ? 'future' : ''}">${d + 1}</span>`;
  }
  const cards = Object.entries(state.cards).filter(([id]) => course.items[id]).map(([, c]) => c);
  const learned = cards.length;
  const solid = cards.filter((c) => c.s >= 21).length;
  const tomorrow = cards.filter((c) => c.due <= t + 1).length;
  const recent = recentPhrases();
  const monthName = now.toLocaleString('en-US', { month: 'long' });

  return `<main class="screen">
      <header class="topbar"><h1>Progress</h1></header>
      <section class="card">
        <div class="cal-head"><b>${monthName}</b><span class="muted">${practiced} ${practiced === 1 ? 'day' : 'days'} practiced</span></div>
        <div class="cal"><span class="dow">M</span><span class="dow">T</span><span class="dow">W</span><span class="dow">T</span><span class="dow">F</span><span class="dow">S</span><span class="dow">S</span>${cells}</div>
      </section>
      <section class="stats">
        <div class="card stat"><b>${learned}</b><span>learned</span></div>
        <div class="card stat"><b>${solid}</b><span>in long-term memory</span></div>
        <div class="card stat"><b>${tomorrow}</b><span>due by tomorrow</span></div>
      </section>
      <section class="card together">
        <h3>Practice together</h3>
        ${recent.length ? `<p class="muted small">New this week. Try these out loud at home.</p>
          <ul class="plain">${recent.map((it) => `<li><button class="row" data-action="play" data-text="${attr(it.sk)}"><span class="row-main"><span class="sk" lang="sk">${esc(it.sk)}</span><span class="en">${esc(it.en)}</span></span></button></li>`).join('')}</ul>
          <button class="btn secondary" data-action="share">Share this list</button>`
        : '<p class="muted small">Phrases you learn this week will show up here, so you can use them in real life.</p>'}
      </section>
    </main>${tabbar()}`;
}

function settings() {
  const s = state.settings;
  const voices = audio.availableVoices();
  const seg = (key, options) => `<div class="seg">${options.map(([v, label]) =>
    `<button class="${String(s[key]) === String(v) ? 'on' : ''}" data-action="set" data-key="${key}" data-value="${v}">${label}</button>`).join('')}</div>`;
  const voiceOptions = [['mix', 'Mix'], ...voices.map((v) => [v, audio.VOICE_LABELS[v] || v]), ['device', 'iPhone']];
  return `<main class="screen">
      <header class="topbar"><h1>Settings</h1></header>
      <section class="card form">
        <label>New items per day</label>${seg('newPerDay', [[5, '5 · relaxed'], [8, '8 · steady'], [12, '12 · keen']])}
        <label>Voice</label>${voices.length ? seg('voice', voiceOptions)
          : '<p class="muted small">Using your device\'s built-in Slovak voice. Higher-quality voices appear here once the audio pack is generated.</p>'}
        <label class="toggle"><span>Play audio automatically</span><input type="checkbox" data-action="toggle" data-key="autoplay" ${s.autoplay ? 'checked' : ''}></label>
        <label class="toggle"><span>Mix clinic phrases into daily lessons</span><input type="checkbox" data-action="toggle" data-key="clinicMix" ${s.clinicMix ? 'checked' : ''}></label>
        <p class="muted small">After the Sounds stage, every third new item comes from "In the clinic". Turn off to do it after the grammar instead.</p>
      </section>
      <section class="card form">
        <label>Backup</label>
        <p class="muted small">Progress is stored on this device. Copy a backup now and then, e.g. into Notes.</p>
        <button class="btn secondary" data-action="export">Copy backup</button>
        <textarea data-input="import" placeholder="Paste a backup here to restore it" rows="3"></textarea>
        <button class="btn secondary" data-action="import">Restore backup</button>
      </section>
      <section class="card form">
        <button class="btn danger" data-action="reset">Reset all progress</button>
      </section>
      <p class="muted small center">Po slovensky · made with love ❤️<br>Reviews are scheduled with FSRS, so things come back right before you'd forget them.</p>
    </main>${tabbar()}`;
}

// --- session ------------------------------------------------------------------------

function startSession(opts) {
  const queue = buildSession(opts);
  if (!queue.length) { toast('Nothing to practice here right now.'); return; }
  sess = { queue, idx: 0, graded: new Set(), stats: { reviewed: 0, learned: 0, right: 0, total: 0 }, ex: null, phase: 'question', fb: null };
  nextExercise();
}

function nextExercise() {
  recordedUrl = null;
  if (sess.idx >= sess.queue.length) { view = { name: 'summary' }; render(); return; }
  const q = sess.queue[sess.idx];
  if (q.kind === 'pair') {
    const target = Math.random() < 0.5 ? 'a' : 'b';
    sess.ex = { type: 'pair', pair: q.pair, target };
  } else if (q.kind === 'lesson') {
    sess.ex = { type: 'lesson', unit: unitById(q.unit) };
  } else if (q.kind === 'intro') {
    sess.ex = { type: 'intro', item: course.items[q.id] };
  } else {
    sess.ex = makeExercise(q.id, { easy: q.retry, isNew: q.isNew });
  }
  sess.phase = 'question';
  sess.fb = null;
  view = { name: 'session' };
  render();
  autoplayQuestion();
}

function autoplayQuestion() {
  const ex = sess.ex;
  const audioFirst = { pair: 1, sound_pick: 1, listen_choose: 1, dictation: 1 };
  if (audioFirst[ex.type]) return playTarget();
  if (ex.type === 'intro' && state.settings.autoplay) {
    audio.play(ex.item.kind === 'sound' ? ex.item.examples[0].sk : ex.item.sk);
  }
}

function targetText(ex) {
  if (ex.type === 'pair') return ex.pair[ex.target];
  return ex.target || ex.item.sk;
}

function playTarget(slow = false) {
  audio.play(targetText(sess.ex), { slow });
}

function answer(result, extra = {}) {
  const ex = sess.ex;
  const q = sess.queue[sess.idx];
  const correct = result !== 'wrong';
  sess.stats.total++;
  if (correct) sess.stats.right++;

  if (ex.type === 'pair') {
    recordPair(ex.pair, correct);
  } else if (!sess.graded.has(q.id)) {
    sess.graded.add(q.id);
    const wasNew = !state.cards[q.id];
    gradeItem(q.id, result === 'exact' ? 3 : correct ? 2 : 1);
    if (wasNew) sess.stats.learned++; else sess.stats.reviewed++;
  }
  if (!correct && ex.type !== 'pair') {
    // Bring it back a few cards later in an easier form, until she gets it.
    sess.queue.splice(Math.min(sess.idx + 4, sess.queue.length), 0, { kind: 'review', id: q.id, retry: true });
  }
  sess.phase = 'feedback';
  sess.fb = { result, ...extra };
  render();
  const listenedAlready = { pair: 1, sound_pick: 1, listen_choose: 1, dictation: 1 }[ex.type];
  if (!listenedAlready || !correct) audio.play(targetText(ex));
}

function listenBlock() {
  return `<div class="listen">
      <button class="listen-btn" data-action="replay" aria-label="Play again">${ICON.speaker}</button>
      <button class="icon-btn slow" data-action="replay-slow" aria-label="Play slowly">${ICON.slow}</button>
    </div>`;
}

function micBlock(text) {
  if (!audio.canRecord()) return '';
  return `<div class="mic">
      <button class="btn ghost ${recording ? 'rec' : ''}" data-action="${recording ? 'rec-stop' : 'rec-start'}">${recording ? ICON.stop + ' Stop' : ICON.mic + ' Say it yourself'}</button>
      ${recordedUrl ? `<button class="btn ghost" data-action="rec-play">▶ You</button><button class="btn ghost" data-action="play" data-text="${attr(text)}">▶ Native</button>` : ''}
    </div>`;
}

function typeBlock(placeholder) {
  return `<input class="answer-input" data-input="answer" lang="sk" placeholder="${placeholder}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
    <div class="accents">${ACCENTS.map((c) => `<button data-action="accent" data-char="${c}" tabindex="-1">${c}</button>`).join('')}</div>
    <button class="link small" data-action="no-typing">Can't type right now</button>`;
}

function optionButtons(options, getLabel, getKey, lang) {
  const fb = sess.fb;
  return `<div class="options">${options.map((o) => {
    const key = getKey(o);
    let cls = '';
    if (fb) {
      if (key === fb.correctKey) cls = 'right';
      else if (key === fb.chosen) cls = 'wrong';
      else cls = 'dim';
    }
    return `<button class="option ${cls}" data-action="choose" data-key="${attr(key)}" ${fb ? 'disabled' : ''} ${lang ? `lang="${lang}"` : ''}>${esc(getLabel(o))}</button>`;
  }).join('')}</div>`;
}

function exerciseBody() {
  const ex = sess.ex;
  const it = ex.item;
  switch (ex.type) {
    case 'lesson':
      return `<div class="label">New lesson</div><h2 class="lesson-title">${esc(ex.unit.title)}</h2>
        <div class="card intro-note lesson">${ex.unit.intro}</div>`;
    case 'cloze': {
      const gap = sess.fb
        ? `<span class="gap filled ${sess.fb.result === 'wrong' ? 'bad' : ''}">${esc(it.blank)}</span>`
        : '<span class="gap">&nbsp;</span>';
      return `<div class="label">Fill the gap</div><div class="muted">${esc(it.en)}</div>
        <div class="cloze-sentence" lang="sk">${withBlank(it, gap)}</div>
        ${optionButtons(ex.options, (o) => o, (o) => o, 'sk')}`;
    }
    case 'intro':
      if (it.kind === 'sound') {
        return `<div class="label">New sound</div>${soundItemBlock(it)}${micBlock(it.examples[0].sk)}`;
      }
      return `<div class="label">New ${it.kind === 'word' ? 'word' : 'phrase'}</div>
        <div class="big-sk" lang="sk">${it.blank ? withBlank(it, `<mark class="hl">${esc(it.blank)}</mark>`) : esc(it.sk)} ${genderChip(it.g)}</div>
        <div class="listen small-listen">${playBtn(it.sk, 'round')}<button class="icon-btn slow" data-action="play-slow" data-text="${attr(it.sk)}" aria-label="Play slowly">${ICON.slow}</button></div>
        <div class="big-en">${esc(it.en)}</div>
        ${it.note ? `<p class="note-box">${esc(it.note)}</p>` : ''}
        ${micBlock(it.sk)}`;
    case 'pair':
      return `<div class="label">Which one did you hear?</div>${listenBlock()}
        ${optionButtons(['a', 'b'], (k) => ex.pair[k], (k) => k, 'sk')}
        <div class="pair-hints muted small"><span>${esc(ex.pair.a)} = ${esc(ex.pair.ea)}</span><span>${esc(ex.pair.b)} = ${esc(ex.pair.eb)}</span></div>`;
    case 'sound_pick':
      return `<div class="label">Listen: which word is it?</div><div class="muted center">Practising <b lang="sk">${esc(it.sk)}</b></div>${listenBlock()}
        ${optionButtons(ex.options, (o) => o.sk, (o) => o.sk, 'sk')}`;
    case 'listen_choose':
      return `<div class="label">What does this mean?</div>${listenBlock()}
        ${optionButtons(ex.options, (o) => o.label, (o) => o.id)}`;
    case 'read_choose':
      return `<div class="label">How do you say…</div><div class="prompt">${esc(it.en)}</div>
        ${optionButtons(ex.options, (o) => o.label, (o) => o.id, 'sk')}`;
    case 'build': {
      const chosen = ex.chosen.map((c) => `<button class="tile" data-action="untile" data-i="${c.i}" ${sess.fb ? 'disabled' : ''}>${esc(c.t)}</button>`).join('');
      const bank = ex.bank.map((c) => ex.chosen.includes(c) ? `<span class="tile ghost">${esc(c.t)}</span>`
        : `<button class="tile" data-action="tile" data-i="${c.i}" ${sess.fb ? 'disabled' : ''}>${esc(c.t)}</button>`).join('');
      return `<div class="label">Build it in Slovak</div><div class="prompt">${esc(it.en)}</div>
        <div class="tiles answer-line" lang="sk">${chosen || '<span class="muted small">Tap the words in order</span>'}</div>
        <div class="tiles bank" lang="sk">${bank}</div>`;
    }
    case 'type':
      return `<div class="label">Type it in Slovak</div><div class="prompt">${esc(it.en)}</div>${sess.fb ? '' : typeBlock('Type in Slovak…')}`;
    case 'dictation':
      return `<div class="label">Type what you hear</div>${listenBlock()}${sess.fb ? '' : typeBlock('What did you hear?')}`;
  }
  return '';
}

// The sentence with its grammar slot replaced by `html` (already escaped).
function withBlank(item, html) {
  const i = item.sk.indexOf(item.blank);
  return esc(item.sk.slice(0, i)) + html + esc(item.sk.slice(i + item.blank.length));
}

function diffAccents(typed, target) {
  // Highlight letters where only the accent was missing.
  const t = [...target];
  const u = [...typed.normalize('NFC')];
  if (stripAccents(normalize(typed)) !== stripAccents(normalize(target)) || t.length !== u.length) return esc(target);
  return t.map((ch, i) => (ch.toLowerCase() !== (u[i] || '').toLowerCase() ? `<mark>${esc(ch)}</mark>` : esc(ch))).join('');
}

function feedbackBar() {
  const ex = sess.ex;
  const fb = sess.fb;
  const sk = targetText(ex);
  const en = ex.type === 'pair' ? ex.pair[ex.target === 'a' ? 'ea' : 'eb'] : (ex.targetEn || ex.item.en);
  let title;
  let body = '';
  if (fb.result === 'exact') title = PRAISE[Math.floor(Math.random() * PRAISE.length)];
  else if (fb.result === 'accents') { title = 'Almost: watch the accents'; body = `<div class="fb-sk" lang="sk">${diffAccents(fb.typed, fb.target)}</div>`; }
  else if (fb.result === 'typo') { title = 'Close, just a small typo'; }
  else title = 'Not quite';
  if (!body) body = `<div class="fb-sk" lang="sk">${esc(fb.target || sk)}</div>`;
  const compare = ex.type === 'pair'
    ? `<div class="fb-compare"><button class="chip" data-action="play" data-text="${attr(ex.pair.a)}" lang="sk">${ICON.speaker} ${esc(ex.pair.a)}</button><button class="chip" data-action="play" data-text="${attr(ex.pair.b)}" lang="sk">${ICON.speaker} ${esc(ex.pair.b)}</button></div>`
    : `<button class="icon-btn" data-action="play" data-text="${attr(fb.target || sk)}" aria-label="Play">${ICON.speaker}</button>`;
  return `<footer class="feedback ${fb.result === 'wrong' ? 'bad' : 'good'}">
      <div class="fb-title">${title}</div>
      <div class="fb-answer">${body}${ex.type === 'pair' ? '' : compare}</div>
      <div class="fb-en">${esc(en)}</div>
      ${ex.type === 'pair' ? compare : ''}
      <button class="btn primary big" data-action="continue">Continue</button>
    </footer>`;
}

function sessionScreen() {
  const ex = sess.ex;
  const pct = Math.round(100 * sess.idx / sess.queue.length);
  let footer = '';
  if (sess.phase === 'feedback') footer = feedbackBar();
  else if (ex.type === 'intro' || ex.type === 'lesson') footer = '<footer class="actions"><button class="btn primary big" data-action="continue">Got it</button></footer>';
  else if (ex.type === 'type' || ex.type === 'dictation') footer = '<footer class="actions"><button class="btn primary big" data-action="check-typed">Check</button></footer>';
  else if (ex.type === 'build') footer = `<footer class="actions"><button class="btn primary big" data-action="check-build" ${ex.chosen.length ? '' : 'disabled'}>Check</button></footer>`;
  return `<div class="session">
      <header class="session-top"><button class="icon-btn" data-action="quit" aria-label="Close">${ICON.close}</button><div class="bar"><i style="width:${pct}%"></i></div></header>
      <main class="exercise ex-${ex.type}">${exerciseBody()}</main>
      ${footer}
    </div>`;
}

function summary() {
  const s = sess.stats;
  const acc = s.total ? Math.round(100 * s.right / s.total) : 100;
  return `<main class="screen summary">
      <div class="summary-mark">${ICON.check}</div>
      <h1 lang="sk">Výborne!</h1>
      <p class="muted">Session complete.</p>
      <section class="stats">
        ${s.learned ? `<div class="card stat"><b>${s.learned}</b><span>new</span></div>` : ''}
        <div class="card stat"><b>${s.reviewed}</b><span>reviewed</span></div>
        <div class="card stat"><b>${acc}%</b><span>first-try accuracy</span></div>
      </section>
      <button class="btn primary big" data-action="nav" data-to="home">Done</button>
    </main>`;
}

// --- events -----------------------------------------------------------------------------

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function afterRender() {
  const input = app.querySelector('[data-input="answer"]');
  if (input) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions['check-typed'](); } });
    // Focusing right after a tap keeps the iOS keyboard up between questions.
    setTimeout(() => input.focus(), 50);
  }
  const search = app.querySelector('[data-input="search"]');
  if (search) {
    search.addEventListener('input', () => {
      view.q = search.value;
      const pos = search.selectionStart;
      render();
      const s2 = app.querySelector('[data-input="search"]');
      s2.focus();
      s2.setSelectionRange(pos, pos);
    });
  }
}

const actions = {
  nav: (el) => { view = { name: el.dataset.to }; if (el.dataset.to === 'home') sess = null; render(); window.scrollTo(0, 0); },
  unit: (el) => { view = { name: 'unit', id: el.dataset.id }; render(); window.scrollTo(0, 0); },
  start: (el) => startSession({ unitId: el.dataset.unit || null, extra: !!el.dataset.extra }),
  play: (el) => audio.play(el.dataset.text),
  'play-slow': (el) => audio.play(el.dataset.text, { slow: true }),
  replay: () => playTarget(false),
  'replay-slow': () => playTarget(true),
  quit: () => { audio.stop(); sess = null; view = { name: 'home' }; render(); },
  continue: () => { sess.idx++; nextExercise(); },
  choose: (el) => {
    if (sess.phase !== 'question') return;
    const ex = sess.ex;
    const key = el.dataset.key;
    let correctKey;
    if (ex.type === 'pair') correctKey = ex.target;
    else if (ex.type === 'sound_pick') correctKey = ex.target;
    else if (ex.type === 'cloze') correctKey = ex.item.blank;
    else correctKey = ex.item.id;
    answer(key === correctKey ? 'exact' : 'wrong', { chosen: key, correctKey });
  },
  tile: (el) => {
    const ex = sess.ex;
    const tile = ex.bank.find((c) => c.i === Number(el.dataset.i));
    if (tile && !ex.chosen.includes(tile)) { ex.chosen.push(tile); audio.play(tile.t); }
    render();
  },
  untile: (el) => {
    const ex = sess.ex;
    ex.chosen = ex.chosen.filter((c) => c.i !== Number(el.dataset.i));
    render();
  },
  'check-build': () => {
    const ex = sess.ex;
    const built = ex.chosen.map((c) => c.t).join(' ');
    const ok = normalize(built) === normalize(tokens(ex.item.sk).join(' '));
    answer(ok ? 'exact' : 'wrong', { target: ex.item.sk });
  },
  'check-typed': () => {
    if (sess?.phase !== 'question') return;
    const ex = sess.ex;
    const input = app.querySelector('[data-input="answer"]');
    const typed = input?.value || '';
    if (!typed.trim()) { input?.focus(); return; }
    const res = checkTyped(typed, ex.targets || [ex.target]);
    input?.blur();
    answer(res.result, { target: res.target, typed });
  },
  accent: (el) => {
    const input = app.querySelector('[data-input="answer"]');
    if (!input) return;
    const s = input.selectionStart ?? input.value.length;
    const e = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + el.dataset.char + input.value.slice(e);
    input.focus();
    input.setSelectionRange(s + 1, s + 1);
  },
  'no-typing': () => {
    // Swap to a multiple-choice version with no penalty.
    const q = sess.queue[sess.idx];
    if (sess.ex.item.kind === 'sound') return;
    sess.ex = makeExercise(q.id, { easy: true });
    if (sess.ex.type === 'type') return toast('No multiple-choice version for this one.');
    render();
  },
  'rec-start': async () => {
    try {
      await audio.startRecording();
      recording = true;
      render();
    } catch { toast('Microphone not available. Check Settings → Safari → Microphone.'); }
  },
  'rec-stop': async () => {
    recordedUrl = await audio.stopRecording();
    recording = false;
    render();
    if (recordedUrl) audio.playUrl(recordedUrl);
  },
  'rec-play': () => recordedUrl && audio.playUrl(recordedUrl),
  set: (el) => {
    const v = el.dataset.value;
    state.settings[el.dataset.key] = /^\d+$/.test(v) ? Number(v) : v;
    save();
    render();
  },
  toggle: (el) => { state.settings[el.dataset.key] = el.checked; save(); },
  'hide-install': () => { try { sessionStorage.setItem('hideInstall', '1'); } catch { /* ignore */ } render(); },
  share: async () => {
    const text = 'Slovak I learned this week:\n' + recentPhrases().map((it) => `• ${it.sk} — ${it.en}`).join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Copied!'); }
    } catch { /* cancelled */ }
  },
  export: async () => {
    try { await navigator.clipboard.writeText(exportState()); toast('Backup copied. Paste it somewhere safe.'); }
    catch { toast('Could not copy on this device.'); }
  },
  import: () => {
    const ta = app.querySelector('[data-input="import"]');
    try { importState(ta.value.trim()); toast('Backup restored.'); render(); }
    catch { toast('That doesn\'t look like a valid backup.'); }
  },
  reset: () => {
    if (confirm('Erase all progress on this device? This cannot be undone.')) { resetState(); toast('Progress reset.'); render(); }
  },
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  if (el.tagName === 'INPUT') return; // checkboxes handled on change
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
app.addEventListener('change', (e) => {
  const el = e.target.closest('input[data-action="toggle"]');
  if (el) actions.toggle(el);
});
// Keep the keyboard open when tapping accent buttons.
app.addEventListener('pointerdown', (e) => { if (e.target.closest('.accents button')) e.preventDefault(); });

// --- boot ----------------------------------------------------------------------------------

(async function boot() {
  await Promise.all([loadCourse(), audio.loadAudioManifest()]);
  render();
  const dev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
