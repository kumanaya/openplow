import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CaseState, CaseStore } from '../plugin/case-workflow/case-store.js';
import { AgentId, boundaryDecision, provenancePatch, resolveReadPath } from '../plugin/case-workflow/policy.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'openplow-cases-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  let tick = 0;
  return {
    root,
    rawRoot: join(root, 'wiki', '_raw'),
    store: new CaseStore({
      root: join(root, 'cases'),
      rawRoot: join(root, 'wiki', '_raw'),
      clock: () => new Date(`2026-09-26T00:00:0${tick++}.000Z`),
    }),
  };
}

const unknown = {
  customer: 'customer-a',
  conversation: 'agent:main:plow:customer-a',
  problem: {
    summary: 'Authentication fails after upgrade',
    version: '2.8',
    platform: 'macOS',
    symptoms: ['authentication fails'],
    attempted: ['reauthentication'],
  },
  wikiFindings: { status: 'unresolved', relevantPages: [] },
  requestedOutcome: ['determine root cause', 'find a verified workaround'],
};

async function verify(store, caseId, knowledgeCandidate = true) {
  return store.verify(caseId, {
    rootCause: 'Stale OAuth cache after migration',
    remediation: 'Clear the migrated OAuth cache and sign in again.',
    evidence: ['reproduction failed before cache reset', 'authentication passed after reset'],
    verification: { method: 'reproduce on the authorized test environment', result: 'passed' },
    customerSafeSummary: 'We found and verified a stale sign-in cache after the upgrade. Signing in again after the cache reset fixes it.',
    knowledgeCandidate,
  });
}

test('known wiki answers do not create an investigation case', async (t) => {
  const { store } = await fixture(t);
  await assert.rejects(
    () => store.create({ ...unknown, wikiFindings: { status: 'resolved', relevantPages: ['skills/auth-upgrade.md'] } }),
    /canonical answer must not create an investigation case/,
  );
});

test('concurrent Frontline cases receive distinct durable IDs', async (t) => {
  const { store } = await fixture(t);
  const created = await Promise.all(
    Array.from({ length: 8 }, (_, index) => store.create({
      ...unknown,
      customer: `customer-${index}`,
      conversation: `agent:main:plow:customer-${index}`,
    })),
  );
  assert.deepEqual(created.map((record) => record.id), [
    'OP-0001', 'OP-0002', 'OP-0003', 'OP-0004',
    'OP-0005', 'OP-0006', 'OP-0007', 'OP-0008',
  ]);
});

test('unknown case moves through investigation, verified resolution, and staged learning', async (t) => {
  const { store, rawRoot } = await fixture(t);
  const created = await store.create(unknown);
  assert.equal(created.id, 'OP-0001');
  assert.equal(created.status, CaseState.ESCALATED);

  const investigating = await store.claim(created.id);
  assert.equal(investigating.status, CaseState.INVESTIGATING);
  const verified = await verify(store, created.id);
  assert.equal(verified.status, CaseState.VERIFIED);

  const resolved = await store.resolve(created.id, unknown.conversation);
  assert.equal(resolved.status, CaseState.RESOLVED);
  assert.equal(resolved.resolution.customerSafeSummary, verified.investigation.customerSafeSummary);

  const candidate = await store.prepareCandidate(created.id, {
    title: 'Authentication fails after upgrade because of a stale OAuth cache',
    symptom: 'Authentication fails after upgrading to 2.8.',
    affected: ['version 2.8 on macOS'],
    rootCause: verified.investigation.rootCause,
    remediation: verified.investigation.remediation,
    evidence: verified.investigation.evidence,
    sources: ['authorized test reproduction for OP-0001'],
    relevantPages: [],
  });
  assert.equal(candidate.status, CaseState.KNOWLEDGE_CANDIDATE);
  assert.match(candidate.candidate.path, /_raw[\\/]OP-0001\.md$/);
  const markdown = await readFile(join(rawRoot, 'OP-0001.md'), 'utf8');
  assert.match(markdown, /Candidate only; a human must review/);
  assert.doesNotMatch(markdown, /customer-a|agent:main/);

  const events = await store.events(created.id);
  assert.deepEqual(events.map((event) => event.to), [
    CaseState.NEW,
    CaseState.KNOWLEDGE_CHECKED,
    CaseState.ESCALATED,
    CaseState.INVESTIGATING,
    CaseState.VERIFIED,
    CaseState.RESOLVED,
    CaseState.KNOWLEDGE_CANDIDATE,
  ]);
});

