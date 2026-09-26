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

import { infraLeak, messageText, revisionInstruction } from './rules.js';

// Shipped inside OpenClaw's own dist/extensions (see Dockerfile), so the SDK is
// two levels up.
import { definePluginEntry } from '../../plugin-sdk/plugin-entry.js';

const log = (msg) => console.log(`[infra-guard] ${msg}`);

export default definePluginEntry({
  id: 'infra-guard',
  name: 'OpenPlow infrastructure guard',
  description: 'A customer support agent never discloses the host, container, runtime, paths or model it runs on.',
  register(api) {
    // 1. The reply of a turn, before anyone sees it.
    api.on('before_agent_finalize', (event, ctx) => {
      const hit = infraLeak(messageText(event?.lastAssistantMessage));
      if (!hit) return;
      log(`revise session=${ctx?.sessionKey} rule="${hit.id}" phrase="${hit.phrase}"`);
      const instruction = revisionInstruction(hit);
      return {
        action: 'revise',
        reason: instruction,
        retry: { instruction, idempotencyKey: 'openplow-infra-guard', maxAttempts: 2 },
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
