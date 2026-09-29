#!/usr/bin/env node
// The durable case record, as the case store holds it.
//
//   node openplow-cases.mjs           every case, one line each
//   node openplow-cases.mjs OP-0001   one case in full, with its event log
//
// The store is JSON on the state volume, written by CaseStore, so reading it
// with a JSON parser is not a shortcut here — it is the only correct reader.
// The state machine is enforced by the case tools and not by this file: a case
// here is a fact the store already decided, and this prints it.
//
// The lifecycle this displays is the one in docs/product.md:
//   NEW -> KNOWLEDGE_CHECKED -> ESCALATED -> INVESTIGATING -> VERIFIED
//        -> RESOLVED -> KNOWLEDGE_CANDIDATE
// and INVESTIGATING -> BLOCKED | FAILED | NEEDS_HUMAN, which is where it stops.
// Nothing below this line moves a case.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The same variable the plugin reads, so pointing one at a scratch directory
// points both. Naming a second one here would let the two disagree.
const CASE_ROOT = process.env.OPENPLOW_CASE_ROOT || '/var/lib/plow/cases';
const CASE_FILE = /^OP-\d+\.json$/;
const CASE_ID = /^OP-\d{4,}$/;
const LABEL = 18;

function readAll() {
  let entries;
  try {
    entries = readdirSync(CASE_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  const cases = [];
  for (const entry of entries) {
    if (!entry.isFile() || !CASE_FILE.test(entry.name)) continue;
    try {
      cases.push(JSON.parse(readFileSync(join(CASE_ROOT, entry.name), 'utf8')));
    } catch {
      // A record we cannot read is a record we do not claim to know about.
    }
  }
  return cases.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function readOne(caseId) {
  try {
    return JSON.parse(readFileSync(join(CASE_ROOT, `${caseId}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function readEvents(caseId) {
  try {
    const content = readFileSync(join(CASE_ROOT, `${caseId}.events.ndjson`), 'utf8');
    return content.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * Whether a staged candidate is still waiting for a human.
 *
 * The store cannot know this. It records that a candidate was written to
 * `_raw/`, and promotion happens outside the Gateway: a human validates the
 * page, moves it into canonical knowledge and indexes it. So the file's
 * presence is the honest signal, and its absence says only that the candidate
 * is no longer sitting in the inbox — promoted, or pulled.
 */
function candidateState(record) {
  const path = record?.candidate?.path;
  if (!path) return '—';
  return existsSync(path) ? 'candidate, awaiting review' : 'candidate no longer in _raw/';
}

function field(label, value) {
  // An empty label is a continuation of the line above it, not a bare colon.
  const key = label ? `${label}:` : '';
  return `  ${key.padEnd(LABEL + 1)}${value}`;
}

function list() {
  const cases = readAll();
  if (cases.length === 0) {
    console.log(`no cases in ${CASE_ROOT}`);
    return;
  }
  const rows = cases.map((c) => [c.id ?? '?', c.status ?? '?', candidateState(c)]);
  const idWidth = Math.max(...rows.map((r) => r[0].length));
  const stateWidth = Math.max(...rows.map((r) => r[1].length));
  console.log(`${'CASE'.padEnd(idWidth)}  ${'STATUS'.padEnd(stateWidth)}  KNOWLEDGE`);
  for (const [id, status, knowledge] of rows) {
    console.log(`${id.padEnd(idWidth)}  ${status.padEnd(stateWidth)}  ${knowledge}`);
  }
}

function detail(caseId) {
  const record = readOne(caseId);
  if (!record) {
    console.log(`no case ${caseId} in ${CASE_ROOT}`);
    return;
  }
  console.log(`OpenPlow case ${record.id} — ${record.status}`);
  console.log();

  console.log(field('Origin', `${record.customer} · ${record.conversation}`));
  console.log(field('Opened', record.createdAt));
  console.log(field('Updated', record.updatedAt));

  const problem = record.problem ?? {};
  console.log();
  console.log(field('Problem', problem.summary ?? '—'));
  const context = [problem.version && `version ${problem.version}`, problem.platform].filter(Boolean).join(' · ');
  if (context) console.log(field('', context));
  for (const [label, values] of [['Symptoms', problem.symptoms], ['Tried', problem.attempted]]) {
    if (!Array.isArray(values) || values.length === 0) continue;
    console.log(field(label, values.join(', ')));
  }

  const findings = record.wikiFindings ?? {};
  const pages = Array.isArray(findings.relevantPages) ? findings.relevantPages : [];
  console.log();
  console.log(field('Wiki checked', `${findings.status ?? '—'}${pages.length ? ` · ${pages.join(', ')}` : ''}`));

  const requested = Array.isArray(record.requestedOutcome) ? record.requestedOutcome : [];
  if (requested.length) {
    console.log(field('Wanted', requested.join(', ')));
  }

  const investigation = record.investigation;
  console.log();
  if (!investigation) {
    console.log(field('Investigation', stateNote(record.status)));
  } else {
    console.log(field('Root cause', investigation.rootCause));
    console.log(field('Remediation', investigation.remediation));
    console.log(field('Verified', `${investigation.verification?.method} — ${investigation.verification?.result}`));
    console.log(field('Evidence', (investigation.evidence ?? []).join('; ')));
    console.log(field('Customer-safe', investigation.customerSafeSummary));
  }

  console.log();
  console.log(field('Resolution', record.resolution?.customerSafeSummary ?? '— not resolved —'));
  console.log(field('Knowledge', candidateState(record)));

  const events = readEvents(record.id);
  if (events.length === 0) return;
  console.log();
  console.log('Events');
  for (const event of events) {
    const move = `${event.from ?? '—'} → ${event.to}`;
    console.log(`  ${String(event.at).padEnd(24)}  ${move.padEnd(34)}  ${event.reason ?? ''}`);
  }
}

function stateNote(status) {
  switch (status) {
    case 'ESCALATED': return 'claimed by nobody yet';
    case 'INVESTIGATING': return 'in progress, no result recorded';
    case 'BLOCKED': return 'blocked — no investigation was recorded';
    case 'FAILED': return 'failed — no investigation was recorded';
    case 'NEEDS_HUMAN': return 'waiting on a person, not on a tool';
    default: return 'no investigation recorded';
  }
}

const arg = process.argv[2];
if (arg === undefined) list();
else if (CASE_ID.test(arg)) detail(arg);
else {
  console.error(`usage: openplow-case [OP-0000]   (got "${arg}")`);
  process.exitCode = 1;
}
