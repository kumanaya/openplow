import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..', 'plugin');

// `docs/plugins/manifest/capabilities.md`: "Runtime api.registerTool(...)
// registrations must match contracts.tools. Tool discovery uses this list to
// load only the plugin runtimes that can own the requested tools."
//
// This is the drift that costs the most and shows up the latest. The unit
// tests exercise policy.js and case-store.js directly and pass whether or not
// the plugin is loadable, and `node --check` only parses syntax, so a tool that
// is registered but undeclared - or declared but unregistered - reaches a
// deploy that boots, reports the plugin ready, and then cannot resolve the
// tool at call time. Three deploys shipped that way.
async function registeredTools(plugin) {
  const source = await readFile(join(ROOT, plugin, 'index.js'), 'utf8');
  const names = new Set();
  for (const match of source.matchAll(/registerTool\(\{\s*name:\s*['"]([^'"]+)['"]/g)) {
    names.add(match[1]);
  }
  return names;
}

async function manifest(plugin) {
  return JSON.parse(await readFile(join(ROOT, plugin, 'openclaw.plugin.json'), 'utf8'));
}

test('case-workflow declares exactly the tools it registers', async () => {
  const declared = new Set((await manifest('case-workflow')).contracts.tools);
  const registered = await registeredTools('case-workflow');

  assert.ok(registered.size > 0, 'no registerTool call found; the regex is stale');

  for (const tool of registered) {
    assert.ok(
      declared.has(tool),
      `${tool} is registered but missing from contracts.tools, so tool discovery will not load its runtime`,
    );
  }
  for (const tool of declared) {
    assert.ok(
      registered.has(tool),
      `${tool} is declared in contracts.tools but never registered, so it can never be called`,
    );
  }
});

test('every case tool is owned by exactly one role in the policy map', async () => {
  // A tool that policy.js does not know about would pass the boundary check
  // for every role, because `CASE_TOOLS.get(name)` returning undefined skips
  // the ownership test entirely.
  const policy = await readFile(join(ROOT, 'case-workflow', 'policy.js'), 'utf8');
  const declared = (await manifest('case-workflow')).contracts.tools;

  for (const tool of declared) {
    assert.ok(
      policy.includes(`'${tool}'`),
      `${tool} is exposed but absent from policy.js, so no role boundary governs it`,
    );
  }
});

test('both plugin manifests are valid JSON with an id and an activation', async () => {
  for (const plugin of ['case-workflow', 'infra-guard']) {
    const m = await manifest(plugin);
    assert.equal(typeof m.id, 'string', `${plugin} has no id`);
    assert.ok(m.activation, `${plugin} has no activation block`);
  }
});

