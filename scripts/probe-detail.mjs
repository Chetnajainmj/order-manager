#!/usr/bin/env node
// One-shot read of GET oms/orders/{orderId} and GET oms/parties (small)
// to inspect what the deep-fetch endpoints actually return.
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const login = spawnSync('node', [path.join(here, 'dev-login.mjs')], { encoding: 'utf8' });
const { token, maarg } = JSON.parse(login.stdout);

const probes = [
  ['orderDetail-service',     'oms/orders/M100051'],                            // service-backed get#SalesOrder
  ['orderDetail-entity',      'oms/orders?orderId=M100051&dependentLevels=2'],  // entity-one with deps
  ['partiesPerson',           'oms/parties?pageSize=3&partyTypeId=PERSON&dependentLevels=2'],
  ['orderStatusHistory',      'oms/orders/M100051/status'],
  ['orderShipGroups',         'oms/orders/M100051/shipGroups'],
  ['orderNote-DD',            null], // POST-style; see below
];

const outDir = path.resolve(here, '..', 'docs', 'swagger');

const results = [];
for (const [name, urlPath] of probes) {
  let resp, text;
  if (urlPath) {
    resp = await fetch(maarg + urlPath, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } else if (name === 'orderNote-DD') {
    resp = await fetch(maarg + 'oms/dataDocumentView', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataDocumentId: 'OrderManagerOrderNoteLookup', format: 'json', pageSize: 5, customParametersMap: { orderId: 'M100051' } }),
    });
  }
  text = await resp.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  await fs.writeFile(path.join(outDir, `probe-${name}.json`), JSON.stringify(json ?? { raw: text.slice(0, 500) }, null, 2));
  results.push({ name, status: resp.status, bytes: text.length, topKeys: json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json).slice(0, 25) : (Array.isArray(json) ? `[${json.length} items, sample keys=${json[0] ? Object.keys(json[0]).slice(0, 15).join(',') : ''}]` : null) });
}
console.log(JSON.stringify(results, null, 2));
