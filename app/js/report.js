// Renders a progress report shared from the app. Everything comes from the URL fragment;
// nothing is fetched or stored.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CROSS = '<svg class="cross" viewBox="0 0 20 28" aria-hidden="true"><path d="M8 0h4v28H8zM4 6h12v3.5H4zM1 13h18v3.5H1z" fill="currentColor"/></svg>';

function decode(hash) {
  const m = /d=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

const dateOf = (day) => new Date(day * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function render(r) {
  const days = r.days.map((d) => (d ? { done: d[0], right: d[1], secs: d[2] } : null));
  const week = days.slice(-7).filter(Boolean);
  const wkSecs = week.reduce((n, d) => n + d.secs, 0);
  const wkDone = week.reduce((n, d) => n + d.done, 0);
  const wkRight = week.reduce((n, d) => n + d.right, 0);
  const maxSecs = Math.max(60, ...days.map((d) => d?.secs || 0));
  const active = days.filter(Boolean).length;
  const pct = Math.round(100 * r.tot.learned / r.tot.total);
  const lastActive = (() => { for (let i = days.length - 1; i >= 0; i--) if (days[i]) return days.length - 1 - i; return null; })();
  const lastLine = lastActive == null ? 'No practice in the last 5 weeks' : lastActive === 0 ? 'Practised today' : lastActive === 1 ? 'Last practised yesterday' : `Last practised ${lastActive} days ago`;

  document.getElementById('app').innerHTML = `<main class="screen">
    <header class="page-head"><div class="kicker">${CROSS}<span>Po slovensky · Progress report</span></div>
      <h1 class="display sm"><em>${esc(r.n)}</em>'s Slovak</h1>
      <p class="muted">As of ${dateOf(r.t)} · ${lastLine}</p></header>
    <section class="block progress-hero">
      <div><div class="block-kicker">Course</div><div class="hero-num">${r.tot.learned}<span>/${r.tot.total}</span></div>
      <div>learned (${pct}%) · ${r.tot.solid} in long-term memory</div></div>
    </section>
    <section class="stats">
      <div class="card stat"><b>${Math.round(wkSecs / 60)}</b><span>min this week</span></div>
      <div class="card stat"><b>${wkDone ? Math.round(100 * wkRight / wkDone) + '%' : '–'}</b><span>accuracy, 7 days</span></div>
      <div class="card stat"><b>${r.ch[0]}/${r.ch[1]}</b><span>story chapters</span></div>
    </section>
    <section class="card">
      <div class="section-label">Daily practice · last 5 weeks</div>
      <div class="chart">${days.map((d) => `<span class="${d ? '' : 'zero'}" style="height:${d ? Math.max(6, Math.round(100 * d.secs / maxSecs)) : 2}%" title="${d ? Math.round(d.secs / 60) + ' min' : ''}"></span>`).join('')}</div>
      <div class="chart-axis"><span>${dateOf(r.t - days.length + 1)}</span><span>${active} active days · ${r.tot.minutes} min total</span><span>${dateOf(r.t)}</span></div>
    </section>
    <section class="card">
      <div class="section-label">By stage</div>
      ${r.st.map(([title, learned, total]) => `<div class="stage-bar"><div class="sb-head"><span>${esc(title)}</span><span class="muted">${learned}/${total}</span></div>
        <div class="bar"><i style="width:${Math.round(100 * learned / total)}%"></i></div></div>`).join('')}
    </section>
    ${r.hard.length ? `<section class="card list"><div class="section-label pad">Trickiest words, maybe practise these together</div>${r.hard.map(([sk, en, n]) =>
      `<div class="row"><span class="row-main"><span class="sk" lang="sk">${esc(sk)}</span><span class="en">${esc(en)}</span></span><span class="lapses">${n}×</span></div>`).join('')}</section>` : ''}
    ${r.ch[2] ? `<section class="card"><div class="section-label">Next in the story</div><div class="stop-title" lang="sk">${esc(r.ch[2])}</div></section>` : ''}
    <p class="muted small center">This report lives entirely inside the link. Open a new one from the app any time for fresh numbers.</p>
  </main>`;
}

try {
  const r = decode(location.hash);
  if (!r) throw new Error('no data');
  render(r);
} catch {
  document.getElementById('app').innerHTML = `<main class="screen center"><h1 class="display sm">No report here</h1>
    <p class="muted">Open Po slovensky → Progress → “Send my progress” to create one.</p></main>`;
}
