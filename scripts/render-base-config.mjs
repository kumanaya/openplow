// Print the config the BASE image's boot produces, and optionally hand it to
// OpenClaw's own security auditor.
//
// Two of these values are load-bearing for the trust model in SECURITY.md, and
// both change when the base pin does.
//
//   docker run --rm --network none \
//     -v "$PWD/scripts/render-base-config.mjs:/tmp/render.mjs:ro" \
//     openplow-support:test node /tmp/render.mjs
//
//   # and, to see what OpenClaw itself says about that config:
//   docker run --rm --network none \
//     -v "$PWD/scripts/render-base-config.mjs:/tmp/render.mjs:ro" \
//     -e OPENCLAW_CONFIG_PATH=/tmp/openclaw.json -e OPENCLAW_STATE_DIR=/tmp/plowstate \
//     openplow-support:test sh -c 'node /tmp/render.mjs >/dev/null; openclaw security audit'
//
// The identity below is synthetic. Only the shape of the config matters here, and
// the fields that matter — session.dmScope, tools.sessions.visibility, bindings,
// memory, skills — do not depend on who the owner is.
import { writeFile } from "node:fs/promises";

const { renderConfig } = await import("/opt/plow/boot/config.js");

const identity = {
  agent: { name: "OpenPlow Support" },
  line: { uid: "ln_probe" },
  chats: [
    {
      uid: "chat_owner",
      status: "active",
      participants: [
        { type: "agent", relationship: "self", line: { uid: "ln_probe", provider_type: "sms" } },
      ],
    },
  ],
};

const cfg = renderConfig(identity, "https://api.probe.invalid");
await writeFile("/tmp/openclaw.json", JSON.stringify(cfg, null, 2));

// The settings SECURITY.md turns on. Anything the base changes about these
// shows up here first.
console.log(
  JSON.stringify(
    {
      session: cfg.session,
      tools_sessions: cfg.tools?.sessions,
      // Undefined today, which per v2026.9.2 means the client defaults to
      // enabled. Moot with one agent; a live leak the day Plow adds a second.
      tools_agentToAgent: cfg.tools?.agentToAgent,
      tools_deny: cfg.tools?.deny,
      tools_profile: cfg.tools?.profile,
      memory: cfg.memory,
      bindings: cfg.bindings,
      gateway_roles: cfg.gateway?.roles,
      skills: cfg.skills,
    },
    null,
    2,
  ),
);
