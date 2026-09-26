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
    // WIKI_PATH is /data/wiki; the others are where the base keeps its home and
    // the prompt. All four are inside the deployment, none in a product doc.
    pattern: /\/(?:var\/lib|opt|data)\/(?:plow|hermes|openclaw|wiki)\b/i,
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
 * Ambiguous on their own — these words belong in a support answer about what
 * Plow supports. They only count when the agent is describing *itself*, which
 * is what a first-person reference in the same sentence means.
 *
 * Known limit, deliberately not papered over: a purely third-person phrasing
 * ("it is on Node v24") slips past these three. The always-rules still catch a
 * host id, an OS, a path or a model id, and the persona says not to volunteer
 * any of it in the first place. The guard is the net, not the plan.
 */
const CONTEXTUAL = [
  {
    id: 'runtime-version',
    pattern: /\b(?:node(?:\.js)?\s*v?\d+\.\d+(?:\.\d+)?|py(?:thon)?\s+3\.\d+(?:\.\d+)?)/i,
    why: 'a runtime version number',
  },
  {
    id: 'arch',
    pattern: /\b(?:x64|x86_64|amd64|aarch64|arm64)\b/i,
    why: 'a description of the machine it runs on, not of the product',
  },
  {
    id: 'container-runtime',
    pattern: /\bdocker\b|\bcontainers?\s+(?:id|image|run)\b/i,
    why: 'a description of how it is deployed rather than what it supports',
  },
];

/** First person, or a name for the thing speaking. Deliberately not "it". */
const SELF = /\b(?:i|i'm|my|mine|me|we|our|this agent|the agent)\b/i;

/** Split on sentence enders. Cheap, and the right granularity: a leak is a sentence. */
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
 * The single piece of knowledge this module has: given text, is any part of it
 * a disclosure of how this agent is deployed?
 *
 * @returns {{id: string, phrase: string, why: string} | null} first hit, or null.
 */
export function infraLeak(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const direct = firstHit(text, ALWAYS);
  if (direct) return direct;
  for (const sentence of sentences(text)) {
    if (!SELF.test(sentence)) continue;
    const hit = firstHit(sentence, CONTEXTUAL);
    if (hit) return hit;
  }
  return null;
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
