// Audio: pre-generated Azure neural voices when available (audio/manifest.json),
// otherwise the device's built-in Slovak voice via speechSynthesis.

import { state } from './store.js';

const player = new Audio();
player.preload = 'auto';
let manifest = { voices: {}, files: {} };
let lastVoice = null;

export const VOICE_LABELS = { viktoria: 'Viktória', lukas: 'Lukáš' };

export async function loadAudioManifest() {
  try {
    const res = await fetch('audio/manifest.json');
    if (res.ok) manifest = await res.json();
  } catch { /* offline with nothing cached: device voice only */ }
}

export function availableVoices() {
  return Object.keys(manifest.voices || {});
}

// iOS only lets audio start from a tap; play a silent clip on the first one
// so later programmatic plays (auto-play on a new question) are allowed.
const SILENT = (() => {
  const samples = 800; // 0.1 s of 8 kHz 8-bit mono silence
  const buf = new DataView(new ArrayBuffer(44 + samples));
  const str = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); buf.setUint32(4, 36 + samples, true); str(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, 8000, true); buf.setUint32(28, 8000, true);
  buf.setUint16(32, 1, true); buf.setUint16(34, 8, true);
  str(36, 'data'); buf.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
})();
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  player.src = SILENT;
  player.play().catch(() => {});
  try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch { /* ignore */ }
}
document.addEventListener('touchend', unlock, { once: true, capture: true });
document.addEventListener('click', unlock, { once: true, capture: true });

function pickVoice(files, forced) {
  const voices = Object.keys(files);
  if (!voices.length) return null;
  if (forced && files[forced]) return forced;
  const pref = state.settings.voice;
  if (pref !== 'mix' && files[pref]) return pref;
  // "mix": alternate voices; hearing several speakers trains the ear better.
  const others = voices.filter((v) => v !== lastVoice);
  return others.length ? others[Math.floor(Math.random() * others.length)] : voices[0];
}

let deviceVoice;
function slovakDeviceVoice() {
  if (deviceVoice !== undefined) return deviceVoice;
  const voices = speechSynthesis.getVoices();
  deviceVoice = voices.find((v) => v.lang === 'sk-SK') || voices.find((v) => v.lang?.startsWith('sk')) || null;
  return deviceVoice;
}
try { speechSynthesis.onvoiceschanged = () => { deviceVoice = undefined; }; } catch { /* ignore */ }

export function play(text, { slow = false, voice = null } = {}) {
  const files = manifest.files?.[text];
  const chosen = state.settings.voice === 'device' ? null : files && pickVoice(files, voice);
  stop();
  if (chosen) {
    lastVoice = chosen;
    player.src = 'audio/' + files[chosen];
    player.playbackRate = slow ? 0.7 : 1;
    player.play().catch(() => speak(text, slow));
    return;
  }
  speak(text, slow);
}

function speak(text, slow) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'sk-SK';
    const v = slovakDeviceVoice();
    if (v) u.voice = v;
    u.rate = slow ? 0.6 : 0.9;
    speechSynthesis.speak(u);
  } catch { /* no speech available */ }
}

export function stop() {
  try { player.pause(); } catch { /* ignore */ }
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}

export function hasDeviceVoice() {
  try { return !!slovakDeviceVoice(); } catch { return false; }
}

// --- Record yourself and compare --------------------------------------------

let recorder = null;
let chunks = [];

export function canRecord() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start();
}

export function stopRecording() {
  return new Promise((resolve) => {
    if (!recorder) return resolve(null);
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/mp4' });
      recorder = null;
      resolve(URL.createObjectURL(blob));
    };
    recorder.stop();
  });
}

export function playUrl(url) {
  stop();
  player.src = url;
  player.playbackRate = 1;
  player.play().catch(() => {});
}
