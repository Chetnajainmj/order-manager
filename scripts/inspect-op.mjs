#!/usr/bin/env node
// Print full Swagger detail for one operation (parameters + response schemas).
// Usage:
//   node scripts/inspect-op.mjs <spec> <METHOD> <path-pattern>
// Example:
//   node scripts/inspect-op.mjs oms-orders GET '/{orderId}'
//   node scripts/inspect-op.mjs moqui POST '/dataDocuments/indexes/{indexName}/search'

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';

const [, , spec, method, pathPattern] = process.argv;
if (!spec || !method || !pathPattern) {
  console.error('Usage: node scripts/inspect-op.mjs <spec> <METHOD> <path-pattern>');
  process.exit(1);
}

const here = path.dirname(url.fileURLToPath(import.meta.url));
const file = path.resolve(here, '../docs/swagger', `${spec}.json`);
const json = JSON.parse(await fs.readFile(file, 'utf8'));
const op = json.paths?.[pathPattern]?.[method.toLowerCase()];
if (!op) {
  console.error(`Not found: ${method} ${pathPattern} in ${spec}. Available paths:`);
  console.error(Object.keys(json.paths || {}).filter(p => p.includes(pathPattern.replace(/{[^}]+}/g, ''))).slice(0, 20));
  process.exit(1);
}

// Resolve $ref recursively to a shallow object so JSON.stringify shows the shape.
const seen = new Set();
function resolveRefs(obj, depth = 0) {
  if (depth > 4 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => resolveRefs(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '$ref' && typeof v === 'string') {
      const refPath = v.replace('#/', '').split('/');
      let resolved = json;
      for (const seg of refPath) resolved = resolved?.[seg];
      if (resolved && !seen.has(v)) {
        seen.add(v);
        Object.assign(out, resolveRefs(resolved, depth + 1));
        seen.delete(v);
      } else {
        out._ref = v;
      }
    } else {
      out[k] = resolveRefs(v, depth + 1);
    }
  }
  return out;
}

console.log(`${method.toUpperCase()} ${json.basePath || ''}${pathPattern}`);
if (op.summary) console.log(`Summary: ${op.summary}`);
if (op.description) console.log(`Description: ${op.description}`);
console.log('\nParameters:');
for (const p of op.parameters ?? []) {
  console.log(`  - ${p.in}:${p.name}${p.required ? ' *' : ''}  (${p.type || p.schema?.type || '?'})${p.description ? ' — ' + p.description : ''}`);
  if (p.schema) {
    console.log('    schema:', JSON.stringify(resolveRefs(p.schema), null, 2).split('\n').join('\n    '));
  }
}
console.log('\nResponses:');
for (const [code, r] of Object.entries(op.responses ?? {})) {
  console.log(`  ${code}: ${r.description || ''}`);
  if (r.schema) {
    console.log('    schema:', JSON.stringify(resolveRefs(r.schema), null, 2).split('\n').join('\n    ').slice(0, 4000));
  }
}
