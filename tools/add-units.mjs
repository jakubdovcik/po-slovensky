#!/usr/bin/env node
// Merges stages/units from a JSON file into app/data/course.json (replacing any with the
// same id), validates the whole course, and rewrites it with one item per line.
//
//   node tools/add-units.mjs new-units.json     # merge + validate + format
//   node tools/add-units.mjs                    # just validate + format

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'data', 'course.json');
const course = JSON.parse(readFileSync(FILE, 'utf8'));

if (process.argv[2]) {
  const add = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  for (const s of add.stages || []) {
    const i = course.stages.findIndex((x) => x.id === s.id);
    if (i >= 0) course.stages[i] = s; else course.stages.push(s);
  }
  for (const u of add.units || []) {
    const i = course.units.findIndex((x) => x.id === u.id);
    if (i >= 0) course.units[i] = u; else course.units.push(u);
  }
}

const problems = [];
const ids = new Set();
const texts = new Map();
const stageIds = new Set(course.stages.map((s) => s.id));
let count = 0;
for (const u of course.units) {
  if (!stageIds.has(u.stage)) problems.push(`unit ${u.id}: unknown stage ${u.stage}`);
  for (const i of u.items) {
    count++;
    if (ids.has(i.id)) problems.push(`duplicate id ${i.id}`);
    ids.add(i.id);
    if (i.kind === 'sound') continue;
    if (texts.has(i.sk)) problems.push(`duplicate Slovak "${i.sk}" (${i.id}, ${texts.get(i.sk)})`);
    texts.set(i.sk, i.id);
    if (i.blank) {
      if (!i.sk.includes(i.blank)) problems.push(`${i.id}: blank "${i.blank}" not in sentence`);
      if (!i.choices?.includes(i.blank)) problems.push(`${i.id}: blank missing from choices`);
      if (new Set(i.choices).size !== i.choices?.length) problems.push(`${i.id}: duplicate choices`);
    }
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const J = JSON.stringify;
const unit = (u) => {
  const { items, pairs, ...head } = u;
  let s = '    {\n' + Object.entries(head).map(([k, v]) => `      ${J(k)}: ${J(v)}`).join(',\n');
  s += ',\n      "items": [\n' + items.map((i) => '        ' + J(i)).join(',\n') + '\n      ]';
  if (pairs) s += ',\n      "pairs": [\n' + pairs.map((p) => '        ' + J(p)).join(',\n') + '\n      ]';
  return s + '\n    }';
};
const out = `{\n  "version": ${course.version},\n  "stages": [\n${course.stages.map((s) => '    ' + J(s)).join(',\n')}\n  ],\n  "units": [\n${course.units.map(unit).join(',\n')}\n  ]\n}\n`;
writeFileSync(FILE, out);
console.log(`OK: ${count} items in ${course.units.length} units, ${course.stages.length} stages.`);
