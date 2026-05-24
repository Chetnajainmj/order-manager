#!/usr/bin/env node
// Fetches the live Swagger specs from dev-maarg and writes them to docs/swagger/.
// Run after `node scripts/dev-login.mjs --token` if the endpoints require auth;
// most swagger endpoints on a Hotwax instance are anonymous.
//
// Usage:
//   node scripts/fetch-swagger.mjs                       # anonymous
//   TOKEN=$(node scripts/dev-login.mjs --token) node scripts/fetch-swagger.mjs   # with bearer

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const base = 'https://dev-maarg.hotwax.io/rest/service.swagger';
// Spec groups exposed by Hotwax Moqui. The user pointed out 5; the others I'm trying
// because parties / contact mechs / admin lookups likely live there.
const specs = [
  'oms/orders', 'oms/returns', 'oms/products', 'moqui', 'poorti',
  'oms/parties', 'oms/facilities', 'oms/productStores', 'oms/communicationEvents',
  'admin', 'api',
];

const headers = { Accept: 'application/json' };
if (process.env.TOKEN) headers.Authorization = `Bearer ${process.env.TOKEN}`;

// fileURLToPath decodes %20 → space; raw .pathname does not.
const here = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../docs/swagger');
await fs.mkdir(outDir, { recursive: true });

const summary = [];
for (const spec of specs) {
  const url = `${base}/${spec}`;
  const file = path.join(outDir, spec.replace('/', '-') + '.json');
  try {
    const resp = await fetch(url, { headers });
    const text = await resp.text();
    if (!resp.ok) {
      summary.push({ spec, status: resp.status, bytes: text.length, note: text.slice(0, 200) });
      continue;
    }
    await fs.writeFile(file, text);
    summary.push({ spec, status: resp.status, bytes: text.length, file: path.relative(process.cwd(), file) });
  } catch (err) {
    summary.push({ spec, error: err.message });
  }
}
console.log(JSON.stringify(summary, null, 2));
