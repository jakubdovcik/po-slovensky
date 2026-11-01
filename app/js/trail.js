// Cesta hrdinov SNP: the 765 km trail from Dukliansky priesmyk (east) to Devín (west).
// Learning progress is walked along it. Kilometres follow cestahrdinov.sk's stage table;
// coordinates are approximate (it's a stylised map).

export const TOTAL_KM = 764.5;

// The trail is the road to B1. Common estimates of active vocabulary per CEFR level
// (approximate: CEFR describes skills, not word counts).
export const LEVELS = [
  { level: 'A1', items: 600, name: 'Breakthrough' },
  { level: 'A2', items: 1200, name: 'Waystage' },
  { level: 'B1', items: 2000, name: 'Independent' },
];
export const B1_ITEMS = 2000;

export const STOPS = [
  { sk: 'Dukliansky priesmyk', km: 0, lat: 49.40, lon: 21.69, label: 'Dukla', fact: 'The start. In autumn 1944 one of the bloodiest battles of the war in the Carpathians was fought for this pass; a memorial stands here today.' },
  { sk: 'Svidník', km: 30, lat: 49.31, lon: 21.57, fact: 'A small town in the Rusyn heartland of north-eastern Slovakia.' },
  { sk: 'Bardejov', km: 73.6, lat: 49.29, lon: 21.28, label: 'Bardejov', fact: 'Its Gothic town square is a UNESCO World Heritage Site.' },
  { sk: 'Čergov', km: 96.9, lat: 49.21, lon: 21.06, fact: 'The trail crosses the forested Čergov range in the Šariš region.' },
  { sk: 'Veľký Šariš', km: 119, lat: 49.04, lon: 21.19, fact: 'Home of Šariš beer, under the ruins of Šariš Castle.' },
  { sk: 'Kysak', km: 150.3, lat: 48.85, lon: 21.22, fact: 'A railway junction in the Hornád valley.' },
  { sk: 'Košice', km: 170.5, lat: 48.73, lon: 21.21, label: 'Košice', fact: 'Slovakia\'s second city. Its St. Elisabeth Cathedral is the largest church in the country.' },
  { sk: 'Kloptaň', km: 205.6, lat: 48.80, lon: 20.92, fact: 'A summit in the Volovské vrchy, deep in old mining country.' },
  { sk: 'Úhornianske sedlo', km: 238.5, lat: 48.80, lon: 20.66, fact: 'A quiet pass in the Volovské vrchy. Sedlo means saddle, a mountain pass.' },
  { sk: 'Dobšinský kopec', km: 277.1, lat: 48.85, lon: 20.40, fact: 'The edge of Slovenský raj, not far from Spišská Nová Ves.' },
  { sk: 'Telgárt', km: 297, lat: 48.85, lon: 20.19, fact: 'Famous for its railway loop: the line spirals through a tunnel and over a tall viaduct to climb the valley.' },
  { sk: 'Kráľova hoľa', km: 304.1, lat: 48.88, lon: 20.14, label: 'Kráľova hoľa', fact: '"The King\'s Mountain." Four rivers rise on its slopes, and it\'s sung about in folk songs.' },
  { sk: 'Čertovica', km: 341.9, lat: 48.90, lon: 19.72, fact: 'Čert means devil, so this is "the Devil\'s Pass".' },
  { sk: 'Chopok', km: 356, lat: 48.94, lon: 19.59, label: 'Chopok', fact: 'Over 2,000 m: one of the highest points of the whole trail, above the Jasná ski resort.' },
  { sk: 'Donovaly', km: 395, lat: 48.88, lon: 19.22, label: 'Donovaly', fact: 'A mountain village between the Low Tatras and the Veľká Fatra.' },
  { sk: 'Kráľova studňa', km: 414.1, lat: 48.89, lon: 19.10, fact: '"The King\'s Well", high on the Veľká Fatra ridge.' },
  { sk: 'Kremnické Bane', km: 448, lat: 48.74, lon: 18.91, fact: 'Claims to be the geographical centre of Europe. Nearby Kremnica minted gold coins for centuries.' },
  { sk: 'Čičmany', km: 511, lat: 48.96, lon: 18.52, fact: 'The village of white-patterned painted houses you met in the culture lessons.' },
  { sk: 'Strážov', km: 519.3, lat: 49.00, lon: 18.46, fact: 'The meadow below Strážov, the highest peak of the Strážovské vrchy.' },
  { sk: 'Trenčín', km: 569, lat: 48.89, lon: 18.04, label: 'Trenčín', fact: 'Its castle rock carries a Roman inscription from the year 179, the northernmost trace of the Roman army in Central Europe.' },
  { sk: 'Veľká Javorina', km: 615.4, lat: 48.86, lon: 17.67, fact: 'The highest peak of the White Carpathians, right on the Czech border. Czechs and Slovaks meet here every summer.' },
  { sk: 'Myjava', km: 633.3, lat: 48.75, lon: 17.57, fact: 'In 1848 the first Slovak National Council met here.' },
  { sk: 'Bradlo', km: 645, lat: 48.66, lon: 17.59, label: 'Bradlo', fact: 'Milan Rastislav Štefánik\'s tomb, the Mohyla, stands on this hilltop.' },
  { sk: 'Dobrá Voda', km: 659.8, lat: 48.60, lon: 17.53, fact: '"Good Water", a village at the foot of the Little Carpathians.' },
  { sk: 'Pezinská Baba', km: 717.2, lat: 48.40, lon: 17.25, fact: 'A pass in the Little Carpathians, above the Pezinok wine region.' },
  { sk: 'Biely Kríž', km: 732.7, lat: 48.28, lon: 17.18, fact: '"White Cross", a favourite meeting point for Bratislava hikers.' },
  { sk: 'Kamzík', km: 740, lat: 48.18, lon: 17.10, fact: 'Bratislava\'s TV tower, with a café at the top.' },
  { sk: 'Slavín', km: 748.4, lat: 48.155, lon: 17.10, fact: 'A memorial to the soldiers who fell freeing Bratislava in 1945.' },
  { sk: 'Devín', km: TOTAL_KM, lat: 48.17, lon: 16.98, label: 'Devín', fact: 'The finish: the castle ruin above the meeting of the Danube and the Morava.' },
];

