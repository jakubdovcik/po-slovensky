import {
  state, save, today, dayToDate, exportState, importState, resetState, logActivity,
  profiles, switchProfile, addProfile, deleteProfile,
} from './store.js';
import {
  course, loadCourse, unitById, unitProgress, makeExercise, buildSession, gradeItem, recordPair,
  checkTyped, todaySummary, normalize, stripAccents, tokens,
} from './course.js';
import {
  story, loadStory, fill, partnerName, chapterStatus, nextChapter, completeChapter, doneCount,
  startScene, advance, choose,
} from './story.js';
import { weekStats, totals, stageProgress, hardest, reportUrl } from './progress.js';
import * as audio from './audio.js';

const app = document.getElementById('app');
let view = { name: 'home' };
let sess = null;
let scene = null;
let recordedUrl = null;
let recording = false;

// --- tiny helpers ----------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = esc;
const escFill = (s) => esc(fill(s));

const svg = (body, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;
const ICON = {
  speaker: svg('<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  slow: svg('<path d="M3 15c0-4 3-7 7.5-7S18 11 18 15H3z" fill="currentColor"/><path d="M18 13h1.5a1.5 1.5 0 0 0 0-3H18M5 15l-1 3M15.5 15l1 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  back: svg('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  learn: svg('<path d="M3 9l9-5 9 5-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5M21 9v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  story: svg('<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/>'),
  book: svg('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z M5 17a3 3 0 0 1 3-3h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
  chart: svg('<path d="M5 20V11M12 20V5M19 20v-6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  gear: svg('<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  send: svg('<path d="M4 12l16-8-6 16-3-7-7-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
};

// The double cross from the Slovak coat of arms, used as the brand mark and on stamps.
const CROSS = '<svg class="cross" viewBox="0 0 20 28" aria-hidden="true"><path d="M8 0h4v28H8zM4 6h12v3.5H4zM1 13h18v3.5H1z" fill="currentColor"/></svg>';

const ACCENTS = ['á', 'ä', 'č', 'ď', 'é', 'í', 'ľ', 'ň', 'ó', 'ô', 'š', 'ť', 'ú', 'ý', 'ž'];
const PRAISE = ['Správne!', 'Výborne!', 'Super!', 'Presne tak!', 'Skvelé!'];
const GENDER = { m: 'masculine', f: 'feminine', n: 'neuter', pl: 'plural' };

const genderChip = (g) => g ? `<span class="g g-${g}" title="${GENDER[g]}">${g === 'pl' ? 'pl' : g}</span>` : '';
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** A progress ring, a nod to Wellesley's hoop rolling. */
function hoop(pct, { size = 44, label = '', cls = '' } = {}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;
  return `<span class="hoop ${done ? 'full' : ''} ${cls}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${r}" class="hoop-track"/>
    <circle cx="22" cy="22" r="${r}" class="hoop-arc" stroke-dasharray="${(c * Math.min(1, pct)).toFixed(1)} ${c.toFixed(1)}"/></svg>
    <span class="hoop-label">${done ? ICON.check : esc(label)}</span></span>`;
}

const fmtMinutes = (secs) => (secs < 60 ? `${Math.round(secs)}s` : `${Math.round(secs / 60)}`);

// --- rendering --------------------------------------------------------------------

function render() {
  if (view.name !== 'session' && view.name !== 'scene') audio.stop();
  if (!state.name && view.name !== 'welcome') view = { name: 'welcome' };
  const screens = { welcome, home, unit: unitScreen, story: storyScreen, scene: sceneScreen, postcard: postcardScreen,
    phrasebook, progress, settings, session: sessionScreen, summary };
  app.innerHTML = screens[view.name]();
  app.dataset.view = view.name;
  afterRender();
}

function tabbar() {
  const active = { unit: 'home', postcard: 'story' }[view.name] || view.name;
  const tab = (name, icon, label) =>
    `<button class="tab ${active === name ? 'on' : ''}" data-action="nav" data-to="${name}">${ICON[icon]}<span>${label}</span></button>`;
  return `<nav class="tabbar">${tab('home', 'learn', 'Learn')}${tab('story', 'story', 'Story')}${tab('phrasebook', 'book', 'Phrases')}${tab('progress', 'chart', 'Progress')}${tab('settings', 'gear', 'Settings')}</nav>`;
}

const masthead = (kicker) => `<div class="kicker">${CROSS}<span>${esc(kicker)}</span></div>`;

function greeting() {
  const h = new Date().getHours();
  if (h < 10) return ['Dobré ráno', 'Good morning'];
  if (h < 18) return ['Dobrý deň', 'Good afternoon'];
  return ['Dobrý večer', 'Good evening'];
}

function welcome() {
  return `<main class="screen welcome">
      <div class="welcome-mark">${CROSS}</div>
      <div class="kicker center-k"><span>Po slovensky</span></div>
      <h1 class="display">Vitaj!</h1>
      <p class="lede">A gentle Slovak course, with a story waiting at the end of every few lessons.</p>
      <label class="field-label" for="nm">What's your first name?</label>
      <input id="nm" class="text-input" data-input="name" autocomplete="given-name" placeholder="Your name" enterkeyhint="go">
      <button class="btn primary big" data-action="set-name">Začnime · Let's begin</button>
    </main>`;
}

function storyTeaser() {
  const next = nextChapter();
  if (!story.chapters.length) return '';
  if (!next) {
    return `<button class="card teaser done-all c-gold" data-action="nav" data-to="story">
      <div class="teaser-body"><div class="teaser-kicker">Cesta domov · Complete</div>
      <div class="teaser-title">All ${story.chapters.length} postcards collected</div><div class="teaser-line">Replay any chapter from the Story tab.</div></div>
      ${hoop(1, { size: 52, cls: 'on-color' })}</button>`;
  }
  const { ch, index, status } = next;
  let line;
  if (status.unlocked) line = `<span class="go">Ready to play ${ICON.arrow}</span>`;
  else if (!status.prevDone) line = `Finish chapter ${index} first`;
  else line = `Unlocks after ${status.remaining.length} more ${status.remaining.length === 1 ? 'unit' : 'units'}`;
  return `<button class="card teaser c-${ch.color} ${status.unlocked ? 'ready' : ''}" data-action="${status.unlocked ? 'play-chapter' : 'nav'}" data-to="story" data-index="${index}">
      <div class="teaser-body">
        <div class="teaser-kicker">Kapitola ${index + 1} · ${escFill(ch.place)}</div>
        <div class="teaser-title">${esc(ch.title)}</div>
        <div class="teaser-line">${line}</div>
      </div>
      ${hoop(status.unlocked ? 1 : status.pct, { size: 52, label: String(index + 1), cls: 'on-color' })}
    </button>`;
}

function home() {
  const [sk, en] = greeting();
  const { due, fresh, minutes } = todaySummary();
  const nothing = due === 0 && fresh === 0;
  const anyCards = Object.keys(state.cards).length > 0;
  const showInstall = isIOS() && !isStandalone() && !sessionStorage.getItem('hideInstall');

  const todayCard = nothing
    ? `<section class="block today done">
        <div class="block-kicker">Dnes · Today</div>
        <div class="today-title">Hotovo. All done.</div>
        <p>Nothing is due. Come back tomorrow, or keep going if you're in the mood.</p>
        ${anyCards ? '<button class="btn light" data-action="start" data-extra="1">Practice a bit more</button>' : ''}
      </section>`
    : `<section class="block today">
        <div class="block-kicker">Dnes · Today</div>
        <div class="today-stats">
          ${due ? `<div><b>${due}</b><span>to review</span></div>` : ''}
          ${fresh ? `<div><b>${fresh}</b><span>new</span></div>` : ''}
          <div><b>${minutes}</b><span>minutes</span></div>
        </div>
        <button class="btn light big" data-action="start">${anyCards ? 'Start' : 'Start your first lesson'} ${ICON.arrow}</button>
      </section>`;

  const stages = course.stages.map((stage, si) => {
    const units = course.units.filter((u) => u.stage === stage.id).map((u) => {
      const { learned, total } = unitProgress(u);
      return `<button class="unit-row" data-action="unit" data-id="${u.id}">
          ${hoop(learned / total, { size: 40, label: total - learned ? String(total - learned) : '' })}
          <span class="unit-text"><span class="unit-title">${esc(u.title)}</span>
          <span class="unit-sub">${learned}/${total} learned</span></span>
        </button>`;
    }).join('');
    return `<section class="stage">
        <div class="stage-head"><span class="stage-num">${String(si + 1).padStart(2, '0')}</span>
        <div><h2>${esc(stage.title)}</h2><p>${esc(stage.subtitle)}</p></div></div>
        <div class="card list">${units}</div></section>`;
  }).join('');

  return `<main class="screen">
      <header class="hello">${masthead('Po slovensky')}
        <h1 class="display" lang="sk">${sk}, <em>${esc(state.name)}</em>.</h1><p class="muted">${en}</p></header>
      ${showInstall ? `<section class="card hint"><b>Tip:</b> tap <b>Share</b> → <b>Add to Home Screen</b> to install this like an app. It works offline too.<button class="link" data-action="hide-install">Hide</button></section>` : ''}
      ${todayCard}
      ${storyTeaser()}
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

function itemRow(it) {
  return `<button class="row" data-action="play" data-text="${attr(it.sk)}">
      <span class="row-main"><span class="sk" lang="sk">${esc(it.sk)}</span> ${genderChip(it.g)}<span class="en">${esc(it.en)}</span>
      ${it.note ? `<span class="note">${esc(it.note)}</span>` : ''}</span>
      ${state.cards[it.id] ? `<span class="learned">${ICON.check}</span>` : ''}
    </button>`;
}

function unitScreen() {
  const unit = unitById(view.id);
  const stage = course.stages.find((s) => s.id === unit.stage);
  const { learned, total } = unitProgress(unit);
  const items = unit.items.map((i) => course.items[i.id]);
  const rows = items.map((it) => it.kind === 'sound' ? `<div class="card">${soundItemBlock(it)}</div>` : itemRow(it)).join('');
  const pairs = unit.pairs ? `<h3>Listen for the difference</h3><div class="card list">${unit.pairs.map((p) =>
      `<div class="pair-row"><button class="chip" data-action="play" data-text="${attr(p.a)}" lang="sk">${esc(p.a)} <small>${esc(p.ea)}</small></button>
       <span class="muted">vs</span>
       <button class="chip" data-action="play" data-text="${attr(p.b)}" lang="sk">${esc(p.b)} <small>${esc(p.eb)}</small></button></div>`).join('')}</div>` : '';
  const label = learned === total ? 'Review this unit' : learned ? 'Continue this unit' : 'Learn this unit';
  return `<main class="screen">
      <header class="topbar"><button class="icon-btn" data-action="nav" data-to="home" aria-label="Back">${ICON.back}</button>
        <div class="kicker-inline">${esc(stage.title)}</div></header>
      <div class="unit-hero">${hoop(learned / total, { size: 64, label: `${learned}/${total}` })}<h1 class="display sm">${esc(unit.title)}</h1></div>
      <section class="card intro-note"><p>${unit.intro}</p></section>
      <button class="btn primary big" data-action="start" data-unit="${unit.id}">${label} ${ICON.arrow}</button>
      <h3>${unit.stage === 'sounds' ? 'Sounds' : 'Words & phrases'} <span class="muted small">tap to hear</span></h3>
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
    return `<h3>${esc(u.title)}</h3><div class="card list">${items.map(itemRow).join('')}</div>`;
  }).join('');
  return `<main class="screen">
      <header class="page-head">${masthead('Slovník')}<h1 class="display sm">Phrasebook</h1></header>
      <input class="search" type="search" placeholder="Search Slovak or English…" value="${attr(view.q || '')}" data-input="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      ${groups || '<p class="muted center">Nothing found.</p>'}
    </main>${tabbar()}`;
}

// --- story -------------------------------------------------------------------------

function storyScreen() {
  const stops = story.chapters.map((ch, i) => {
    const st = chapterStatus(ch, i);
    let body;
    if (st.done) {
      body = `<div class="stop-status ok">${ICON.check} Postcard collected</div>
        <div class="stop-actions"><button class="btn small ghost" data-action="view-postcard" data-index="${i}">See postcard</button>
        <button class="btn small ghost" data-action="play-chapter" data-index="${i}">Replay</button></div>`;
    } else if (st.unlocked) {
      body = `<button class="btn primary" data-action="play-chapter" data-index="${i}">Play chapter ${ICON.arrow}</button>`;
    } else if (!st.prevDone) {
      body = `<div class="stop-status">${ICON.lock} Finish chapter ${i} first</div>`;
    } else {
      const names = st.remaining.map((u) => u.title.split(' · ')[0]);
      body = `<div class="stop-status">${ICON.lock} Learn: ${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? ` +${names.length - 3}` : ''}</div>
        <div class="bar"><i style="width:${Math.round(st.pct * 100)}%"></i></div>`;
    }
    return `<li class="stop ${st.done ? 'is-done' : st.unlocked ? 'is-open' : 'is-locked'} c-${ch.color}">
        <span class="stop-node">${i + 1}</span>
        <div class="stop-card card">
          <div class="stop-place">${escFill(ch.place)}</div>
          <div class="stop-title" lang="sk">${esc(ch.title)}</div>
          <div class="stop-en">${esc(ch.en)}</div>
          ${body}
        </div></li>`;
  }).join('');
  const stamps = story.chapters.map((ch, i) => state.story.done[ch.id]
    ? `<button class="stamp c-${ch.color}" data-action="view-postcard" data-index="${i}">${CROSS}<span class="stamp-place">${escFill(ch.place)}</span><span class="stamp-num">${i + 1}</span></button>`
    : `<span class="stamp empty"><span class="stamp-num">${i + 1}</span></span>`).join('');
  return `<main class="screen">
      <header class="page-head">${masthead('Príbeh · Story')}<h1 class="display">${esc(story.title)}</h1>
        <p class="lede">${escFill(story.subtitle)}. A journey through Slovakia with ${esc(partnerName())}. Each chapter unlocks as you learn.</p></header>
      <section class="stamps-wrap"><div class="section-label">Postcards · ${doneCount()}/${story.chapters.length}</div><div class="stamps">${stamps}</div></section>
      <ol class="journey">${stops}</ol>
    </main>${tabbar()}`;
}

function bubble(b) {
  if (b.t === 'narr') return `<p class="narr">${escFill(b.text)}</p>`;
  if (b.t === 'me') return `<div class="line me"><div class="bubble" lang="sk">${escFill(b.sk)}</div></div>`;
  const ch = story.characters[b.who] || { name: b.who, color: 'navy' };
  const name = fill(ch.name);
  return `<div class="line">
      <span class="avatar c-${ch.color}">${esc(name[0])}</span>
      <div class="bubble"><div class="who">${esc(name)}</div>
        <button class="say" data-action="play-as" data-text="${attr(b.sk)}" data-voice="${ch.voice || ''}" lang="sk">${esc(b.sk)} ${ICON.speaker}</button>
        ${state.settings.showTranslations ? `<div class="tr">${esc(b.en)}</div>` : ''}</div>
    </div>`;
}

function sceneScreen() {
  const ch = scene.ch;
  const transcript = scene.log.map(bubble).join('');
  let footer;
  if (scene.pending) {
    const p = scene.pending;
    footer = `<footer class="scene-foot">
        <div class="choice-prompt">${escFill(p.prompt)}</div>
        ${p.audio ? `<button class="btn ghost small listen-again" data-action="play-as" data-text="${attr(p.audio)}" data-voice="lukas">${ICON.speaker} Listen again</button>` : ''}
        ${scene.hint ? `<div class="hint-bubble">${escFill(scene.hint)}</div>` : ''}
        <div class="choices">${p.options.map((o, n) => `<button class="choice" data-action="scene-choose" data-n="${n}" lang="sk">${escFill(o.sk)}</button>`).join('')}</div>
      </footer>`;
  } else if (scene.finished) {
    footer = `<footer class="scene-foot"><button class="btn primary big" data-action="scene-postcard">${ICON.check} Collect your postcard</button></footer>`;
  } else {
    footer = `<footer class="scene-foot"><button class="btn primary big" data-action="scene-next">Ďalej · Next ${ICON.arrow}</button></footer>`;
  }
  return `<div class="scene c-${ch.color}">
      <header class="scene-top"><button class="icon-btn" data-action="scene-quit" aria-label="Close">${ICON.close}</button>
        <div class="scene-title"><span>Kapitola ${scene.index + 1} · ${escFill(ch.place)}</span><b lang="sk">${esc(ch.title)}</b></div>
        <button class="icon-btn tr-toggle ${state.settings.showTranslations ? 'on' : ''}" data-action="toggle-tr" aria-label="Toggle translations">EN</button></header>
      <main class="transcript">${transcript}</main>
      ${footer}
    </div>`;
}

function postcardScreen() {
  const ch = story.chapters[view.index];
  const note = escFill(ch.postcard).replace(/\n/g, '<br>');
  return `<main class="screen postcard-screen">
      <div class="postcard c-${ch.color}">
        <div class="pc-front"><div class="pc-stamp">${CROSS}<span>${view.index + 1}</span></div>
          <div class="pc-greet">Pozdrav z</div><div class="pc-place">${escFill(ch.place)}</div></div>
        <div class="pc-back"><p class="pc-note">${note}</p><div class="pc-to">To: ${esc(state.name)}</div></div>
      </div>
      ${view.fresh
        ? `<p class="center muted">Chapter ${view.index + 1} complete: ${esc(ch.en)}.</p><button class="btn primary big" data-action="nav" data-to="story">Back to the story ${ICON.arrow}</button>`
        : `<button class="btn primary big" data-action="nav" data-to="story">Back to the story</button>`}
    </main>`;
}

function openChapter(index) {
  scene = startScene(index);
  scene.lastAt = Date.now();
  view = { name: 'scene' };
  const a = advance(scene);
  render();
  if (a) audio.play(a.sk, { voice: a.voice });
}

function sceneTick() {
  const now = Date.now();
  logActivity({ secs: Math.min((now - scene.lastAt) / 1000, 60) });
  scene.lastAt = now;
}

// --- progress ------------------------------------------------------------------------

function recentPhrases() {
  const t = today();
  return Object.entries(state.introduced)
    .filter(([id, d]) => t - d < 7 && course.items[id] && course.items[id].kind !== 'sound')
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => course.items[id]);
}

function calendar() {
  const t = today();
  const now = dayToDate(t);
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const firstDayNum = t - (now.getDate() - 1);
  let practiced = 0;
  let cells = '<span></span>'.repeat(offset);
  for (let d = 0; d < daysInMonth; d++) {
    const num = firstDayNum + d;
    const did = !!state.days[num];
    if (did) practiced++;
    cells += `<span class="day ${did ? 'did' : ''} ${num === t ? 'is-today' : ''} ${num > t ? 'future' : ''}">${d + 1}</span>`;
  }
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  return `<section class="card">
      <div class="cal-head"><b>${monthName}</b><span class="muted">${practiced} ${practiced === 1 ? 'day' : 'days'} practised</span></div>
      <div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="dow">${d}</span>`).join('')}${cells}</div>
    </section>`;
}

function progress() {
  const tot = totals();
  const wk = weekStats();
  const stages = stageProgress();
  const hard = hardest();
  const recent = recentPhrases();
  return `<main class="screen">
      <header class="page-head">${masthead('Pokrok · Progress')}<h1 class="display sm"><em>${esc(state.name)}</em>'s progress</h1></header>
      <section class="block progress-hero">
        ${hoop(tot.learned / tot.total, { size: 92, label: `${Math.round(100 * tot.learned / tot.total)}%`, cls: 'on-color big' })}
        <div><div class="block-kicker">Course</div><div class="hero-num">${tot.learned}<span>/${tot.total}</span></div>
        <div>words &amp; phrases learned · ${tot.solid} in long-term memory</div></div>
      </section>
      <section class="stats">
        <div class="card stat"><b>${fmtMinutes(wk.secs)}</b><span>${wk.secs < 60 ? '' : 'min '}this week</span></div>
        <div class="card stat"><b>${wk.accuracy == null ? '–' : Math.round(wk.accuracy * 100) + '%'}</b><span>accuracy, 7 days</span></div>
        <div class="card stat"><b>${doneCount()}/${story.chapters.length}</b><span>story chapters</span></div>
      </section>
      ${calendar()}
      <section class="card">
        <div class="section-label">By stage</div>
        ${stages.map((s) => `<div class="stage-bar"><div class="sb-head"><span>${esc(s.title)}</span><span class="muted">${s.learned}/${s.total}</span></div>
          <div class="bar"><i style="width:${Math.round(100 * s.learned / s.total)}%"></i></div></div>`).join('')}
      </section>
      ${hard.length ? `<section class="card list"><div class="section-label pad">Trickiest so far</div>${hard.map((h) =>
        `<button class="row" data-action="play" data-text="${attr(h.sk)}"><span class="row-main"><span class="sk" lang="sk">${esc(h.sk)}</span><span class="en">${esc(h.en)}</span></span><span class="lapses">${h.lapses}×</span></button>`).join('')}</section>` : ''}
      <section class="card together">
        <div class="section-label">Practice together</div>
        ${recent.length ? `<p class="muted small">New this week. Try them out loud with ${esc(partnerName())}.</p>
          <ul class="plain">${recent.map((it) => `<li>${itemRow(it)}</li>`).join('')}</ul>
          <button class="btn secondary" data-action="share">Share this list</button>`
        : '<p class="muted small">Phrases you learn this week will show up here.</p>'}
      </section>
      <button class="btn primary big" data-action="send-report">${ICON.send} Send my progress to ${esc(partnerName())}</button>
      <p class="muted small center">Sends a private link with a summary of your progress. No account, no server: the data travels inside the link itself.</p>
    </main>${tabbar()}`;
}

function settings() {
  const s = state.settings;
  const voices = audio.availableVoices();
  const seg = (key, options) => `<div class="seg">${options.map(([v, label]) =>
    `<button class="${String(s[key]) === String(v) ? 'on' : ''}" data-action="set" data-key="${key}" data-value="${v}">${label}</button>`).join('')}</div>`;
  const toggle = (key, label) => `<label class="toggle"><span>${label}</span><input type="checkbox" data-action="toggle" data-key="${key}" ${s[key] ? 'checked' : ''}></label>`;
  const voiceOptions = [['mix', 'Mix'], ...voices.map((v) => [v, audio.VOICE_LABELS[v] || v]), ['device', 'iPhone']];
  const people = profiles();
  return `<main class="screen">
      <header class="page-head">${masthead('Nastavenia')}<h1 class="display sm">Settings</h1></header>
      <section class="card form">
        <label>Learner</label>
        <div class="learners">${people.map((p) => `<div class="learner ${p.current ? 'on' : ''}">
            <span class="avatar c-blue">${esc((p.name || '?')[0])}</span><span class="ln">${esc(p.name || 'Unnamed')}</span>
            ${p.current ? '<span class="muted small">current</span>' : `<button class="btn small ghost" data-action="switch-profile" data-id="${p.id}">Switch</button>`}
            ${!p.current && p.id !== 'main' ? `<button class="link small danger-link" data-action="delete-profile" data-id="${p.id}">Remove</button>` : ''}
          </div>`).join('')}</div>
        <div class="inline-form"><input class="text-input sm" data-input="rename" value="${attr(state.name)}" placeholder="Name"><button class="btn small secondary" data-action="rename">Rename</button></div>
        <div class="inline-form"><input class="text-input sm" data-input="new-learner" placeholder="Add another learner"><button class="btn small secondary" data-action="add-profile">Add</button></div>
        <p class="muted small">Each learner on this phone has their own progress, story and stats.</p>
      </section>
      <section class="card form">
        <label>New items per day</label>${seg('newPerDay', [[5, '5 · relaxed'], [8, '8 · steady'], [12, '12 · keen']])}
        <label>Voice</label>${voices.length ? seg('voice', voiceOptions)
          : '<p class="muted small">Using your device\'s built-in Slovak voice.</p>'}
        ${toggle('autoplay', 'Play audio automatically')}
        ${toggle('showTranslations', 'Show English in story scenes')}
        ${toggle('clinicMix', 'Mix clinic phrases into daily lessons')}
        <p class="muted small">After the Sounds stage, every third new item comes from "In the clinic".</p>
      </section>
      <section class="card form">
        <label>Backup</label>
        <p class="muted small">Progress is stored on this phone. Copy a backup now and then, e.g. into Notes.</p>
        <button class="btn secondary" data-action="export">Copy backup</button>
        <textarea data-input="import" placeholder="Paste a backup here to restore it" rows="3"></textarea>
        <button class="btn secondary" data-action="import">Restore backup</button>
      </section>
      <section class="card form"><button class="btn danger" data-action="reset">Reset ${esc(state.name)}'s progress</button></section>
      <p class="muted small center colophon">${CROSS}<br>Po slovensky · made with love by ${esc(partnerName())}</p>
    </main>${tabbar()}`;
}

// --- session ------------------------------------------------------------------------

function startSession(opts) {
  const queue = buildSession(opts);
  if (!queue.length) { toast('Nothing to practice here right now.'); return; }
  sess = { queue, idx: 0, graded: new Set(), stats: { reviewed: 0, learned: 0, right: 0, total: 0 }, ex: null, phase: 'question', fb: null,
    lastAt: Date.now(), storyBefore: nextChapter()?.status.unlocked };
  nextExercise();
}

/** Logs active time since the last tap (idle gaps capped at a minute) plus any answer. */
function tick(answered = 0, correct = 0) {
  const now = Date.now();
  logActivity({ answered, correct, secs: Math.min((now - sess.lastAt) / 1000, 60) });
  sess.lastAt = now;
}

function nextExercise() {
  recordedUrl = null;
  if (sess.idx >= sess.queue.length) { view = { name: 'summary' }; render(); return; }
  const q = sess.queue[sess.idx];
  if (q.kind === 'pair') {
    sess.ex = { type: 'pair', pair: q.pair, target: Math.random() < 0.5 ? 'a' : 'b' };
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

const AUDIO_FIRST = { pair: 1, sound_pick: 1, listen_choose: 1, dictation: 1 };

function autoplayQuestion() {
  const ex = sess.ex;
  if (AUDIO_FIRST[ex.type]) return playTarget();
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
  tick(1, correct ? 1 : 0);

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
  if (!AUDIO_FIRST[ex.type] || !correct) audio.play(targetText(ex));
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
      <button class="btn ghost small ${recording ? 'rec' : ''}" data-action="${recording ? 'rec-stop' : 'rec-start'}">${recording ? ICON.stop + ' Stop' : ICON.mic + ' Say it yourself'}</button>
      ${recordedUrl ? `<button class="btn ghost small" data-action="rec-play">▶ You</button><button class="btn ghost small" data-action="play" data-text="${attr(text)}">▶ Native</button>` : ''}
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
    if (fb) cls = key === fb.correctKey ? 'right' : key === fb.chosen ? 'wrong' : 'dim';
    return `<button class="option ${cls}" data-action="choose" data-key="${attr(key)}" ${fb ? 'disabled' : ''} ${lang ? `lang="${lang}"` : ''}>${esc(getLabel(o))}</button>`;
  }).join('')}</div>`;
}

