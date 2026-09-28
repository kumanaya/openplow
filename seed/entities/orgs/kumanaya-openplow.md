---
type: Organization
title: OpenPlow
description: The open-source customer-support agent this deployment runs — a three-role OpenClaw organization that answers only from a canonical wiki.
category: entities
tags: [org, open-source, openplow, agent-index]
sources:
  - resource: https://github.com/kumanaya/openplow
  - resource: https://github.com/kumanaya/openplow/blob/main/README.md
  - resource: https://openplow.vercel.app/
  - resource: https://aiworthusing.com/agent-index/publish
created: 2026-09-28
updated: 2026-09-28
website: https://github.com/kumanaya/openplow
---

**OpenPlow Support** — MIT licensed, Copyright 2026 Daniel Kumanaya. Free to
read, run and fork: <https://github.com/kumanaya/openplow>.

A customer-support agent for a product team, deployed by that team's operator.
It is independent software — not Plow, not Latch, not OpenClaw, and not any
vendor's official support desk.

## What it is, in one paragraph

One OpenClaw Gateway runs three explicitly separated roles. **Frontline** is the
only one that talks to a customer, and it answers only from a canonical wiki,
with a receipt. If the wiki has no reliable answer it opens a durable case
rather than improvising. **Investigator** claims that case and produces an
evidence-backed result, using Latch only for operator-authorized work.
**Curator** turns a resolved case into a sanitized knowledge candidate that a
human must still promote. Each role gets `tools.profile: "minimal"` and grants
back only what its job needs, and the deployment publishes no port at all.

The state machine is the spine:
`NEW → KNOWLEDGE_CHECKED → ESCALATED → INVESTIGATING → VERIFIED → RESOLVED →
KNOWLEDGE_CANDIDATE`, with `BLOCKED`, `FAILED` and `NEEDS_HUMAN` terminal.

## What it is honestly not

One shared Gateway is **not** hostile multi-tenancy. It limits
customer-controlled model turns; it does not survive a compromised Gateway
administrator, a malicious plugin, or a container escape. Tenants that are
mutually hostile need separate hardened Gateways. The repository says so in its
own `SECURITY.md`, and this page should not be softer than that file.

## On the Agent Index

The listing registers and usage reporting are wired: `AGENT_ID` is set in the
`Dockerfile` and `compose.yml`, and `scripts/register.sh` performs the
`--register` call.

**What is not done is the public image.** Nothing has been pushed, so there is
no digest for an admin to admit and no 1-click install from the leaderboard. The
path is `plow-agents image push`, then the Discord verification thread. See
[how to publish your agent](/skills/how-to-publish-your-agent-on-the-agent-index.md)
and [AI Worth Using](/entities/orgs/ai-worth-using.md).

Note for anyone following the index's own instructions: they point at Plow's
**Hermes** base image. This project builds on `plow-openclaw-agent`, which is a
different base, so "use the latest version" applies to that one and not to this
repository.

Related: [the Agent Index](/concepts/agent-index.md),
[the hackathon](/concepts/aiworthusing-hackathon.md),
[where the data lives](/concepts/where-data-lives.md) and
[public sources](/references/public-sources.md).
