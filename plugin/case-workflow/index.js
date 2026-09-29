import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Type } from 'typebox';
import { definePluginEntry } from '../../plugin-sdk/plugin-entry.js';
import { CaseStore, CaseState } from './case-store.js';
import { AgentId, agentIdFromSessionKey, boundaryDecision, evictOldest, finalizeRequirement, firstToolIsCaseTool, provenancePatch, requiresResolution, resolveReadPath } from './policy.js';

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


// The audit records `tool_blocked` and stops there: no reason, no shape. So a
// case that never opens and a read that never succeeds look identical from the
// outside, and diagnosing either means shipping a build that guesses. This logs
// the decision and the SHAPE of the context that produced it.
//
// Presence, not values. A customer id and a session key are exactly the things
// that must not end up in a log line, and knowing that `requester` is absent
// is as useful as knowing its contents would be.
function logBlock(toolName, ctx, blockReason) {
  const shape = {
    agentId: ctx?.agentId ?? null,
    sessionKey: typeof ctx?.sessionKey === 'string' && ctx.sessionKey !== '' ? 'present' : 'absent',
    requester: ctx?.requester ? 'present' : 'absent',
    requesterKeys: ctx?.requester && typeof ctx.requester === 'object' ? Object.keys(ctx.requester).sort().join(',') : typeof ctx?.requester,
    requesterSenderId: typeof ctx?.requester?.senderId === 'string' && ctx.requester.senderId !== '' ? 'present' : 'absent',
    ctxKeys: ctx && typeof ctx === 'object' ? Object.keys(ctx).sort().join(',') : typeof ctx,
  };
  console.log(`[case-workflow] blocked tool=${toolName} reason="${blockReason}" ctx=${JSON.stringify(shape)}`);
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
      note(ctx?.sessionKey, ctx, toolName);
      if (!firstToolIsCaseTool(ctx, toolName)) {
        const first = ctx?.agentId === AgentId.CURATOR ? 'case_prepare_candidate(caseId)' : 'case_claim(caseId)';
        const blockReason =
          `call ${first} before anything else. You cannot investigate a case you have not claimed, and you cannot finish a turn that has not recorded a result: read, verify or block, and say it with the tool. If you cannot proceed, ${ctx?.agentId === AgentId.CURATOR ? 'say so and stop' : 'case_block with the precise reason'}.`;
        logBlock(toolName, ctx, blockReason);
        return { block: true, blockReason };
      }
      const blockReason = boundaryDecision({ agentId: ctx?.agentId, toolName, params, wikiPath: WIKI_PATH });
      if (blockReason) {
        logBlock(toolName, ctx, blockReason);
        return { block: true, blockReason };
      }
      const patch = provenancePatch({
        agentId: ctx?.agentId,
        toolName,
        params,
        sessionKey: ctx?.sessionKey,
        requester: ctx?.requester,
      });
      if (patch?.blockReason) {
        logBlock(toolName, ctx, patch.blockReason);
        return { block: true, blockReason: patch.blockReason };
      }
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
          if (refusal) {
            logBlock(toolName, ctx, refusal);
            return { block: true, blockReason: refusal };
          }
          if (target !== params.path) return { params: { ...params, path: target } };
        }
      }
    });

    // A turn of the internal roles that finishes without touching the case store
    // is a turn that did no work, whatever it read. This is the mechanical half
    // of the rule the prompts keep failing to carry.
    api.on('before_agent_finalize', (event, ctx) => enforceCaseWork(ctx));

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

// ── case work is not optional ─────────────────────────────────────────────────
//
// Tracked per conversation, because that is the key the finalize hook carries.
// Cleared when a turn passes, so a turn that did the work does not give the
// next one a free pass; and given up on after a couple of turns that refuse, so
// a model that never complies cannot burn two extra calls on every turn of a
// long conversation.
const turns = new Map();
const MAX_SESSIONS = 256;
const MAX_STRIKES = 2;


