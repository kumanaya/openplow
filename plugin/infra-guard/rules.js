// What counts as a deployment disclosure, and how to say it without a list.
//
// A prompt rule holds most of the time; a hostname in a support chat is a
// fingerprinting problem forever. So the rule is enforced by the Gateway at
// three doors (index.js), and this file is the whole rulebook: pure, no I/O,
// and directly testable against real lines.
//
// Two classes of rule, because "the docs say it runs in Docker" and "I run in
// Docker" are the same three letters and opposite meanings.

/**
 * Unambiguous: no legitimate product documentation contains these, so they are
 * caught wherever they appear.
 */
const ALWAYS = [
  {
    id: 'host-id',
    // A container id or short host hash. 12 hex chars is the width docker
    // prints, and well past any legitimate product identifier.
    pattern: /\b[0-9a-f]{12}\b/,
    why: 'a machine or container id',
  },
  {
    id: 'wsl',
    pattern: /\bwsl2?\b/i,
    why: 'the host operating system this deployment runs on',
  },
  {
    id: 'deployment-path',
    // `/data/wiki` is the VAULT, and citing a page under it is the receipt:
    // `skills/knowledge-base/SKILL.md` tells the agent to read from
    // `$WIKI_PATH`, and the persona tells it to cite the page it actually read.
    // A guard that blocks the receipt blocks the product — in one session of
    // real use this rule fired three times on `/data/wiki` alone, rewriting
    // answers that were correct, and the deployment's own knowledge base is
    // public by design.
    //
    // Everything else under /data stays blocked, and so does the base's own
    // homes: /var/lib/plow, /opt/plow, /opt/hermes, /var/lib/openclaw.
    pattern: /\/(?:var\/lib|opt)\/(?:plow|hermes|openclaw|wiki)\b|\/data\/(?!wiki\b)[a-z]/i,
    why: 'a path inside the deployment',
  },
  {
    id: 'model-id',
    pattern: /\b(?:plow\/[\w.-]+\/[\w.-]+|(?:z-ai|openai|anthropic|google)\/[\w.-]+|(?:glm|gpt|claude|llama|mistral|qwen|deepseek|o\d)-[\w.]+)/i,
    why: 'the underlying model identifier',
  },
  {
    id: 'local-port',
    pattern: /\blocalhost:\d{2,5}\b|\b127\.0\.0\.1:\d{2,5}\b/i,
    why: 'a port on the host running it',
  },
  {
    // Not deployment identity, but the same failure with the path stripped:
    // the guard caught "/opt/plow" and the reader was still handed
    // "docker compose run --rm --user root agent" to type. Not contextual,
    // because a command is operator-speak whoever says it and a first-person
    // reference would let "you run: docker compose run" through. A customer
    // of a support line cannot run any of it.
    id: 'operator-command',
    pattern: /\bdocker(?:\s+-?compose)?\s+(?:run|exec|build|up|down|logs)\b|--user\s+root\b|\bsudo\s+\w+|\bgit\s+(?:push|commit)\b/,
    why: "a command for the reader to run, which is the owner's job, not a support answer",
  },
];

/**
 * Vocabulary that raises the question. NOT a verdict.
 *
 * These words are in this product's own pages — "container" in ten of them,
 * "root-owned" in four, "EACCES" in two — so a rule that fired on them would
 * rewrite correct citations. That is the same mistake as blocking the vault
 * path, and it was made twice.
 *
 * So this list only decides *whether to ask*. Whether the agent is describing
 * its own machine or quoting a page that says the same thing is a question about
 * meaning, not about grammar, and a model answers it in any language and in the
 * third person. See `judgementPrompt`.
 */
const NARRATION = [
  // A version number looks like an identifier and belongs in the deterministic
  // rules above. It does not: this product's own pages say "plow-wiki needs
  // Python 3.11 or newer", and a rule that flags that rewrites a correct
  // answer. The test suite caught it before a customer did. It asks the judge,
  // which can tell a product requirement from a disclosure.
  { id: 'runtime-version', pattern: /\b(?:node(?:\.js)?|python|py)\b/i, why: 'a runtime, either one this agent executes on or one a product requires' },
  { id: 'arch', pattern: /\b(?:x64|x86_64|amd64|aarch64|arm64)\b/i, why: 'a machine architecture' },
  { id: 'container-runtime', pattern: /\b(?:docker|containers?|kernel|sidecars?)\b/i, why: 'how this agent is deployed' },
  { id: 'runtime-narration', pattern: /\b(?:root-?owned|EACCES|EPERM|filesystem|file system|file-?system|process supervisor|s6)\b/i, why: 'how this agent executes' },
];

