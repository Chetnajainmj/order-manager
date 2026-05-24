#!/usr/bin/env node
// Probe both candidate DataDocument query endpoints against a live instance
// to determine which one the app should call.
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const login = spawnSync('node', [path.join(here, 'dev-login.mjs')], { encoding: 'utf8' });
const { token, maarg } = JSON.parse(login.stdout);

async function hit(name, urlPath, body) {
  const resp = await fetch(maarg + urlPath, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  const sample = json && (Array.isArray(json) ? json[0] : (json.documentList?.[0] || json.entityValueList?.[0] || json.rows?.[0] || json.docs?.[0] || json));
  const count = json?.documentListCount ?? json?.count ?? json?.totalCount ?? (Array.isArray(json) ? json.length : undefined);
  return { name, status: resp.status, count, errorSnippet: !resp.ok ? text.slice(0, 240) : undefined, sampleKeys: sample ? Object.keys(sample).slice(0, 20) : undefined };
}

const results = [];

// Candidate 1: oms/dataDocumentView (from oms.rest.xml — not in swagger)
results.push(await hit('oms/dataDocumentView',
  'oms/dataDocumentView',
  { dataDocumentId: 'OrderManagerOrderLookup', format: 'json', pageSize: 2, pageIndex: 0 }
));

// Candidate 2: moqui/dataDocuments/indexes/oms/search (the swagger-documented ES search)
results.push(await hit('moqui ES search',
  'moqui/dataDocuments/indexes/oms/search',
  { indexName: 'oms', documentType: 'OrderManagerOrderLookup', queryString: '*', pageSize: 2, pageIndex: 0 }
));

console.log(JSON.stringify(results, null, 2));
