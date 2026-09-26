import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const CaseState = Object.freeze({
  NEW: 'NEW',
  KNOWLEDGE_CHECKED: 'KNOWLEDGE_CHECKED',
  ESCALATED: 'ESCALATED',
  INVESTIGATING: 'INVESTIGATING',
  VERIFIED: 'VERIFIED',
  RESOLVED: 'RESOLVED',
  KNOWLEDGE_CANDIDATE: 'KNOWLEDGE_CANDIDATE',
  NEEDS_HUMAN: 'NEEDS_HUMAN',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
});

const CASE_ID = /^OP-\d{4,}$/;
const SUSPICIOUS_CONTENT = /-----BEGIN|\b(?:password|passphrase|api[_ -]?key|access[_ -]?token|secret)\b|\bbearer\s+[a-z0-9._-]+/i;

function timestamp(clock) {
  return clock().toISOString();
}

function requireText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} must be a non-empty string`);
  return value.trim();
}

function requireList(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${name} must be a non-empty list of strings`);
  }
  return value.map((item) => item.trim());
}

function requireCaseId(caseId) {
  if (!CASE_ID.test(caseId)) throw new Error(`invalid case id: ${caseId}`);
  return caseId;
}

function quote(value) {
  return JSON.stringify(value.replace(/\r?\n/g, ' ').trim());
}

function list(lines) {
  return lines.map((line) => `  - ${quote(line)}`).join('\n');
}

function candidateMarkdown(candidate, createdAt) {
  const title = requireText(candidate.title, 'title');
  const symptom = requireText(candidate.symptom, 'symptom');
  const rootCause = requireText(candidate.rootCause, 'rootCause');
  const remediation = requireText(candidate.remediation, 'remediation');
  const affected = requireList(candidate.affected, 'affected');
  const evidence = requireList(candidate.evidence, 'evidence');
  const sources = requireList(candidate.sources, 'sources');
  const relevantPages = Array.isArray(candidate.relevantPages)
    ? candidate.relevantPages.filter((page) => typeof page === 'string' && page.trim() !== '').map((page) => page.trim())
    : [];
  const allText = [title, symptom, rootCause, remediation, ...affected, ...evidence, ...sources, ...relevantPages].join('\n');
  if (SUSPICIOUS_CONTENT.test(allText)) throw new Error('candidate contains credential-like content');

  return `---
type: Raw
title: ${quote(title)}
description: ${quote(`Verified support outcome: ${symptom}`)}
category: meta
tags: [candidate, support-case]
sources:
${sources.map((source) => `  - resource: ${quote(source)}`).join('\n')}
created: ${quote(createdAt.slice(0, 10))}
updated: ${quote(createdAt.slice(0, 10))}
---
# Verified support outcome

- Case: ${quote(candidate.caseId)}
- Symptom: ${quote(symptom)}
- Affected environments:
${list(affected)}
- Verified root cause: ${quote(rootCause)}
- Verified remediation: ${quote(remediation)}
- Evidence:
${list(evidence)}
${relevantPages.length > 0 ? `- Relevant canonical pages:\n${list(relevantPages)}` : ''}
- Candidate only; a human must review and promote it before canonical use.
`;
}

export class CaseStore {
  #locks = new Map();

  constructor({ root, rawRoot, clock = () => new Date() }) {
    this.root = root;
    this.rawRoot = rawRoot;
    this.clock = clock;
  }