// Personal landmarks near the route.
const HOMES = [
  { sk: 'Revúca', lat: 48.68, lon: 20.12 },
  { sk: 'Spišská Nová Ves', lat: 48.94, lon: 20.56, labelAbove: true },
];

// A simplified outline of Slovakia (lat, lon), clockwise from Bratislava.
const OUTLINE = [
  [48.14, 17.0], [48.42, 16.95], [48.62, 16.96], [48.78, 17.05], [48.85, 17.2], [48.87, 17.45], [48.95, 17.75],
  [49.1, 18.1], [49.3, 18.3], [49.45, 18.6], [49.52, 18.85], [49.48, 19.1], [49.4, 19.3], [49.6, 19.47],
  [49.42, 19.78], [49.25, 19.98], [49.4, 20.25], [49.35, 20.6], [49.42, 20.9], [49.42, 21.3], [49.43, 21.6],
  [49.37, 21.95], [49.2, 22.3], [49.08, 22.56], [48.9, 22.4], [48.7, 22.3], [48.55, 22.15], [48.4, 22.1],
  [48.38, 21.7], [48.52, 21.45], [48.55, 21.05], [48.5, 20.75], [48.35, 20.45], [48.27, 20.15], [48.2, 19.85],
  [48.1, 19.6], [48.07, 19.25], [48.0, 18.95], [47.82, 18.75], [47.76, 18.4], [47.75, 18.0], [47.8, 17.6],
  [47.9, 17.35], [48.02, 17.2],
];

const LON0 = 16.8, LAT0 = 49.7, KY = 100, KX = KY * Math.cos(48.7 * Math.PI / 180);
const W = (22.65 - LON0) * KX, H = (LAT0 - 47.7) * KY;
const xy = (lat, lon) => [(lon - LON0) * KX, (LAT0 - lat) * KY];
const pt = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Kilometres walked for a number of "known item" points (B1 = 2,000 = Devín). */
export const kmFor = (points) => Math.max(0, Math.min(1, points / B1_ITEMS)) * TOTAL_KM;
export const levelKm = (lv) => kmFor(lv.items);