test('Curator staging rejects credential-like candidate content', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create(unknown);
  await store.claim(created.id);
  await verify(store, created.id);
  await store.resolve(created.id, unknown.conversation);
  await assert.rejects(() => store.prepareCandidate(created.id, {
    title: 'Authentication cache remediation',
    symptom: 'Sign-in fails after upgrade',
    affected: ['version 2.8'],
    rootCause: 'Stale cache',
    remediation: 'Clear the supported cache',
    evidence: ['api_key=should-not-be-staged'],
    sources: ['authorized test'],
  }), /credential-like content/);
  assert.equal((await store.get(created.id)).status, CaseState.RESOLVED);
});

test('a result cannot resume a different customer conversation', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create(unknown);
  await store.claim(created.id);
  await verify(store, created.id);
  await assert.rejects(() => store.resolve(created.id, 'agent:main:plow:customer-b'), /different customer conversation/);
  assert.equal((await store.get(created.id)).status, CaseState.VERIFIED);
});

test('a Latch denial becomes BLOCKED and does not produce a resolution or candidate', async (t) => {
  const { store } = await fixture(t);
  const created = await store.create(unknown);
  await store.claim(created.id);
  const blocked = await store.block(created.id, CaseState.BLOCKED, 'Latch denied the requested capability.');
  assert.equal(blocked.status, CaseState.BLOCKED);
  await assert.rejects(() => store.resolve(created.id, unknown.conversation), /cannot transition BLOCKED/);
  await assert.rejects(() => store.prepareCandidate(created.id, {
    title: 'never written', symptom: 'never written', affected: ['none'], rootCause: 'none', remediation: 'none', evidence: ['none'], sources: ['none'],
  }), /cannot prepare knowledge candidate from BLOCKED/);
});

test('tool policy makes customer-side Latch and system access unavailable', () => {
  for (const toolName of ['bundle-mcp', 'mcp__plow__plow_run_command', 'plow_read_file', 'exec', 'write', 'conversations_list']) {
    assert.match(boundaryDecision({ agentId: AgentId.FRONTLINE, toolName }), /frontline cannot access operator tools|frontline may read/);
  }
  assert.match(boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path: '/var/lib/plow/cases/OP-0001.json' } }), /canonical knowledge only/);
  assert.equal(boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path: '/data/wiki/concepts/auth.md' } }), null);
  assert.match(boundaryDecision({ agentId: AgentId.CURATOR, toolName: 'bundle-mcp' }), /curator may prepare/);
  assert.match(boundaryDecision({ agentId: AgentId.CURATOR, toolName: 'read', params: { path: '/data/wiki/index.md' } }), /curator may prepare/);
  assert.match(boundaryDecision({ agentId: AgentId.INVESTIGATOR, toolName: 'read', params: { path: '/var/lib/plow/cases/OP-0001.json' } }), /canonical knowledge only/);
  assert.equal(boundaryDecision({ agentId: AgentId.INVESTIGATOR, toolName: 'read', params: { path: '/data/wiki/concepts/auth.md' } }), null);
  assert.equal(boundaryDecision({ agentId: AgentId.INVESTIGATOR, toolName: 'plow_run_command' }), null);
});

