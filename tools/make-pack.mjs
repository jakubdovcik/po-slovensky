#!/usr/bin/env node
// Turns a private lesson pack (e.g. private/about-me.json) into a link. The pack travels in the
// link's #fragment, which browsers never send to a server, so it never touches the public site
// or the repo. Opening the link in the app saves the pack into the learner's own account.
//
//   node tools/make-pack.mjs private/about-me.json
// Writes the link to private/<name>-link.txt (git-ignored).

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('Usage: node tools/make-pack.mjs private/pack.json'); process.exit(1); }
const pack = JSON.parse(readFileSync(file, 'utf8'));
const course = JSON.parse(readFileSync(join(root, 'app', 'data', 'course.json'), 'utf8'));

const publicIds = new Set(course.units.flatMap((u) => u.items.map((i) => i.id)));
const problems = [];
const ids = new Set();
if (!pack.stage?.id || !pack.stage?.title) problems.push('pack.stage needs id and title');
for (const u of pack.units || []) {
  if (!u.id || !Array.isArray(u.items)) problems.push(`unit ${u.id}: needs id and items`);
  for (const i of u.items || []) {
    if (!i.id || !i.sk || !i.en) problems.push(`item ${i.id}: needs id, sk, en`);
    if (ids.has(i.id) || publicIds.has(i.id)) problems.push(`duplicate id ${i.id}`);
    ids.add(i.id);
    if (i.blank && (!i.sk.includes(i.blank) || !i.choices?.includes(i.blank))) problems.push(`${i.id}: bad blank/choices`);
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const b64url = Buffer.from(JSON.stringify(pack), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const link = `https://jakubdovcik.github.io/po-slovensky/#pack=${b64url}`;
const out = join(root, 'private', basename(file).replace(/\.json$/, '') + '-link.txt');
writeFileSync(out, link + '\n');
console.log(`OK: ${ids.size} items in ${pack.units.length} units. Link (${link.length} chars) written to ${out}`);
