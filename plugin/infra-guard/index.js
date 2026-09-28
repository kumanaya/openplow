// OpenPlow infrastructure guard: a support agent never reports the machine it
// runs on.
//
// This exists because it did. Asked "where are you running", the agent
// volunteered its container id, its WSL2 host, x64, Node v24.19.0 and the model
// id behind it. The persona already said what OpenPlow is; it did not say that
// where it lives is not a support answer, and a prompt is not enforcement.
//
// So the guarantee is mechanical, in the Gateway, at three doors:
//
//   1. before_agent_finalize: a reply carrying runtime identity goes back to the
//      model once, with the exact phrase and how to rewrite it.
//   2. before_tool_call: `message` / `plow_start_thread` with such a body never
//      runs, and the model is told why.
//   3. message_sending: the last door. It is not delivered.
//
// Unlike a voice guard, there is no room check and no ownership lookup. Every
// outbound message from this agent is to someone who has no business holding its
// host id — the owner included, because "what am I running on" is an operator
// question answered by the operator, not by a support agent texting customers.
// That is the one place this is deliberately stricter than the persona.

import {
  infraLeak,
  judgementCandidates,
  judgementPrompt,
  judgementSaysLeak,
  messageText,
  revisionInstruction,
} from './rules.js';

// Shipped inside OpenClaw's own dist/extensions (see Dockerfile), so the SDK is
// two levels up.
import { definePluginEntry } from '../../plugin-sdk/plugin-entry.js';
import { completeWithPreparedSimpleCompletionModel, prepareSimpleCompletionModelForAgent } from '../../plugin-sdk/simple-completion-runtime.js';

const log = (msg) => console.log(`[infra-guard] ${msg}`);

// One judge per sentence, for the life of the process. The same sentence comes
// back through several doors in a single turn, and a customer paying for a
// second opinion on the same words is a cost with no information in it.
const decided = new Map();
const DECIDED_LIMIT = 512;

function remember(sentence, isLeak) {
  if (decided.size >= DECIDED_LIMIT) decided.clear();
  decided.set(sentence, isLeak);
}

/**
 * The semantic half of the guard.
 *
 * "Is the agent describing its own machine, or quoting a page that says the
 * same thing?" is a question about meaning. It was being answered with a
 * first-person regex, which is a question about grammar — so it was English
 * only, and it could not see the third person. This deployment is Portuguese,
 * and "o container roda como node" is third person and exactly the thing that
 * got through.
 *
 * It runs at the finalize door only. The other two must stay synchronous — the
 * plugin API does not await the hook, and an async one has its `{ block: true }`
 * discarded — and a model call cannot be synchronous. Finalize is also the
 * right place: a message caught here never reaches the other two.
 */
async function judgeNarration(text, agentId) {
  const candidates = judgementCandidates(text);
  if (candidates.length === 0) return null;

  let prepared;
  try {
    prepared = await prepareSimpleCompletionModelForAgent({ agentId });
  } catch (error) {
    // A judge that cannot start must not become a reason to rewrite a correct
    // answer. The deterministic rules already ran, and the persona covers the
    // rest.
    log(`judge unavailable: ${error?.message ?? error}`);
    return null;
  }

  for (const { text: sentence, hit } of candidates) {
    if (decided.has(sentence)) {
      if (decided.get(sentence)) return { ...hit, phrase: hit.phrase, sentence };
      continue;
    }
    let answer = '';
    try {
      const result = await completeWithPreparedSimpleCompletionModel(prepared, {
        messages: [{ role: 'user', content: judgementPrompt(sentence, hit) }],
        maxTokens: 8,
      });
      answer = typeof result === 'string' ? result : (result?.text ?? result?.content ?? '');
    } catch (error) {
      log(`judge failed: ${error?.message ?? error}`);
      continue;
    }
    const isLeak = judgementSaysLeak(answer);
    remember(sentence, isLeak);
    log(`judge rule="${hit.id}" phrase="${hit.phrase}" verdict=${isLeak ? 'LEAK' : 'DOC'}`);
    if (isLeak) return { ...hit, sentence };
  }
  return null;
}
export default definePluginEntry({
  id: 'infra-guard',
  name: 'OpenPlow infrastructure guard',
  description: 'A customer support agent never discloses the host, container, runtime, paths or model it runs on.',
  register(api) {
    // 1. The reply of a turn, before anyone sees it. This is the only door
    //    that can afford a model, and therefore the only one that sees the
    //    difference between self-description and a citation.
    api.on('before_agent_finalize', async (event, ctx) => {
      const text = messageText(event?.lastAssistantMessage);
      const hit = infraLeak(text) ?? (await judgeNarration(text, ctx?.agentId));
      if (!hit) return;
      log(`revise session=${ctx?.sessionKey} rule="${hit.id}" phrase="${hit.phrase}"`);
      const instruction = revisionInstruction(hit);
      return {
        action: 'revise',
        reason: instruction,
        retry: { instruction, idempotencyKey: 'openplaw-infra-guard', maxAttempts: 2 },
      };
    });

    // 2. Tools that put words in front of someone else.
    api.on('before_tool_call', (event, ctx) => {
      const p = event?.params || {};
      const name = event?.toolName;
      let text = null;
      if (name === 'plow_start_thread') text = p.body;
      else if (name === 'message') {
        if (!(p.action === undefined || p.action === 'send' || p.action === 'reply')) return;
        text = p.message ?? p.text ?? p.body;
      }
      if (!text) return;
      const hit = infraLeak(messageText(text));
      if (!hit) return;
      log(`block tool=${name} rule="${hit.id}" phrase="${hit.phrase}"`);
      return { block: true, blockReason: `Not sent. ${revisionInstruction(hit)}` };
    });

    // 3. The last door.
    api.on('message_sending', (event) => {
      const hit = infraLeak(messageText(event?.content));
      if (!hit) return;
      log(`cancel rule="${hit.id}" phrase="${hit.phrase}"`);
      return { cancel: true, cancelReason: `infra-guard: "${hit.phrase}" is deployment detail, not a support answer` };
    });

    log('ready: finalize, tool and delivery checks registered');
  },
});
