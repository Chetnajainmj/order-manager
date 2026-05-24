#!/usr/bin/env node
// Idempotently seeds the DataDocument required by the customer detail screen.
// Uses dev-login.mjs for credentials and prints only status summaries.
import path from 'node:path';
import url from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  CUSTOMER_CONTACT_DATADOC_ID,
  buildCustomerContactSeedPlan
} from './customer-contact-datadoc-definition.mjs';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const partyId = getArgValue('--party') || 'CUST_1';
const login = spawnSync('node', [path.join(here, 'dev-login.mjs')], { encoding: 'utf8' });

if (login.status !== 0) {
  process.stderr.write(login.stderr);
  process.exit(login.status || 1);
}

const { token, maarg } = JSON.parse(login.stdout);
if (!token || !maarg) fail('No token/maarg from dev-login.mjs');

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

const plan = buildCustomerContactSeedPlan();

await upsertDocument(plan.document);
const savedDocument = await getDocument();
const existingFields = new Set((savedDocument.fields || []).map((field) => field.fieldSeqId));

for (const field of plan.fields) {
  await upsertField(field, existingFields.has(field.fieldSeqId));
}

const verifiedDocument = await getDocument();
const preview = await previewDocument(partyId);

console.log(JSON.stringify({
  dataDocumentId: CUSTOMER_CONTACT_DATADOC_ID,
  document: verifiedDocument.dataDocumentId ? 'available' : 'missing',
  primaryEntityName: verifiedDocument.primaryEntityName,
  fieldCount: (verifiedDocument.fields || []).length,
  previewPartyId: partyId,
  previewStatus: preview.status,
  previewCount: preview.count,
  sampleKeys: preview.sample ? Object.keys(preview.sample).slice(0, 20) : []
}, null, 2));

async function upsertDocument(document) {
  const existing = await rawFetch(`moqui/dataDocuments/${encodeURIComponent(document.dataDocumentId)}?dependentLevels=1`);
  const method = existing.json?.dataDocumentId === document.dataDocumentId ? 'PUT' : 'POST';
  const route = method === 'PUT'
    ? `moqui/dataDocuments/${encodeURIComponent(document.dataDocumentId)}`
    : 'moqui/dataDocuments';
  const response = await rawFetch(route, {
    method,
    body: JSON.stringify(document)
  });
  if (!response.resp.ok) fail(`Failed to ${method} DataDocument: ${response.text}`);
}

async function getDocument() {
  const response = await rawFetch(`moqui/dataDocuments/${encodeURIComponent(CUSTOMER_CONTACT_DATADOC_ID)}?dependentLevels=1`);
  if (!response.resp.ok) fail(`Failed to read DataDocument: ${response.text}`);
  return response.json;
}

async function upsertField(field, exists) {
  const route = exists
    ? `admin/dataDocuments/${encodeURIComponent(CUSTOMER_CONTACT_DATADOC_ID)}/fields/${encodeURIComponent(field.fieldSeqId)}`
    : `admin/dataDocuments/${encodeURIComponent(CUSTOMER_CONTACT_DATADOC_ID)}/fields`;
  const response = await rawFetch(route, {
    method: exists ? 'PUT' : 'POST',
    body: JSON.stringify(field)
  });
  if (!response.resp.ok) fail(`Failed to upsert field ${field.fieldSeqId}: ${response.text}`);
}

async function previewDocument(previewPartyId) {
  const response = await rawFetch('oms/dataDocumentView', {
    method: 'POST',
    body: JSON.stringify({
      dataDocumentId: CUSTOMER_CONTACT_DATADOC_ID,
      format: 'json',
      customParametersMap: {
        partyid: previewPartyId
      },
      pageSize: 5,
      pageIndex: 0
    })
  });
  if (!response.resp.ok) fail(`Preview failed: ${response.text}`);
  const rows = getRows(response.json);
  return {
    status: response.resp.status,
    count: Number(response.json?.count ?? response.json?.total ?? response.json?.response?.numFound ?? rows.length),
    sample: rows[0]
  };
}

async function rawFetch(route, options = {}) {
  const resp = await fetch(maarg + route, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });
  const text = await resp.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  return { resp, text, json };
}

function getRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.documentList)) return data.documentList;
  if (Array.isArray(data?.docs)) return data.docs;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.entityValueList)) return data.entityValueList;
  if (Array.isArray(data?.response?.docs)) return data.response.docs;
  return [];
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  process.stderr.write(`${message.slice(0, 1000)}\n`);
  process.exit(1);
}
