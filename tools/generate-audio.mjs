#!/usr/bin/env node
// Generates MP3s for every Slovak string in the course with Azure neural voices.
//
//   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node tools/generate-audio.mjs
//
// Options: --dry-run (count only), --voices=viktoria,lukas
// Files that already exist are skipped, so re-running after adding content only
// pays for the new strings. Throttled to stay inside the free (F0) tier's rate limit.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const VOICES = { viktoria: 'sk-SK-ViktoriaNeural', lukas: 'sk-SK-LukasNeural' };
const DELAY_MS = 3200; // F0 allows ~20 requests/minute

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const voiceKeys = (args.voices ? String(args.voices).split(',') : Object.keys(VOICES)).filter((v) => VOICES[v]);

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(str, 'utf8')) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const xmlEscape = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const exists = (p) => access(p).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function collectTexts() {
  const course = JSON.parse(await readFile(join(ROOT, 'data', 'course.json'), 'utf8'));
  const texts = new Set();
  for (const unit of course.units) {
    for (const item of unit.items) {
      if (item.kind === 'sound') item.examples.forEach((e) => texts.add(e.sk));
      else {
        texts.add(item.sk);
        (item.alt || []).forEach((a) => texts.add(a));
        // Single words for sentence-building tiles.
        if (/\s/.test(item.sk)) item.sk.replace(/[.,!?…]/g, '').split(/\s+/).filter(Boolean).forEach((w) => texts.add(w));
      }
    }
    (unit.pairs || []).forEach((p) => { texts.add(p.a); texts.add(p.b); });
  }
  // Story dialogue (lines containing {placeholders} are personalised, so they can't be pre-recorded).
  try {
    const story = JSON.parse(await readFile(join(ROOT, 'data', 'story.json'), 'utf8'));
    for (const ch of story.chapters) {
      for (const b of ch.beats) {
        if (b.t === 'say') texts.add(b.sk);
        if (b.audio) texts.add(b.audio);
        for (const o of b.options || []) {
          if (!o.sk.includes('{')) texts.add(o.sk);
          if (o.reply) texts.add(o.reply.sk);
        }
      }
    }
  } catch { /* no story */ }
  return [...texts].filter((t) => !t.includes('{'));
}

async function synth(text, voice, key, region) {
  const ssml = `<speak version="1.0" xml:lang="sk-SK"><voice name="${voice}"><prosody rate="-8%">${xmlEscape(text)}</prosody></voice></speak>`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'po-slovensky',
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 15000 * (attempt + 1);
      console.log(`  ${res.status}, waiting ${Math.round(wait / 1000)}s…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Azure ${res.status}: ${await res.text()}`);
  }
  throw new Error('Too many retries');
}

const texts = await collectTexts();
const manifest = { voices: {}, files: {} };
const todo = [];
for (const v of voiceKeys) {
  manifest.voices[v] = VOICES[v];
  for (const text of texts) {
    const rel = `${v}/${fnv1a(text)}.mp3`;
    (manifest.files[text] ||= {})[v] = rel;
    if (!(await exists(join(ROOT, 'audio', rel)))) todo.push({ text, v, rel });
  }
}
const chars = todo.reduce((n, t) => n + t.text.length, 0);
console.log(`${texts.length} strings × ${voiceKeys.length} voices; ${todo.length} files to generate (~${chars} characters).`);
if (todo.length) console.log(`Estimated time: ~${Math.ceil(todo.length * DELAY_MS / 60000)} min.`);

if (args['dry-run']) process.exit(0);

// Optional .env next to the project root (never committed).
try {
  const env = await readFile(join(ROOT, '..', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch { /* no .env */ }
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION;
if (todo.length && (!key || !region)) {
  console.error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (e.g. westeurope).');
  process.exit(1);
}

let done = 0;
for (const t of todo) {
  const started = Date.now();
  const mp3 = await synth(t.text, VOICES[t.v], key, region);
  const out = join(ROOT, 'audio', t.rel);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, mp3);
  done++;
  if (done % 10 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}  ${t.v}: ${t.text}`);
  // Keep the manifest current so an interrupted run still leaves usable audio.
  if (done % 25 === 0) await writeManifest(true);
  await sleep(Math.max(0, DELAY_MS - (Date.now() - started)));
}
await writeManifest(false);
console.log('Done.');

async function writeManifest(partial) {
  const out = { voices: manifest.voices, files: {} };
  for (const [text, byVoice] of Object.entries(manifest.files)) {
    for (const [v, rel] of Object.entries(byVoice)) {
      if (!partial || await exists(join(ROOT, 'audio', rel))) (out.files[text] ||= {})[v] = rel;
    }
  }
  await writeFile(join(ROOT, 'audio', 'manifest.json'), JSON.stringify(out));
}
