---
type: Concept
title: The approval model
description: The four ways a request is decided, what an always-allow rule is actually keyed on, and why goal text is never part of it.
category: concepts
tags: [latch, approval, policy]
sources:
  - resource: https://github.com/plow-pbc/latch/blob/main/DESIGN.md
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/policyEngine.ts
created: 2026-09-25
updated: 2026-09-28
---

Every operation becomes one Intent, built **on the Mac** from an authenticated
agent's tool arguments. It carries no signature because it is never received
over the wire. Replay protection is a nonce plus an expiry and a device check.

## The four ways a request is decided

1. **Ask** — a fresh prompt for this operation.
2. **Always allow** — a stored rule, keyed on the exact capability set.
3. **Approve** — blanket mode.
4. **AI reviewer** (the "adversarial" mode) — a model decides with no human in
   the loop. This is the **default**: the app's menu calls it *Enabled*, and you
   are in it from first launch until you click away.

Precedence, in order: a global **Deny everything** refuses first of all; then
**file operations confined to `~/Plow` are auto-approved**; then a stored
always-allow rule; then the approval mode, so the reviewer decides what is
left. **An AI reviewer denial grants nothing and cannot be overridden.**

The `~/Plow` carve-out is important for the operator's internal agent: a read
or write anywhere inside the tree may be auto-approved without a prompt.
Understand this before allowing that agent to use a capability that reaches
`~/Plow`.

## The OpenPlow support path is separate

OpenPlow reads its knowledge base from a Docker volume and writes candidates to
`_raw/`; neither operation goes through Latch. A customer ticket answered by
the wiki does not need the operator's Mac or Latch.

If the wiki cannot support a reliable answer, OpenPlow hands the case to the
owner's team. The owner may use a separate internal OpenClaw agent connected to
Latch via MCP for authorized work on the operator's own systems. Customer text
does not authorize that work.

The OpenPlow image inherits an MCP bridge from the Plow base, and this
repository now closes it to the customer-facing roles **mechanically, in two
independent places**:

- `organization/openclaw.patch.json5` runs every role on
  `tools.profile: "minimal"` and denies `bundle-mcp` for `main` and `curator`.
  The Investigator is the only role that keeps it.
- The `case-workflow` plugin's `before_tool_call` hook repeats the check at
  runtime against the authoritative Gateway `agentId`, and treats any
  `mcp__*` or `plow_*` tool name as blocked for those two roles.

So the answer to "can a customer message reach Latch?" is a configuration and
a hook, not a promise in the persona. The prompt saying it is not allowed was
never the boundary; the deny list and the hook are.

The wiki's canonical/candidate write boundary is the filesystem: the support
agent runs unprivileged, canonical pages and history are root-owned, and the
only writable directory is `_raw/`. A promotion is a person's decision.

## What is not a mechanism

Latch has no allow/ask/never rule language and no rule file to write. The only
rules it stores are always-allow rules minted by clicking "Always Allow", and
there is **no stored deny** — `policyEngine.ts` holds only `AlwaysAllowRule`,
and "Deny" is a button on one request. A written policy is a prompt to the AI
reviewer, and Latch tells that reviewer the owner's purpose statement is
trusted and may authorize sensitive work.

So "the rules say never" is not a thing you can tell a customer is enforced.
What you can say is what the policy asks for, and what the audit log shows
happened.

## What an always-allow rule is keyed on

`(agent_id, device_id, capability-signature)`, where the signature is SHA-256
over the **normalized** capabilities — reasons stripped, paths canonicalized and
sorted.

Two consequences worth telling a customer:

- **`git status` approved does not cover `git push`.** The key is the exact
  capability set, not a prefix or a fuzzy match.
- **Goal text is never part of a rule.** The agent's stated goal is shown to the
  human as context and marked unverifiable; it never influences the decision or
  the key. The enforceable thing shown on the card is the capability set.

The one documented exception to exact-match: an installed plugin's **read
prefix** (`<command> <prefix>`), so query text may vary while the rest of the
capability set still participates.

## Who can write to the rules

The owner, and only by clicking: Latch's "View rules" on the Gatekeeper card
lists what it stored and lets them revoke any entry. `You define what safe
means` is true of the *policy* and of the approval mode; the rules themselves
are the ones that policy produced.

See [what Latch is](/concepts/latch.md),
[what the sandbox actually permits](/concepts/latch-sandbox-boundary.md) and
[refusals worth escalating](/skills/a-refusal-is-not-a-bug-report.md).