function note(sessionKey, ctx, toolName) {
  if (!sessionKey) return;
  // The Frontline is in this list because a real `case_resolve` has to clear its
  // own requirement, or it is revised on every turn of a closed case forever.
  if (![AgentId.FRONTLINE, AgentId.INVESTIGATOR, AgentId.CURATOR].includes(ctx?.agentId)) return;
  if (turns.size >= MAX_SESSIONS) evictOldest(turns, sessionKey);
  const turn = turns.get(sessionKey) ?? { caseCalls: 0, strikes: 0 };
  if (typeof toolName === 'string' && toolName.startsWith('case_')) turn.caseCalls += 1;
  turns.set(sessionKey, turn);
}


function enforceCaseWork(ctx) {
  const sessionKey = ctx?.sessionKey;
  if (!sessionKey) return;
  const agentId = agentIdFromSessionKey(sessionKey);
  if (agentId !== AgentId.FRONTLINE && agentId !== AgentId.INVESTIGATOR && agentId !== AgentId.CURATOR) return;

  // Read the store before anything else, so the check below has the state in
  // scope. It used to be read further down, behind the role guard above, which
  // made the Frontline branch below unreachable and its variable out of scope at
  // the same time — dead code that every unit test passed, because the test
  // called the pure function and not the wiring that never called it.

  // The state travels in the instruction, not just the order. A revise that
  // says only "do the work" gets answered with a story — "the case is
  // VERIFIED, case_claim returned a transition error" — because the model had
  // no way to know the real state, and order plus a gap is an invitation to
  // invent. The store knows, so the instruction carries what it holds.
  const { labels: open, verifiedConversations } = store.openSnapshot();

  // Fail closed. A missing record means no case call was seen, and a security
  // rule that treats "I did not see it" as "it is fine" is the same mistake as
  // the one this hook exists to stop. It also removes the dependency on the two
  // hooks spelling the session the same way: if they disagree, this misses the
  // record, enforces, and the strike cap stops it becoming a loop.
  const turn = turns.get(sessionKey) ?? { caseCalls: 0, strikes: 0 };
  if (turn.strikes >= MAX_STRIKES) {
    console.log(`[case-work] giving up on session=${sessionKey} after ${turn.strikes} ignored turns`);
    return;
  }

  const verified = agentId === AgentId.FRONTLINE
    && requiresResolution({ conversation: sessionKey, verifiedConversations });
  const need = verified && turn.caseCalls === 0
    ? {
      id: 'case-not-resolved',
      phrase: 'case_resolve',
      instruction:
        'A case in this conversation is verified and you have not closed it. Summarising the investigation in prose does not move it: only case_resolve does, and its customerSafeSummary is the only result the customer may be given. Call case_resolve(caseId) before you finish this turn. Do not describe a state the store does not hold — if the case is at VERIFIED, saying NEEDS_HUMAN or BLOCKED is a state you did not read.',
    }
    : finalizeRequirement({ agentId, caseToolCalls: turn.caseCalls });
  if (!need) {
    turn.caseCalls = 0;
    return;
  }

  const truth = open.length
    ? `The open cases are ${open.join(', ')}. None of them has an investigation or a result recorded against it.`
    : 'There are no open cases, so there is nothing here to finish and nothing to have finished.';
  void truth;

  turn.strikes += 1;
  const instruction = `${need.instruction} ${truth} Do not describe a tool result you have not seen — a case moves only when case_claim, case_verify or case_block has actually run, and if you have not run one, it has not moved.`;
  console.log(`[case-workflow] revise session=${sessionKey} rule="${need.id}" phrase="${need.phrase}" (turn ${turn.strikes} of ${MAX_STRIKES})`);
  return {
    action: 'revise',
    reason: instruction,
    retry: { instruction, idempotencyKey: 'openplow-case-work', maxAttempts: 2 },
  };
}
