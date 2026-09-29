// The rulebook, tested against lines that really came out of this agent.
//
// Every "catches" case is a string this deployment has actually produced or
// could plausibly produce; every "passes" case is a support answer that mentions
// the same subject matter and must NOT be rewritten. The second list is the
// point: a guard that fires on ordinary product talk is a guard people turn off.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALWAYS_PROBE,
  buildCanonicalCorpus,
  infraLeak,
  messageText,
  revisionInstruction,
} from '../plugin/infra-guard/rules.js';

const SEED = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed');

const catches = [
  ['the real leak, verbatim',
    "I'm running on a container (host 7976e208480b) under Linux on a WSL2 environment (x64), with Node v24.19.0. The current model is plow/z-ai/glm-5.2."],
  ['container id alone', 'The container is 7976e208480b.'],
  ['host OS', 'This runs on WSL2.'],
  ['deployment path', 'The vault is at /var/lib/plow/workspace.'],
  ['a path under /data that is not the vault', 'Config lives in /data/openclaw/notes.'],
  ['the wiki CLI install, not the vault', 'The tool is at /opt/plow/wiki-tool/bin.'],
  // The vault path in the same sentence does not launder the real one: this
  // line cites a page correctly AND leaks the base's home, so it must be
  // caught, and the phrase reported must be the leak.
  ['a receipt and a leak in one answer',
    'A wiki fica em /data/wiki/index.md — o home da base é /var/lib/plow.'],
  ['operator command handed to the reader', 'Você roda: docker compose run --rm --user root agent'],
  ['root escalation', 'Run it with --user root.'],
  ['model id', 'I am z-ai/glm-5.2.'],
  ['model id, provider path', 'Backed by openai/gpt-5.'],
  ['local port', 'Open http://localhost:3001 to see me.'],
  // 'runtime version', 'architecture' and 'container runtime' used to live here.
  // They are judgement cases now: a version number can be a product
  // requirement and a container can be a fact being cited, so the words alone
  // cannot decide. They are asserted through `judgementCandidates` below.
];

const passes = [
  ['the greeting that actually shipped', 'Olá, Daniel! Tudo certo por aqui. Preciso de alguma coisa?'],
  ['product question', 'Latch is the Mac app that gives an agent approved, sandboxed access.'],
  ['the acceptance-test question', "Why can't you just fix the page yourself?"],
  ['sources are public', 'The answer is in the repo: plow-pbc/latch README.'],
  ['Docker as a topic, not as its own host',
    'The docs describe running it in Docker for local development.'],
  ['architecture compatibility, not its own machine',
    'The installer is published for macOS arm64 and x64.'],
  ['Node as a supported runtime, not as its own',
    'plow-wiki needs Python 3.11 or newer; Node is not involved.'],
  ['Docker as a supported workflow, mentioned not issued',
    'If you want to run it yourself, the README has a docker compose section.'],
  // The receipt. The knowledge-base skill tells the agent to read from
  // `$WIKI_PATH` and the persona tells it to cite the page it read, so a
  // support answer carrying a vault path is the product working, not a leak.
  // This rule used to block exactly this line, and rewrote correct answers.
  ['the receipt: a page under the vault', 'A resposta está em /data/wiki/concepts/latch.md.'],
  ['the vault root itself', 'Consulte /data/wiki/index.md para a lista de páginas.'],
  ['the candidate inbox', 'Deixei o rascunho em /data/wiki/_raw/OP-nnnn.md.'],
  ['an escalation', 'I could not check the machine, so I have handed this to your owner.'],
  ['empty string', ''],
];

// The guard's central problem, measured rather than assumed: a deterministic
// rule is only safe when no canonical page contains what it matches, and the
// vault did — `/var/lib/plow` in where-data-lives.md, `docker compose down`
// and `docker compose down -v` in the same page, `git push` in
// latch-approval-model.md. The guard was rewriting correct answers, and the
// corpus is the answer — for a rule that is asking what is secret.
const corpus = buildCanonicalCorpus(SEED);

test('a phrase this deployment publishes is a citation, not a leak', () => {
  assert.ok(corpus.pages >= 17, `expected the seeded pages, got ${corpus.pages}`);
  assert.ok(corpus.text.length > 500, `expected a real corpus, got ${corpus.text.length}`);

  for (const line of [
    'O estado de sessao fica no container, em /var/lib/plow.',
    'A pagina where-data-lives.md diz que o que sobrevive a um redeploy e o volume.',
  ]) {
    assert.equal(infraLeak(line, corpus), null, line);
  }
});

