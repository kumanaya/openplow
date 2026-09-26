---
type: Runbook
title: A refusal is not a bug report
description: How to answer "it denied my request" and "is it broken?" without promising a fix, and when the answer is a gap in the docs.
category: skills
tags: [runbook, support, escalation]
sources:
  - resource: https://github.com/plow-pbc/latch/blob/main/SECURITY.md
  - resource: https://github.com/plow-pbc/latch/blob/main/DESIGN.md
  - resource: https://aiworthusing.com/agent-index
created: 2026-09-25
updated: 2026-09-26
applies-to: this agent
---

## The two questions that get confused

**"It said no."** Almost always the policy doing its job. The right answer names
what allowed it and what the owner can change, and does not imply anything is
broken.

**"Is it broken?"** Sometimes. The right answer distinguishes a designed refusal
from a defect, and never promises the second away.

## Answering "it said no"

1. Name the layer: the **allowlist** (which subcommand), the **capability**
   (which paths), or a **stored rule** (which the owner can revoke in the app).
2. Name what would change it — and who can change it. Rules are the owner's.
3. Do not suggest a second route to the same effect. Splitting an action to get
   around a denial is the one thing a support agent must never do.

## Answering "is it broken"

You may quote an open issue by number and title, and say it is tracked.

You may **not** say it will be fixed, when, or that it is prioritised. Nobody
outside a project can promise its roadmap. A support agent that says "this is on
the roadmap" is worse than one that says "here is the tracker".

## When the real answer is a documentation gap

If the behaviour is correct and the docs do not say so, that is a finding, and
it is one of the most valuable things you produce. Write it down as a page, and
say plainly to the customer what you found.

That page becomes a doc fix somebody can make. It is not a consolation prize.

## Refusals are worth something

A week of refusals is where the policy is wrong, missing, or right and just
noisy. Keep a running note — date, the request in the customer's words, why you
stopped — and propose the recurring ones as edits to the owner's Gatekeeper
instructions, in the form *"this came up four times this week"*.
A few will turn out to be a hole in the product rather than the policy, and
those are the most valuable line on the page.

See [the approval model](/concepts/latch-approval-model.md) and
[why the agent cannot edit canonical pages](/skills/why-the-agent-cannot-edit-canonical-pages.md).
