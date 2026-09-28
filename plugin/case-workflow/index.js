import { statSync } from 'node:fs';
import { Type } from 'typebox';
import { definePluginEntry } from '../../plugin-sdk/plugin-entry.js';
import { CaseStore, CaseState } from './case-store.js';
import { AgentId, boundaryDecision, provenancePatch, resolveReadPath } from './policy.js';

const CASE_ROOT = process.env.OPENPLOW_CASE_ROOT || '/var/lib/plow/cases';
const WIKI_PATH = process.env.WIKI_PATH || '/data/wiki';
const store = new CaseStore({ root: CASE_ROOT, rawRoot: `${WIKI_PATH}/_raw` });

// Why a read was refused, in terms the model can act on.
//
// The read tool's own errors are accurate and, for these roles, unusable. It
// answers a directory with "List the directory, then read a specific file" —
// and Frontline has no listing tool at all: profile `minimal`, with only
// `read`, `sessions_spawn`, `case_create` and `case_resolve` granted back. The
// instruction cannot be followed, so the model guesses a filename instead, and
// the guesses show up in the log as `latch.md`, `INDEX.md`, `Sandbox.md` when
// the real pages are `concepts/latch.md` and `index.md`.
//
// So the two shapes that have exactly one right answer get that answer, and a
// miss gets the index to read instead of a dead end.
// SYNCHRONOUS on purpose. An `async` handler here looks equivalent and is not:
// the plugin API does not await the hook, so every `{ block: true }` and every
// params patch this file returns is discarded — the boundary stops firing and
// out-of-vault reads reach the tool. Caught in a live run, where
// `/opt/plow/wiki/wiki.toml` and `/wiki/index.md` got as far as the read tool
// instead of being refused here.
//
// One `statSync` on a local volume is microseconds. A security hook that is
// correct is worth far more than the microseconds.
function readRefusal(path) {
  try {
    if (statSync(path).isDirectory()) {
      return `read takes a file, and ${path} is a directory. This role has no listing tool, so read ${WIKI_PATH}/index.md — it lists every canonical page with its title and tags.`;
    }
    return null;
  } catch {
    return `no page at ${path}. Read ${WIKI_PATH}/index.md to find the real path — pages live under concepts/, entities/orgs/, skills/ and references/.`;
  }
}

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
      // A `read` that names a real page goes through, with a relative path
      // rewritten to the absolute one the tool can actually open. A `read` that
      // names a directory, or a page that is not there, is refused with the one
      // path that would have worked — because the tool's own advice asks this
      // role to list a directory it has no tool to list.
      if (toolName === 'read' && (ctx?.agentId === AgentId.FRONTLINE || ctx?.agentId === AgentId.INVESTIGATOR)) {
        const target = resolveReadPath({ path: params.path, wikiPath: WIKI_PATH });
        if (target) {
          const refusal = readRefusal(target);
          if (refusal) return { block: true, blockReason: refusal };
          if (target !== params.path) return { params: { ...params, path: target } };
        }
      }
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
