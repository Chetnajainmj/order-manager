#!/usr/bin/env node
// Read-only smoke probes against the dev-maarg instance. Uses .env.local creds
// via dev-login.mjs to acquire a Bearer token, then runs the queries below and
// writes JSON results into docs/swagger/probe-* for inspection.
//
// Probes are append-only (additive) — pass --probe <name> to run a single one.
//
// Usage:
//   node scripts/api-probe.mjs                # run all
//   node scripts/api-probe.mjs --probe ordersList

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const outDir = path.join(appRoot, 'docs', 'swagger');

// Acquire a token via the existing dev-login script — keeps credential handling
// in one place and never touches the password directly here.
const login = spawnSync('node', [path.join(here, 'dev-login.mjs')], { encoding: 'utf8' });
if (login.status !== 0) {
  console.error(login.stderr); process.exit(1);
}
const { token, maarg } = JSON.parse(login.stdout);
if (!token || !maarg) { console.error('No token/maarg from dev-login.mjs'); process.exit(1); }

const probes = [
  { name: 'ordersList',           url: 'oms/orders?pageSize=2&orderTypeId=SALES_ORDER&orderByField=-orderDate' },
  { name: 'returnsList',          url: 'oms/returns?pageSize=2&orderByField=-entryDate' },
  { name: 'partiesList',          url: 'oms/parties?pageSize=2&partyTypeId=PERSON' },
  { name: 'shipmentsList',        url: 'poorti/shipments?pageSize=2' },
  { name: 'statusesAll',          url: 'admin/status?pageSize=200' },
  { name: 'dataDocumentsList',    url: 'admin/dataDocuments?pageSize=200' },
];

const wantOnly = process.argv.indexOf('--probe');
const filterName = wantOnly >= 0 ? process.argv[wantOnly + 1] : null;

const results = [];
for (const p of probes) {
  if (filterName && p.name !== filterName) continue;
  try {
    const resp = await fetch(maarg + p.url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await resp.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
    const outFile = path.join(outDir, `probe-${p.name}.json`);
    await fs.writeFile(outFile, JSON.stringify(json, null, 2));
    const sample = Array.isArray(json) ? json.slice(0, 1) : json;
    results.push({ probe: p.name, status: resp.status, bytes: text.length, file: path.relative(appRoot, outFile), shape: summarize(sample) });
  } catch (err) {
    results.push({ probe: p.name, error: err.message });
  }
}
console.log(JSON.stringify(results, null, 2));

function summarize(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return depth > 2 ? '[…]' : v.length ? `[${summarize(v[0], depth + 1)}]` : '[]';
  if (typeof v === 'object') {
    if (depth > 2) return '{…}';
    return Object.fromEntries(Object.entries(v).slice(0, 25).map(([k, val]) => [k, summarize(val, depth + 1)]));
  }
  return typeof v;
}