  async create(input) {
    return this.#withLock('sequence', async () => {
      const customer = requireText(input.customer, 'customer');
      const conversation = requireText(input.conversation, 'conversation');
      const summary = requireText(input.problem?.summary, 'problem.summary');
      const wikiStatus = requireText(input.wikiFindings?.status, 'wikiFindings.status');
      if (wikiStatus !== 'unresolved') throw new Error('a canonical answer must not create an investigation case');

      await mkdir(this.root, { recursive: true });
      const sequencePath = join(this.root, 'sequence');
      const current = Number.parseInt(await this.#readOptional(sequencePath, '0'), 10);
      const number = Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1;
      const caseId = `OP-${String(number).padStart(4, '0')}`;
      const createdAt = timestamp(this.clock);
      const record = {
        id: caseId,
        status: CaseState.ESCALATED,
        customer,
        conversation,
        problem: {
          summary,
          version: input.problem?.version ?? null,
          platform: input.problem?.platform ?? null,
          symptoms: Array.isArray(input.problem?.symptoms) ? input.problem.symptoms : [],
          attempted: Array.isArray(input.problem?.attempted) ? input.problem.attempted : [],
        },
        wikiFindings: {
          status: wikiStatus,
          relevantPages: Array.isArray(input.wikiFindings?.relevantPages) ? input.wikiFindings.relevantPages : [],
        },
        requestedOutcome: Array.isArray(input.requestedOutcome) ? input.requestedOutcome : [],
        investigation: null,
        resolution: null,
        candidate: null,
        createdAt,
        updatedAt: createdAt,
      };
      await this.#atomicWrite(sequencePath, `${number}\n`);
      await this.#atomicWrite(this.#casePath(caseId), `${JSON.stringify(record, null, 2)}\n`);
      await this.#appendEvents(caseId, [
        { at: createdAt, actor: 'frontline', from: null, to: CaseState.NEW, reason: 'case created' },
        { at: createdAt, actor: 'frontline', from: CaseState.NEW, to: CaseState.KNOWLEDGE_CHECKED, reason: 'canonical wiki did not resolve the case' },
        { at: createdAt, actor: 'frontline', from: CaseState.KNOWLEDGE_CHECKED, to: CaseState.ESCALATED, reason: 'investigation requested' },
      ]);
      return record;
    });
  }

  async claim(caseId) {
    return this.#transition(caseId, [CaseState.ESCALATED], CaseState.INVESTIGATING, 'investigator', 'investigator accepted ownership');
  }

  async verify(caseId, investigation) {
    const rootCause = requireText(investigation?.rootCause, 'rootCause');
    const remediation = requireText(investigation?.remediation, 'remediation');
    const customerSafeSummary = requireText(investigation?.customerSafeSummary, 'customerSafeSummary');
    const evidence = requireList(investigation?.evidence, 'evidence');
    const method = requireText(investigation?.verification?.method, 'verification.method');
    const result = requireText(investigation?.verification?.result, 'verification.result');
    return this.#transition(caseId, [CaseState.INVESTIGATING], CaseState.VERIFIED, 'investigator', 'evidence-backed remediation verified', (record) => {
      record.investigation = {
        rootCause,
        remediation,
        evidence,
        verification: { method, result },
        customerSafeSummary,
        knowledgeCandidate: investigation.knowledgeCandidate === true,
      };
    });
  }

  async block(caseId, status, reason) {
    if (![CaseState.NEEDS_HUMAN, CaseState.BLOCKED, CaseState.FAILED].includes(status)) {
      throw new Error(`unsupported investigation terminal state: ${status}`);
    }
    return this.#transition(caseId, [CaseState.INVESTIGATING], status, 'investigator', requireText(reason, 'reason'));
  }

  async resolve(caseId, conversation) {
    const expectedConversation = requireText(conversation, 'conversation');
    return this.#transition(caseId, [CaseState.VERIFIED], CaseState.RESOLVED, 'frontline', 'verified result returned to the originating customer conversation', (record) => {
      if (record.conversation !== expectedConversation) throw new Error('case belongs to a different customer conversation');
      record.resolution = { customerSafeSummary: record.investigation.customerSafeSummary };
    });
  }

  async prepareCandidate(caseId, candidate) {
    return this.#withCaseLock(caseId, async () => {
      const record = await this.#readCase(caseId);
      if (record.status !== CaseState.RESOLVED) throw new Error(`cannot prepare knowledge candidate from ${record.status}`);
      if (record.investigation?.knowledgeCandidate !== true) throw new Error('investigation did not mark this outcome as durable knowledge');
      const createdAt = timestamp(this.clock);
      const markdown = candidateMarkdown({ ...candidate, caseId }, createdAt);
      const candidatePath = join(this.rawRoot, `${caseId}.md`);
      await mkdir(dirname(candidatePath), { recursive: true });
      try {
        await writeFile(candidatePath, markdown, { encoding: 'utf8', flag: 'wx' });
      } catch (error) {
        if (error?.code === 'EEXIST') throw new Error(`candidate already exists for ${caseId}`);
        throw error;
      }
      record.status = CaseState.KNOWLEDGE_CANDIDATE;
      record.candidate = { path: candidatePath, createdAt };
      record.updatedAt = createdAt;
      await this.#atomicWrite(this.#casePath(caseId), `${JSON.stringify(record, null, 2)}\n`);
      await this.#appendEvents(caseId, [{
        at: createdAt,
        actor: 'curator',
        from: CaseState.RESOLVED,
        to: CaseState.KNOWLEDGE_CANDIDATE,
        reason: 'candidate staged for human review',
      }]);
      return record;
    });
  }

  async get(caseId) {
    return this.#readCase(caseId);
  }

  async events(caseId) {
    requireCaseId(caseId);
    const content = await this.#readOptional(this.#eventsPath(caseId), '');
    return content.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  }

  async #transition(caseId, allowedStates, nextState, actor, reason, mutate) {
    return this.#withCaseLock(caseId, async () => {
      const record = await this.#readCase(caseId);
      if (!allowedStates.includes(record.status)) throw new Error(`cannot transition ${record.status} to ${nextState}`);
      const from = record.status;
      mutate?.(record);
      const at = timestamp(this.clock);
      record.status = nextState;
      record.updatedAt = at;
      await this.#atomicWrite(this.#casePath(caseId), `${JSON.stringify(record, null, 2)}\n`);
      await this.#appendEvents(caseId, [{ at, actor, from, to: nextState, reason }]);
      return record;
    });
  }

  async #readCase(caseId) {
    requireCaseId(caseId);
    try {
      return JSON.parse(await readFile(this.#casePath(caseId), 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') throw new Error(`unknown case: ${caseId}`);
      throw error;
    }
  }

  async #appendEvents(caseId, events) {
    const content = events.map((event) => JSON.stringify({ id: randomUUID(), ...event })).join('\n');
    await appendFile(this.#eventsPath(caseId), `${content}\n`, 'utf8');
  }

  async #atomicWrite(path, content) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, path);
  }

  async #readOptional(path, fallback) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return fallback;
      throw error;
    }
  }

  #casePath(caseId) {
    return join(this.root, `${requireCaseId(caseId)}.json`);
  }

  #eventsPath(caseId) {
    return join(this.root, `${requireCaseId(caseId)}.events.ndjson`);
  }

  async #withCaseLock(caseId, operation) {
    return this.#withLock(requireCaseId(caseId), operation);
  }

  async #withLock(lockKey, operation) {
    const previous = this.#locks.get(lockKey) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    this.#locks.set(lockKey, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#locks.get(lockKey) === queued) this.#locks.delete(lockKey);
    }
  }
}
