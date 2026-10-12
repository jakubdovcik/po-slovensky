// FSRS-5 spaced-repetition scheduler (default parameters), day granularity.
// Grades: 1 = again, 2 = hard, 3 = good, 4 = easy.

const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const RETENTION = 0.9;
const MAX_INTERVAL = 365;

const clampD = (d) => Math.min(10, Math.max(1, d));
const initDifficulty = (g) => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);

export function retrievability(elapsedDays, stability) {
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

function interval(stability) {
  const days = stability / FACTOR * (Math.pow(RETENTION, 1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)));
}

function nextDifficulty(d, g) {
  const damped = d + (-W[6] * (g - 3)) * (10 - d) / 9;
  return clampD(W[7] * initDifficulty(4) + (1 - W[7]) * damped);
}

/** Returns the updated card state after answering with grade `g` on day `today`. */
export function review(card, g, today) {
  let s, d;
  if (!card) {
    s = W[g - 1];
    d = initDifficulty(g);
  } else {
    const elapsed = Math.max(0, today - card.last);
    d = nextDifficulty(card.d, g);
    if (elapsed === 0) {
      s = card.s * Math.exp(W[17] * (g - 3 + W[18]));
    } else {
      const r = retrievability(elapsed, card.s);
      if (g === 1) {
        s = Math.min(card.s,
          W[11] * Math.pow(card.d, -W[12]) * (Math.pow(card.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
      } else {
        const hard = g === 2 ? W[15] : 1;
        const easy = g === 4 ? W[16] : 1;
        s = card.s * (1 + Math.exp(W[8]) * (11 - card.d) * Math.pow(card.s, -W[9]) *
          (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
      }
    }
  }
  s = Math.max(0.1, s);
  return {
    s, d,
    reps: (card?.reps || 0) + 1,
    lapses: (card?.lapses || 0) + (g === 1 && card ? 1 : 0),
    last: today,
    due: today + (g === 1 ? 1 : interval(s)),
  };
}
