import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { AgentId, boundaryDecision } from '../plugin/case-workflow/policy.js';

// A subagent's callable tool set is the INTERSECTION of its own allowlist with
// the parent's "inherited tools.allow" - not a union. A child therefore can
// only ever receive a tool its parent already carries.
//
// The cost of getting this wrong is invisible in review and catastrophic at
// run time: the Investigator keeps `read`, so it looks healthy while never
// being able to call `case_claim`; the Curator resolves to an empty set and
// dies before the model speaks. Both were live defects, so the invariant is
// pinned here against the patch that ships it.
const PATCH = join(import.meta.dirname, '..', 'organization', 'openclaw.patch.json5');

function stripComments(source) {
  return source.replace(/^\s*\/\/.*$/gm, '');
}

function toolBlock(source, agentId) {
  const start = source.indexOf(`${agentId}: {`);
  assert.notEqual(start, -1, `patch has no entry for ${agentId}`);
  const tools = source.indexOf('alsoAllow:', start);
  assert.notEqual(tools, -1, `${agentId} declares no alsoAllow`);
  const open = source.indexOf('[', tools);
  const close = source.indexOf(']', open);
  const names = source
    .slice(open + 1, close)
    .split(',')
    .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
  return new Set(names);
}

test('every tool a child agent allows is also named in the parent allowlist', async () => {
  const source = stripComments(await readFile(PATCH, 'utf8'));
  const parent = toolBlock(source, 'main');

  for (const child of ['investigator', 'curator']) {
    const own = toolBlock(source, child);
    for (const tool of own) {
      assert.ok(
        parent.has(tool),
        `${child} allows "${tool}" but main does not, so the subagent can never receive it`,
      );
    }
  }
});

test('the children actually depend on parent-held tools', async () => {
  // Guards the test above from passing vacuously: if the children owned no
  // plugin tools the intersection rule would not bite and the assertion above
  // would be satisfied by an empty set.
  const source = stripComments(await readFile(PATCH, 'utf8'));
  const investigator = toolBlock(source, 'investigator');
  const curator = toolBlock(source, 'curator');

  for (const tool of ['case_claim', 'case_verify', 'case_block']) {
    assert.ok(investigator.has(tool), `investigator lost ${tool}`);
  }
  assert.ok(curator.has('case_prepare_candidate'), 'curator lost case_prepare_candidate');
});

test('naming the child tools in main grants main no authority over them', async () => {
  // The allowlist is the delivery mechanism, not the boundary. The plugin
  // refuses any case tool whose owner is not the calling role, so widening
  // main's alsoAllow to pass tools downstream cannot let Frontline use them.
  const source = stripComments(await readFile(PATCH, 'utf8'));
  const main = toolBlock(source, 'main');

  for (const tool of ['case_claim', 'case_verify', 'case_block', 'case_prepare_candidate']) {
    assert.ok(main.has(tool), `${tool} must be named in main for the child to receive it`);
    const block = boundaryDecision({
      agentId: AgentId.FRONTLINE,
      toolName: tool,
      params: { caseId: 'OP-0001' },
    });
    assert.ok(block, `main can call ${tool}, which would break the role boundary`);
  }
});