// The sentence with its grammar slot replaced by `html` (already escaped).
function withBlank(item, html) {
  const i = item.sk.indexOf(item.blank);
  return esc(item.sk.slice(0, i)) + html + esc(item.sk.slice(i + item.blank.length));
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
        <div class="listen small-listen"><button class="icon-btn round" data-action="play" data-text="${attr(it.sk)}" aria-label="Play">${ICON.speaker}</button><button class="icon-btn slow" data-action="play-slow" data-text="${attr(it.sk)}" aria-label="Play slowly">${ICON.slow}</button></div>
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
  else if (fb.result === 'typo') title = 'Close, just a small typo';
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
      <button class="btn primary big" data-action="continue">Continue ${ICON.arrow}</button>
    </footer>`;
}

function sessionScreen() {
  const ex = sess.ex;
  const pct = Math.round(100 * sess.idx / sess.queue.length);
  let footer = '';
  if (sess.phase === 'feedback') footer = feedbackBar();
  else if (ex.type === 'intro' || ex.type === 'lesson') footer = `<footer class="actions"><button class="btn primary big" data-action="continue">Got it ${ICON.arrow}</button></footer>`;
  else if (ex.type === 'type' || ex.type === 'dictation') footer = '<footer class="actions"><button class="btn primary big" data-action="check-typed">Check</button></footer>';
  else if (ex.type === 'build') footer = `<footer class="actions"><button class="btn primary big" data-action="check-build" ${ex.chosen.length ? '' : 'disabled'}>Check</button></footer>`;
  return `<div class="session">
      <header class="session-top"><button class="icon-btn" data-action="quit" aria-label="Close">${ICON.close}</button><div class="bar thick"><i style="width:${pct}%"></i></div></header>
      <main class="exercise ex-${ex.type}">${exerciseBody()}</main>
      ${footer}
    </div>`;
}

function summary() {
  const s = sess.stats;
  const acc = s.total ? Math.round(100 * s.right / s.total) : 100;
  const next = nextChapter();
  const newlyUnlocked = next && next.status.unlocked && !sess.storyBefore;
  return `<main class="screen summary">
      <div class="summary-mark">${CROSS}</div>
      <h1 class="display" lang="sk">Výborne!</h1>
      <p class="muted">Session complete.</p>
      <section class="stats">
        ${s.learned ? `<div class="card stat"><b>${s.learned}</b><span>new</span></div>` : ''}
        <div class="card stat"><b>${s.reviewed}</b><span>reviewed</span></div>
        <div class="card stat"><b>${acc}%</b><span>first try</span></div>
      </section>
      ${newlyUnlocked ? `<button class="card teaser ready c-${next.ch.color}" data-action="play-chapter" data-index="${next.index}">
          <div class="teaser-body"><div class="teaser-kicker">New chapter unlocked</div>
          <div class="teaser-title">${esc(next.ch.title)}</div><div class="teaser-line"><span class="go">Play now ${ICON.arrow}</span></div></div>
          ${hoop(1, { size: 52, cls: 'on-color' })}</button>` : ''}
      <button class="btn primary big" data-action="nav" data-to="home">Done</button>
    </main>`;
}

// --- events -----------------------------------------------------------------------------

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function afterRender() {
  const input = app.querySelector('[data-input="answer"]');
  if (input) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions['check-typed'](); } });
    // Focusing right after a tap keeps the iOS keyboard up between questions.
    setTimeout(() => input.focus(), 50);
  }
  const nameInput = app.querySelector('[data-input="name"]');
  nameInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') actions['set-name'](); });
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
  if (view.name === 'scene') {
    const tr = app.querySelector('.transcript');
    tr.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

async function shareOrCopy(text, url) {
  try {
    if (navigator.share) { await navigator.share(url ? { text, url } : { text }); return; }
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    toast('Copied!');
  } catch { /* cancelled */ }
}

const actions = {
  nav: (el) => { view = { name: el.dataset.to }; if (el.dataset.to === 'home') sess = null; render(); window.scrollTo(0, 0); },
  unit: (el) => { view = { name: 'unit', id: el.dataset.id }; render(); window.scrollTo(0, 0); },
  start: (el) => startSession({ unitId: el.dataset.unit || null, extra: !!el.dataset.extra }),
  play: (el) => audio.play(el.dataset.text),
  'play-as': (el) => audio.play(el.dataset.text, { voice: el.dataset.voice || null }),
  'play-slow': (el) => audio.play(el.dataset.text, { slow: true }),
  replay: () => playTarget(false),
  'replay-slow': () => playTarget(true),
  quit: () => { audio.stop(); sess = null; view = { name: 'home' }; render(); },
  continue: () => { if (sess.phase !== 'feedback') tick(); sess.idx++; nextExercise(); },
  choose: (el) => {
    if (sess.phase !== 'question') return;
    const ex = sess.ex;
    const key = el.dataset.key;
    let correctKey;
    if (ex.type === 'pair' || ex.type === 'sound_pick') correctKey = ex.target;
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
    sess.ex.chosen = sess.ex.chosen.filter((c) => c.i !== Number(el.dataset.i));
    render();
  },
  'check-build': () => {
    const ex = sess.ex;
    const ok = normalize(ex.chosen.map((c) => c.t).join(' ')) === normalize(tokens(ex.item.sk).join(' '));
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
    try { await audio.startRecording(); recording = true; render(); }
    catch { toast('Microphone not available. Check Settings → Safari → Microphone.'); }
  },
  'rec-stop': async () => {
    recordedUrl = await audio.stopRecording();
    recording = false;
    render();
    if (recordedUrl) audio.playUrl(recordedUrl);
  },
  'rec-play': () => recordedUrl && audio.playUrl(recordedUrl),

  // story
  'play-chapter': (el) => openChapter(Number(el.dataset.index)),
  'scene-next': () => {
    sceneTick();
    const a = advance(scene);
    render();
    if (a) audio.play(a.sk, { voice: a.voice });
  },
  'scene-choose': (el) => {
    sceneTick();
    const a = choose(scene, Number(el.dataset.n));
    if (!scene.hint) {
      // Right answer: keep the story moving if the next beat is narration or dialogue.
      render();
      if (a) audio.play(a.sk, { voice: a.voice });
    } else render();
  },
  'scene-postcard': () => {
    const fresh = !state.story.done[scene.ch.id];
    completeChapter(scene.ch.id);
    view = { name: 'postcard', index: scene.index, fresh };
    scene = null;
    render();
    window.scrollTo(0, 0);
  },
  'scene-quit': () => { audio.stop(); scene = null; view = { name: 'story' }; render(); },
  'view-postcard': (el) => { view = { name: 'postcard', index: Number(el.dataset.index) }; render(); window.scrollTo(0, 0); },
  'toggle-tr': () => { state.settings.showTranslations = !state.settings.showTranslations; save(); render(); },

  // settings & learners
  'set-name': () => {
    const v = app.querySelector('[data-input="name"]')?.value.trim();
    if (!v) return app.querySelector('[data-input="name"]')?.focus();
    state.name = v;
    save();
    view = { name: 'home' };
    render();
  },
  rename: () => {
    const v = app.querySelector('[data-input="rename"]')?.value.trim();
    if (v) { state.name = v; save(); toast('Saved.'); render(); }
  },
  'add-profile': () => {
    const v = app.querySelector('[data-input="new-learner"]')?.value.trim();
    if (!v) return;
    addProfile(v);
    toast(`Switched to ${v}.`);
    view = { name: 'home' };
    render();
  },
  'switch-profile': (el) => { switchProfile(el.dataset.id); view = { name: 'home' }; render(); toast(`Ahoj, ${state.name}!`); },
  'delete-profile': (el) => {
    if (confirm('Remove this learner and all their progress from this phone?')) { deleteProfile(el.dataset.id); render(); }
  },
  set: (el) => {
    const v = el.dataset.value;
    state.settings[el.dataset.key] = /^\d+$/.test(v) ? Number(v) : v;
    save();
    render();
  },
  toggle: (el) => { state.settings[el.dataset.key] = el.checked; save(); },
  'hide-install': () => { try { sessionStorage.setItem('hideInstall', '1'); } catch { /* ignore */ } render(); },
  share: () => shareOrCopy('Slovak I learned this week:\n' + recentPhrases().map((it) => `• ${it.sk} — ${it.en}`).join('\n')),
  'send-report': () => shareOrCopy(`${state.name}'s Slovak progress 🇸🇰`, reportUrl()),
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
    if (confirm(`Erase all of ${state.name}'s progress on this phone? This cannot be undone.`)) { resetState(); toast('Progress reset.'); render(); }
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
  await Promise.all([loadCourse(), loadStory(), audio.loadAudioManifest()]);
  render();
  const dev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && !dev) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