test('a relative wiki path is read against the vault, not against the working directory', () => {
  // The shape a model actually produces when it is told "read
  // concepts/agent-index.md". Resolved against the process CWD — the agent's
  // own workspace — this lands outside the vault and gets blocked, and the
  // model then reports the wiki as empty. It is a refusal that teaches the
  // wrong lesson, so the relative form has to mean what the caller meant.
  for (const path of [
    'concepts/agent-index.md',
    './concepts/agent-index.md',
    'index.md',
    'entities/orgs/ai-worth-using.md',
    'skills/how-to-publish-your-agent-on-the-agent-index.md',
  ]) {
    assert.equal(boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path } }), null, path);
    assert.equal(boundaryDecision({ agentId: AgentId.INVESTIGATOR, toolName: 'read', params: { path } }), null, path);
  }

  // The root itself, and a page in the candidate inbox under it, are inside.
  assert.equal(boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path: '.' } }), null);
  assert.equal(boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path: '_raw/OP-0001.md' } }), null);

  // Making a relative path work must not make an escaping one work. These join
  // out of the root and are refused by the same containment test.
  for (const path of [
    '../../etc/passwd',
    'concepts/../../var/lib/plow/cases/OP-0001.json',
    '/var/lib/plow/cases/OP-0001.json',
    '/data/wikievil/index.md',
  ]) {
    assert.match(
      boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path } }),
      /canonical knowledge only, under \/data\/wiki/,
      path,
    );
  }

  // The reason has to be actionable, or the model reports "no knowledge"
  // instead of retrying. This is the string it gets back.
  const reason = boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path: '/etc/passwd' } });
  assert.match(reason, /\/data\/wiki/);
  assert.match(reason, /relative/);
});

test('a relative read is rewritten to the absolute path the tool can open', () => {
  // The read tool resolves a relative path against the agent's WORKSPACE, not
  // the vault, so `concepts/agent-index.md` opens
  // `/var/lib/plow/workspace/concepts/agent-index.md` and fails with ENOENT.
  // Letting that through teaches nothing — the model retries the same shape
  // and then reports the wiki as empty.
  assert.equal(resolveReadPath({ path: 'concepts/agent-index.md' }), '/data/wiki/concepts/agent-index.md');
  assert.equal(resolveReadPath({ path: './index.md' }), '/data/wiki/index.md');
  assert.equal(resolveReadPath({ path: 'index.md' }), '/data/wiki/index.md');
  assert.equal(resolveReadPath({ path: '_raw/OP-0001.md' }), '/data/wiki/_raw/OP-0001.md');

  // Absolute in, absolute out, unchanged.
  assert.equal(resolveReadPath({ path: '/data/wiki/concepts/latch.md' }), '/data/wiki/concepts/latch.md');

  // A relative path that escapes the vault resolves to null, so it never
  // becomes a param patch that would smuggle it past boundaryDecision.
  for (const path of ['../../etc/passwd', 'concepts/../../var/lib/plow/cases/OP-0001.json', '../outside.md']) {
    assert.equal(resolveReadPath({ path }), null, path);
  }

  // Nothing usable in, nothing out — the caller keeps the original params and
  // boundaryDecision decides.
  for (const path of [undefined, null, '', '   ', 42]) {
    assert.equal(resolveReadPath({ path }), null, String(path));
  }
});

