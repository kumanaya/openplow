import { Type } from 'typebox';
import { definePluginEntry } from '../../plugin-sdk/plugin-entry.js';
import { CaseStore, CaseState } from './case-store.js';
import { boundaryDecision, provenancePatch } from './policy.js';

const CASE_ROOT = process.env.OPENPLOW_CASE_ROOT || '/var/lib/plow/cases';
const WIKI_PATH = process.env.WIKI_PATH || '/data/wiki';
const store = new CaseStore({ root: CASE_ROOT, rawRoot: `${WIKI_PATH}/_raw` });

const stringList = Type.Array(Type.String({ minLength: 1 }), { minItems: 1 });
const caseId = Type.String({ pattern: '^OP-\\d{4,}$' });

function result(details) {
  return {
    content: [{ type: 'text', text: JSON.stringify(details) }],
    details,
  };
}

function caseSummary(record) {
  return {
    caseId: record.id,
    status: record.status,
    problem: record.problem,
    wikiFindings: record.wikiFindings,
    requestedOutcome: record.requestedOutcome,
    investigation: record.investigation,
    resolution: record.resolution,
    candidate: record.candidate,
  };
}

function candidateSummary(record) {
  return {
    caseId: record.id,
    status: record.status,
    candidate: record.candidate,
  };
}


export default definePluginEntry({
  id: 'case-workflow',
  name: 'OpenPlow case workflow',
  description: 'Durable, role-bound support cases connecting Frontline, Investigator and Curator.',
  register(api) {
    api.on('before_tool_call', (event, ctx) => {
      const toolName = event?.toolName;
      if (typeof toolName !== 'string') return;
      const params = event?.params ?? {};
      const blockReason = boundaryDecision({ agentId: ctx?.agentId, toolName, params, wikiPath: WIKI_PATH });
      if (blockReason) return { block: true, blockReason };
      const patch = provenancePatch({
        agentId: ctx?.agentId,
        toolName,
        params,
        sessionKey: ctx?.sessionKey,
        requester: ctx?.requester,
      });
      if (patch?.blockReason) return { block: true, blockReason: patch.blockReason };
      if (patch?.params) return { params: patch.params };
    });

    api.registerTool({
      name: 'case_create',
      description: 'Create an auditable unresolved support case after the canonical wiki did not answer it.',
      parameters: Type.Object({
        customer: Type.Optional(Type.String()),
        conversation: Type.Optional(Type.String()),
        problem: Type.Object({
          summary: Type.String({ minLength: 1 }),
          version: Type.Optional(Type.String()),
          platform: Type.Optional(Type.String()),
          symptoms: Type.Optional(Type.Array(Type.String())),
          attempted: Type.Optional(Type.Array(Type.String())),
        }),
        wikiFindings: Type.Object({
          status: Type.Literal('unresolved'),
          relevantPages: Type.Optional(Type.Array(Type.String())),
        }),
        requestedOutcome: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_toolCallId, params) {
        const record = await store.create(params);
        return result(caseSummary(record));
      },
    });

    api.registerTool({
      name: 'case_claim',
      description: 'Mark an escalated support case as owned and actively investigated.',
      parameters: Type.Object({ caseId }),
      async execute(_toolCallId, params) {
        return result(caseSummary(await store.claim(params.caseId)));
      },
    });

    api.registerTool({
      name: 'case_verify',
      description: 'Persist an evidence-backed investigation result. Use only after tool evidence verifies the remediation.',
      parameters: Type.Object({
        caseId,
        rootCause: Type.String({ minLength: 1 }),
        remediation: Type.String({ minLength: 1 }),
        evidence: stringList,
        verification: Type.Object({ method: Type.String({ minLength: 1 }), result: Type.String({ minLength: 1 }) }),
        customerSafeSummary: Type.String({ minLength: 1 }),
        knowledgeCandidate: Type.Boolean(),
      }),
      async execute(_toolCallId, params) {
        const { caseId: id, ...investigation } = params;
        return result(caseSummary(await store.verify(id, investigation)));
      },
    });

    api.registerTool({
      name: 'case_block',
      description: 'Record an investigation as blocked, failed, or needing a human. A Latch denial is final.',
      parameters: Type.Object({
        caseId,
        status: Type.Union([Type.Literal(CaseState.NEEDS_HUMAN), Type.Literal(CaseState.BLOCKED), Type.Literal(CaseState.FAILED)]),
        reason: Type.String({ minLength: 1 }),
      }),
      async execute(_toolCallId, params) {
        return result(caseSummary(await store.block(params.caseId, params.status, params.reason)));
      },
    });

    api.registerTool({
      name: 'case_resolve',
      description: 'Bind a verified result to its originating customer conversation before Frontline replies.',
      parameters: Type.Object({ caseId, conversation: Type.Optional(Type.String()) }),
      async execute(_toolCallId, params) {
        return result(caseSummary(await store.resolve(params.caseId, params.conversation)));
      },
    });

    api.registerTool({
      name: 'case_prepare_candidate',
      description: 'Create a sanitized, human-review-only Plow Wiki candidate in _raw for a resolved case.',
      parameters: Type.Object({
        caseId,
        title: Type.String({ minLength: 1 }),
        symptom: Type.String({ minLength: 1 }),
        affected: stringList,
        rootCause: Type.String({ minLength: 1 }),
        remediation: Type.String({ minLength: 1 }),
        evidence: stringList,
        sources: stringList,
        relevantPages: Type.Optional(Type.Array(Type.String())),
      }),
      async execute(_toolCallId, params) {
        const { caseId: id, ...candidate } = params;
        return result(candidateSummary(await store.prepareCandidate(id, candidate)));
      },
    });

    console.log('[case-workflow] ready: durable cases and role-bound tools registered');
  },
});
