// The rulebook, tested against lines that really came out of this agent.
//
// Every "catches" case is a string this deployment has actually produced or
// could plausibly produce; every "passes" case is a support answer that mentions
// the same subject matter and must NOT be rewritten. The second list is the
// point: a guard that fires on ordinary product talk is a guard people turn off.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { infraLeak, judgementCandidates, judgementPrompt, judgementSaysLeak, messageText, revisionInstruction } from '../plugin/infra-guard/rules.js';

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

// The routing and the reading of the verdict. Both are pure on purpose: a
// security rule whose only test is "we tried it once live" is not a test. The
// model is the judge, not the policy.
test('the always-rules are the verdict; narration only raises a question', () => {
  // Deterministic, language-independent, final. A path or an id means the same
  // thing in every language, so these never reach the model.
  assert.equal(infraLeak('Consulte /var/lib/plow/workspace.').id, 'deployment-path');
  assert.equal(infraLeak('Estou em WSL2.').id, 'wsl');
  assert.equal(infraLeak('O modelo é z-ai/glm-5.2.').id, 'model-id');
  assert.equal(infraLeak('O id é 7976e208480b.').id, 'host-id');
  // And they short-circuit the judge: a text with a certain hit is never worth
  // a second opinion.
  assert.deepEqual(judgementCandidates('Estou em Node v24 e o id é 7976e208480b.'), []);

  // Narration vocabulary with no certain hit becomes a question. Third person
  // is included on purpose: the first-person gate is what let this through.
  for (const line of [
    'Eu rodo dentro de um container.',
    'O agente roda como node.',
    'As páginas canônicas são root-owned e o kernel recusou.',
    'Recebi um EACCES no meu filesystem.',
    'I run inside a container.',
    'It is on Node v24.',
  ]) {
    const c = judgementCandidates(line);
    assert.equal(c.length, 1, line);
    assert.ok(c[0].hit.phrase.length > 0, line);
    assert.ok(c[0].hit.why.length > 0, line);
  }

  // Ordinary support traffic raises nothing at all.
  for (const line of [
    'Latch é o app do Mac que dá ao agente acesso aprovado.',
    'A resposta está em /data/wiki/concepts/latch.md.',
    'O preço do Plow não está na wiki.',
    '',
  ]) {
    assert.deepEqual(judgementCandidates(line), [], line);
  }
});

test('the judge is asked one narrow question, and biased toward documentation', () => {
  const [{ text, hit }] = judgementCandidates('O agente roda como node.');
  const prompt = judgementPrompt(text, hit);
  assert.match(prompt, /describing the machine it runs on/);
  assert.match(prompt, /citing\/referencing documentation/);
  assert.match(prompt, /exactly one word/);
  assert.match(prompt, /not certain, answer DOC/);
  // It must not lead: the model is told which answer is the safe one.
  assert.ok(prompt.indexOf('answer DOC') < prompt.indexOf('Reply with exactly'));
});

test('only an explicit LEAK blocks, and a failed judge blocks nothing', () => {
  assert.equal(judgementSaysLeak('LEAK'), true);
  assert.equal(judgementSaysLeak('  leak  '), true);
  assert.equal(judgementSaysLeak('LEAK — the agent describes its own container'), true);

  for (const answer of ['DOC', 'doc', '', null, undefined, 42, {}, 'I am not sure', 'LEAKAGE']) {
    assert.equal(judgementSaysLeak(answer), false, String(answer));
  }
});

test('narration no longer needs a first-person word to be caught', () => {
  // The regression this replaced: SELF was English-only and this deployment is
  // Portuguese, and both of these used to pass silently.
  for (const line of [
    'As páginas canônicas são root-owned e o container roda como node — é o kernel recusando.',
    'O agente roda como node.',
  ]) {
    assert.ok(judgementCandidates(line).length > 0, line);
  }
});

test('a correct citation raises the question and is answered DOC', () => {
  // "container" is in ten pages of this wiki and "root-owned" in four. A
  // citation that names the fact is the product working; rewriting it would be
  // the same mistake as blocking the vault path, already fixed once.
  for (const line of [
    'A página do plow-wiki explica onde o container guarda o volume.',
    'As páginas canônicas são root-owned — está no runbook de permissões.',
  ]) {
    const c = judgementCandidates(line);
    assert.equal(c.length, 1, line);
    assert.equal(judgementSaysLeak('DOC'), false, line);
  }
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