/** Split on sentence enders. A leak is a sentence, and so is a citation. */
function sentences(text) {
  return text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
}

function firstHit(text, rules) {
  for (const rule of rules) {
    const m = rule.pattern.exec(text);
    if (m) return { id: rule.id, phrase: m[0].trim(), why: rule.why };
  }
  return null;
}

/**
 * The deterministic half, and the only half that runs on every door.
 *
 * These match identifiers and paths, which mean the same thing in every
 * language: a container id, a host hash, an OS name, a deployment path, a
 * model id, a local port, a command for the reader to run. A hit is final and
 * nothing can overturn it, which is what makes it safe to keep synchronous.
 *
 * @returns {{id: string, phrase: string, why: string} | null}
 */
export function infraLeak(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  return firstHit(text, ALWAYS);
}

/**
 * The sentences worth a second opinion: narration vocabulary present, no
 * deterministic hit in the text.
 *
 * Pure, so the routing is testable without a model — which matters, because a
 * security rule whose only test is "we tried it once live" is not a test.
 *
 * @returns {Array<{text: string, hit: {id: string, phrase: string, why: string}}>}
 */
export function judgementCandidates(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  if (infraLeak(text)) return [];
  return sentences(text)
    .map((sentence) => ({ text: sentence, hit: firstHit(sentence, NARRATION) }))
    .filter((c) => c.hit);
}

/**
 * The one question the model is asked.
 *
 * Deliberately narrow, and deliberately biased: the cost of a false positive is
 * a correct answer rewritten, which is the failure this repo already shipped
 * twice. So the model is told that quoting documentation is not a disclosure,
 * and that anything short of a clear self-description is documentation.
 */
export function judgementPrompt(sentence, hit) {
  return [
    `A support agent is about to send this sentence to a customer:`,
    ``,
    sentence,
    ``,
    `It contains "${hit.phrase}" (${hit.why}).`,
    ``,
    `Answer ONE question: is the agent describing the machine it runs on,`,
    `or is it citing/referencing documentation, a product fact, or the`,
    `customer's own setup?`,
    ``,
    `LEAK — the agent is describing its own host, container, runtime,`,
    `permissions or paths, for example "I run in a container", "the kernel`,
    `refused my write", "my filesystem is read-only here".`,
    `DOC — anything else. Quoting a page, describing the product, or explaining`,
    `a concept that happens to use one of these words is DOC, even in the third`,
    `person and even when the machine being described is the agent's.`,
    ``,
    `When you are not certain, answer DOC.`,
    ``,
    `Reply with exactly one word: LEAK or DOC.`,
  ].join('\n');
}

/**
 * The model's answer, read conservatively: only an explicit LEAK blocks, and a
 * judge that failed, timed out or answered nonsense blocks nothing.
 *
 * @returns {boolean} true when the sentence is a disclosure
 */
export function judgementSaysLeak(answer) {
  if (typeof answer !== 'string') return false;
  return /^\s*LEAK\b/i.test(answer.trim());
}


/** The text an outbound message actually carries, whatever shape it arrived in. */
export function messageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => p && (p.type === 'text' || typeof p.text === 'string'))
      .map((p) => (typeof p === 'string' ? p : p.text))
      .join('\n');
  }
  if (content && typeof content.text === 'string') return content.text;
  return '';
}

/** The instruction sent back to the model when a door opens. */
export function revisionInstruction(hit) {
  return [
    `Do not send that. "${hit.phrase}" is ${hit.why}.`,
    'You are OpenPlow, an independent customer-support agent built with OpenClaw.',
    'Answer customers from the product team’s configured wiki; when it does not',
    'support an answer, prepare an internal handoff for the owner’s team.',
    'Do not inspect customer systems through operator tools, and do not imply',
    'that you represent Plow or another product vendor.',
    'Do not disclose host, container, operating system, architecture, runtime,',
    'filesystem or model details to a customer. Identify yourself as OpenPlow,',
    'then return to the customer’s support request. Send the corrected reply.',
  ].join(' ');
}
