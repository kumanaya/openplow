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
updated: 2026-09-26
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

That third line is the one worth knowing before you answer a customer who asks
whether the agent is fenced in. `~/Plow` is granted as a tree, so a read or
write anywhere inside it is allowed with no prompt and no review, in every mode
except Deny everything. It is wider than it sounds — whatever an owner keeps
there is reachable without a decision.

## The wiki moved out from under that grant

The knowledge base is no longer in `~/Plow`. It is in this deployment, on a
Docker named volume, and the agent reads and files into it with its own file
tools — no Latch, no intent, no decision to approve.

So the auto-approve carve-out no longer buys anything that matters for
organizational knowledge. What Latch now guards is the owner's Mac and whatever
is on it: their mail, messages, files, browser and earlier agents' work. That
is a real boundary, and it is the one a stranger in a support chat is actually
behind. But it is worth being honest that the cheap knowledge base it used to
make possible is not what it was for.

What replaces the fence is the filesystem, not the policy: the agent runs
unprivileged, canonical pages and the history beside them are root-owned, and
the one directory it owns is the candidate inbox `_raw/`. A promotion is a
person's decision, and the refusal it gets is `EPERM` from the kernel rather
than a button.

An owner who has the `wiki` plugin on may still have a vault on the Mac. See
[the plugin model](/concepts/latch-plugins.md); it is not this deployment's
knowledge base.

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

See [what Latch is](/concepts/latch.md) and
[refusals worth escalating](/skills/a-refusal-is-not-a-bug-report.md).