test('a published command is still a command', () => {
  // The vault carries all three of these. where-data-lives.md documents
  // `docker compose down -v` on the page explaining that it deletes every
  // named volume the deployment declares, and
  // a-maintenance-command-fails-as-the-agent.md carries the root-privileged
  // run. A support line hands the reader none of them, and the first one takes
  // the knowledge base with it.
  for (const line of [
    'Para promover um candidato, use docker compose run --rm --user root agent.',
    'Rode docker compose down -v para liberar espaco.',
    'Depois disso e so um git push.',
  ]) {
    const hit = infraLeak(line, corpus);
    assert.ok(hit, `should have caught: ${line}`);
    assert.equal(hit.id, 'operator-command', line);
  }
});

test('host service diagnostics are operator commands too', () => {
  // A real reply, from a real 502 report, handed the customer this. It names
  // the deployment's init system, its web server and its ports, and it cannot
  // be right: the deployment is a container with no published port and no
  // systemd on the host. Nothing in the vault publishes these, so the
  // corpus exception is not what stops them.
  for (const line of [
    'Rode systemctl status nginx para ver se o nginx esta rodando.',
    'journalctl -u nginx --no-pager -n 50 mostra os ultimos erros.',
    'Depois disso e so um systemctl restart.',
    'Valida com nginx -t antes de tentar de novo.',
  ]) {
    const hit = infraLeak(line, corpus);
    assert.ok(hit, `should have caught: ${line}`);
    assert.equal(hit.id, 'operator-command', line);
  }
});

test('a silenced path does not carry a command out with it', () => {
  // Returning the first matching rule was enough to miss the second. The
  // deployment path is published, so the exception swallowed it — and if the
  // scan stopped there, the command in the same sentence left with it.
  const hit = infraLeak('O estado fica em /var/lib/plow. Rode docker compose down -v.', corpus);
  assert.ok(hit, 'the command must not ride out behind a published path');
  assert.equal(hit.id, 'operator-command');
});

test('a leak that is not in the knowledge base is still caught', () => {
  // Note what is NOT in this list: "git push". It appears verbatim in
  // concepts/latch-approval-model.md, and the rule that fires on it is
  // `operator-command`, which does not yield to a quotation. A published
  // command is still a command.
  for (const [line, id] of [
    ['Estou em WSL2.', 'wsl'],
    ['O id do container e 7976e208480b.', 'host-id'],
    ['Meu estado esta em /opt/hermes/outra-coisa.', 'deployment-path'],
    ['O modelo e openai/gpt-5.', 'model-id'],
    ['Rode sudo systemctl restart para voltar.', 'operator-command'],
  ]) {
    const hit = infraLeak(line, corpus);
    assert.ok(hit, `should have caught: ${line}`);
    assert.equal(hit.id, id, line);
  }
});

/** Every canonical page on disk, so a rule can be checked against the knowledge it must not rewrite. */
function listSeedPages(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(full);
    }
  };
  walk(root);
  return out;
}

test('every rule the vault silences is one the owner signed off on', () => {
  // The corpus decides at boot which rules cannot fire when the agent quotes
  // the knowledge base. That is a policy decision, so it is written down here
  // instead of being a bound nobody checks: add a page holding a container id
  // or a model string, or add a rule the vault matches, and this fails until
  // the owner has looked at what the vault now publishes.
  const PUBLISHABLE_BUT_SILENCED = ['deployment-path'];
  const silenced = new Set();
  for (const probe of ALWAYS_PROBE) {
    if (!probe.publishable) continue;
    for (const file of listSeedPages(SEED)) {
      if (readFileSync(file, 'utf8').split('\n').some((line) => probe.pattern.test(line))) {
        silenced.add(probe.id);
        break;
      }
    }
  }
  assert.deepEqual([...silenced].sort(), PUBLISHABLE_BUT_SILENCED);
});

test('catches deployment identity', () => {
  for (const [label, line] of catches) {
    const hit = infraLeak(line);
    assert.ok(hit, `should have caught: ${label}`);
    assert.ok(hit.phrase.length > 0, `needs the exact phrase: ${label}`);
    assert.ok(hit.why, `needs a reason to give the model: ${label}`);
  }
});

test('passes ordinary support answers', () => {
  for (const [label, line] of passes) {
    const hit = infraLeak(line);
    assert.equal(hit, null, `should NOT have caught (${label}): ${hit?.phrase}`);
  }
});

test('is inert on non-strings', () => {
  for (const v of [null, undefined, 42, {}, [], true]) {
    assert.equal(infraLeak(v), null);
  }
});

test('reads text out of the shapes a message arrives in', () => {
  assert.equal(messageText('plain'), 'plain');
  assert.equal(messageText({ text: 'nested' }), 'nested');
  assert.match(messageText([{ type: 'text', text: 'on WSL2' }]), /WSL2/);
  assert.equal(messageText({ image: 'x' }), '');
  assert.equal(messageText(null), '');
});

test('the instruction names the phrase and how to rewrite it', () => {
  const hit = infraLeak('I am on WSL2.');
  const instruction = revisionInstruction(hit);
  assert.match(instruction, /WSL2/, 'must quote what was wrong');
  assert.match(instruction, /OpenPlow/, 'must say what it is instead');
});
