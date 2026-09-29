import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    // The lookbehind is not decoration. `plow/vendor/model` is a bare token in
    // prose, and it is a PATH SEGMENT in `/opt/plow/bin/wiki-bootstrap`, which
    // is how a maintenance command names the tool it runs. Measured: the rule
    // fired on the seeded line `docker compose run … /opt/plow/bin/…` and
    // reported a file path as a model identifier. That is the same class of
    // mistake the corpus exception exists to absorb, and absorbing it here
    // meant a published path silently disarming a rule about the model.
    pattern: /(?<!\/)\b(?:plow\/[\w.-]+\/[\w.-]+|(?:z-ai|openai|anthropic|google)\/[\w.-]+|(?:glm|gpt|claude|llama|mistral|qwen|deepseek|o\d)-[\w.]+)/i,
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
    //
    // `publishable: false`, because the corpus exception is the wrong tool for
    // this one rule. That exception answers "is this a secret?", and for a
    // path or a model id the answer is a legitimate yes: the owner published
    // it, so it is not one. This rule never asks that question. It asks
    // whether a command belongs in a support reply, and a command the owner
    // runs on their own machine does not, however many pages have it written
    // down. prompt/AGENTS.md already says so: handing the reader a command is
    // "an operator talking, and a customer cannot run it".
    //
    // The vault made it concrete. `concepts/where-data-lives.md` documents
    // `docker compose down -v` on the page explaining that it deletes every
    // named volume this deployment declares, and
    // `skills/a-maintenance-command-fails-as-the-agent.md` carries
    // `docker compose run --rm --user root agent`. With the exception applied,
    // both passed the guard — the page documenting the destructive command was
    // exactly what licensed waving the destructive command through.
    publishable: false,
    id: 'operator-command',
    pattern: /\bdocker(?:\s+-?compose)?\s+(?:run|exec|build|up|down|logs)\b|--user\s+root\b|\bsudo\s+\w+|\bgit\s+(?:push|commit)\b/,
    why: "a command for the reader to run, which is the owner's job, not a support answer",
  },
];

/**
 * The same rules, exported so they can be checked against this product's own
 * pages instead of assumed clean.
 *
 * A deterministic rule is only safe when no canonical page can contain what
 * it matches. That premise was assumed three times in this repo and was wrong
 * every time: `/data/wiki` is the receipt, `/var/lib/plow` is in
 * `concepts/where-data-lives.md`, and "Python 3.11" is a product requirement.
 */
export const ALWAYS_PROBE = ALWAYS.map((rule) => ({ id: rule.id, pattern: rule.pattern, publishable: rule.publishable !== false }));


/**
 * The knowledge this deployment already publishes.
 *
 * A deterministic rule can only be safe when no canonical page contains what it
 * matches, and that premise was assumed three times here and wrong every time:
 * `/data/wiki` is the receipt, `/var/lib/plow` is in
 * `concepts/where-data-lives.md`, `docker compose down` is in the same page, and
 * "Python 3.11" is a product requirement. Measured against this vault,
 * `deployment-path` matches `/var/lib/plow` and `/opt/plow`, and
 * `operator-command` matches `docker compose down`, `docker compose run`,
 * `docker compose up`, `docker compose exec` and `git push`. The first yields
 * to a quotation. The second does not, for the reason on the rule.
 *
 * So the guard stops guessing whether a match is a leak or a citation and
 * checks: if the phrase appears in the canonical corpus, the agent is quoting
 * knowledge this deployment chose to publish, and that is not a disclosure.
 * It is also the check that needs no model and no language: the vault is
 * mounted, and the text is the text.
 *
 * The corollary is a real limit: something the owner has written into the
 * wiki is not a secret any more. That is the owner's call to make, not the
 * guard's — and it holds only for the rules that opt into it, because a rule
 * marked `publishable: false` is not asking what is secret.
 */
export function buildCanonicalCorpus(wikiPath) {
  const text_out = [];
  let pages = 0;
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_raw' || entry.name === '.wiki' || entry.name === '.git') continue;
        walk(full, depth + 1);
      } else if (entry.name.endsWith('.md')) {
        pages += 1;
        let text;
        try {
          text = readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        // The lowercased text is kept whole, because a quotation is verbatim:
        // "git push" is four characters per token and is still a citation, and
        // a token filter long enough to keep it would also launder a bare
        // "node". Containment on the exact phrase is the honest test.
        text_out.push(text.toLowerCase());
      }
    }
  };
  walk(wikiPath, 0);
  return { text: text_out.join('\n'), pages };
}
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

/**
 * Every rule that fires on this text, in rule order, not only the first.
 *
 * One rule at a time is how a silenced hit used to hide an enforced one: "the
 * state lives in /var/lib/plow. Run `docker compose down -v`." matched the
 * deployment path first, the vault publishes that path, the exception
 * swallowed the hit, and the command left with it. A rule the vault cannot
 * silence has to be able to speak for the whole message.
 */
function allHits(text, rules) {
  const found = [];
  for (const rule of rules) {
    const m = rule.pattern.exec(text);
    if (m) found.push({ id: rule.id, phrase: m[0].trim(), why: rule.why, publishable: rule.publishable !== false });
  }
  return found;
}

/**
 * The deterministic half, and the only half that runs on every door.
 *
 * These match identifiers and paths, which mean the same thing in every
 * language: a container id, a host hash, an OS name, a deployment path, a
 * model id, a local port, a command for the reader to run. A hit is final and
 * nothing can overturn it, which is what makes it safe to keep synchronous.
 *
 * A publishable rule yields to a quotation: if the owner published the
 * phrase, the model is quoting knowledge this deployment chose to publish,
 * and that is not a disclosure. A rule that opts out does not yield.
 *
 * @returns {{id: string, phrase: string, why: string} | null}
 */
export function infraLeak(text, corpus) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const found = allHits(text, ALWAYS);
  if (found.length === 0) return null;
  const enforced = found.find((hit) => !hit.publishable);
  if (enforced) return enforced;
  for (const hit of found) {
    if (corpus && isPublished(corpus, hit.phrase)) continue;
    return hit;
  }
  return null;
}

/**
 * A quotation is verbatim. The phrase has to appear in what the deployment has
 * published, character for character, so a partial echo cannot launder a
 * disclosure and a four-character command can still be a citation.
 */
function isPublished(corpus, phrase) {
  const haystack = typeof corpus === 'string' ? corpus : (corpus?.text ?? '');
  if (!haystack) return false;
  return haystack.includes(String(phrase).toLowerCase());
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