test('a refused read says which kind of miss it was', () => {
  // Both are the same block with the same bound, and they need different
  // corrections. Told "pass a path relative to that root" while reaching for
  // its own SKILL.md, the agent retried with the same shape.
  const own = boundaryDecision({
    agentId: AgentId.FRONTLINE,
    toolName: 'read',
    params: { path: '/opt/plow/skills/knowledge-base/SKILL.md' },
  });
  assert.match(own, /deployment's own furniture/);
  assert.match(own, /already in your prompt/);
  assert.doesNotMatch(own, /Pass a path relative/);

  for (const path of ['/var/lib/plow/cases/OP-0001.json', '/var/lib/plow/openclaw.json']) {
    assert.match(
      boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path } }),
      /deployment's own furniture/,
      path,
    );
  }

  // The vault root is a mount point, so it has to count as the deployment.
  assert.match(
    boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'read', params: { path: '/data/other' } }),
    /deployment's own furniture/,
  );

  // Off the machine entirely: the correction is the shape of the path.
  const outside = boundaryDecision({
    agentId: AgentId.FRONTLINE,
    toolName: 'read',
    params: { path: '/etc/passwd' },
  });
  assert.match(outside, /outside this agent/);
  assert.match(outside, /Pass a path relative/);

  // The Investigator gets the same distinction.
  assert.match(
    boundaryDecision({ agentId: AgentId.INVESTIGATOR, toolName: 'read', params: { path: '/opt/plow/skills/x/SKILL.md' } }),
    /deployment's own furniture/,
  );
});

test('no role can reach the session or sub-agent control surface', () => {
  // The Curator is the sharpest case: it may only stage a candidate, yet
  // `subagents` would let it list and cancel the Investigator's live run, and
  // `sessions` would let it reset, delete or hand another role ownership of a
  // visible session. Denying `sessions_spawn` alone does not stop either.
  for (const toolName of ['sessions', 'sessions_yield', 'subagents']) {
    for (const agentId of [AgentId.FRONTLINE, AgentId.INVESTIGATOR, AgentId.CURATOR]) {
      assert.ok(
        boundaryDecision({ agentId, toolName }),
        `${agentId} must not be able to call ${toolName}`,
      );
    }
  }
});

test('only the Frontline can spawn, and only its two internal roles', () => {
  // This is how a case ever reaches the Investigator. `sessions_spawn` was in
  // the Frontline's deny list as part of the spawn-lifecycle group, so a case
  // was created and then sat at ESCALATED: the plugin's list won over the
  // native config, which grants it to `main`.
  for (const agentId of [AgentId.INVESTIGATOR, AgentId.CURATOR]) {
    // The refusal text depends on which check fires first, and both are
    // refusals: what matters is that the internal roles cannot spawn at all.
    assert.match(
      boundaryDecision({ agentId, toolName: 'sessions_spawn', params: { agentId: 'main' } }),
      /does not create agents|Latch capabilities|curator may prepare/,
      agentId,
    );
  }

  // The two it is configured to work, and nothing else.
  for (const target of [AgentId.INVESTIGATOR, AgentId.CURATOR]) {
    assert.equal(
      boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'sessions_spawn', params: { agentId: target } }),
      null,
      target,
    );
  }
  for (const target of ['main', 'ops', 'INVESTIGATOR', '', undefined]) {
    assert.match(
      boundaryDecision({ agentId: AgentId.FRONTLINE, toolName: 'sessions_spawn', params: { agentId: target } }),
      /spawn only the configured investigator or curator/,
      String(target),
    );
  }

  // And spawning it is not a route to the rest of the lifecycle: cancelling,
  // yielding or managing a subagent is still refused.
  for (const toolName of ['sessions', 'sessions_yield', 'subagents']) {
    assert.ok(
      boundaryDecision({ agentId: AgentId.FRONTLINE, toolName, params: { agentId: AgentId.INVESTIGATOR } }),
      `frontline must not reach ${toolName}`,
    );
  }
});

test('case provenance comes from the Gateway session, not model-provided identifiers', () => {
  const patch = provenancePatch({
    agentId: AgentId.FRONTLINE,
    toolName: 'case_create',
    params: { customer: 'forged', conversation: 'forged' },
    sessionKey: 'agent:main:plow:customer-a',
    requester: { senderId: 'customer-a' },
  });
  assert.deepEqual(patch.params.customer, 'customer-a');
  assert.deepEqual(patch.params.conversation, 'agent:main:plow:customer-a');
  assert.match(provenancePatch({ agentId: AgentId.FRONTLINE, toolName: 'case_create', params: {}, sessionKey: undefined, requester: {} }).blockReason, /authenticated sender/);
});