/** The highest level reached at a given km, and the next one. */
export function levelAt(km) {
  const reached = LEVELS.filter((lv) => km >= levelKm(lv) - 0.01);
  return { current: reached[reached.length - 1] || null, next: LEVELS[reached.length] || null };
}

/** Where on the trail a given km is: the last stop reached, the next one, and the exact point. */
export function position(km) {
  let i = 0;
  while (i < STOPS.length - 1 && STOPS[i + 1].km <= km) i++;
  const here = STOPS[i];
  const next = STOPS[i + 1] || null;
  const t = next ? (km - here.km) / (next.km - here.km) : 0;
  const lat = next ? here.lat + (next.lat - here.lat) * t : here.lat;
  const lon = next ? here.lon + (next.lon - here.lon) * t : here.lon;
  return { index: i, here, next, lat, lon, toNext: next ? next.km - km : 0 };
}

/** The map as an SVG string. `figure` is the walker (an emoji). */
export function mapSvg(km, figure = '🚶‍♀️') {
  const pos = position(km);
  const route = STOPS.map((s) => pt(xy(s.lat, s.lon))).join(' ');
  const walked = [...STOPS.slice(0, pos.index + 1).map((s) => xy(s.lat, s.lon)), xy(pos.lat, pos.lon)].map(pt).join(' ');
  const [fx, fy] = xy(pos.lat, pos.lon);
  const dots = STOPS.map((s, i) => {
    const [x, y] = xy(s.lat, s.lon);
    const reached = i <= pos.index;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s.label ? 3.4 : 2.2}" class="${reached ? 'stop-on' : 'stop-off'}"/>`;
  }).join('');
  const labels = STOPS.filter((s) => s.label).map((s) => {
    const [x, y] = xy(s.lat, s.lon);
    const below = ['Košice', 'Devín', 'Bradlo', 'Donovaly', 'Kráľova hoľa'].includes(s.label);
    return `<text x="${x.toFixed(1)}" y="${(y + (below ? 12 : -7)).toFixed(1)}" class="map-label" text-anchor="middle">${s.label}</text>`;
  }).join('');
  const homes = HOMES.map((h) => {
    const [x, y] = xy(h.lat, h.lon);
    const above = h.labelAbove;
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="map-home" text-anchor="middle">♥</text>
      <text x="${(x + (above ? 6 : 0)).toFixed(1)}" y="${(y + (above ? -6 : 14)).toFixed(1)}" class="map-home-label" text-anchor="middle">${h.sk}</text>`;
  }).join('');
  return `<svg class="snp-map" viewBox="-6 -22 ${(W + 12).toFixed(0)} ${(H + 28).toFixed(0)}" role="img" aria-label="Map of the SNP trail across Slovakia, ${Math.round(km)} of ${Math.round(TOTAL_KM)} km walked towards B1">
    <polygon points="${OUTLINE.map(([a, b]) => pt(xy(a, b))).join(' ')}" class="map-land"/>
    <polyline points="${route}" class="map-route"/>
    <polyline points="${walked}" class="map-walked"/>
    ${homes}${dots}${labels}
    ${LEVELS.map((lv) => {
      const p = position(levelKm(lv));
      const [x, y] = xy(p.lat, p.lon);
      const got = km >= levelKm(lv) - 0.01;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" class="lvl ${got ? 'lvl-on' : ''}">
        <line x1="0" y1="0" x2="0" y2="-17" class="lvl-pole"/><rect x="0" y="-18" width="17" height="10" rx="1.5" class="lvl-flag"/>
        <text x="8.5" y="-10.3" text-anchor="middle" class="lvl-text">${lv.level}</text></g>`;
    }).join('')}
    <g class="map-walker" transform="translate(${fx.toFixed(1)} ${fy.toFixed(1)})">
      <circle r="12" class="walker-halo"/><text y="6.5" text-anchor="middle" class="walker">${figure}</text>
    </g>
  </svg>`;
}
