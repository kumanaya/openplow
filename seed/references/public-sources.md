---
type: Reference
title: Public sources
description: Where every answer in this wiki came from, and where to look when a page has gone stale.
category: references
tags: [reference, sources]
sources:
  - resource: https://github.com/plow-pbc
created: 2026-09-25
updated: 2026-09-28
---

Everything this wiki supports is public, which is unusual and useful: a receipt
for a Plow answer is a URL the customer can open and check in ten seconds.

## The repositories

| Repo or page | What it is | License |
|---|---|---|
| [plow-pbc/latch](https://github.com/plow-pbc/latch) | the Mac app | Apache-2.0 |
| [plow-pbc/plow-wiki](https://github.com/plow-pbc/plow-wiki) | the vault and the `wiki` CLI | Apache-2.0 |
| [plow-pbc/plow-openclaw-agent](https://github.com/plow-pbc/plow-openclaw-agent) | the OpenClaw base image | **none declared** |
| [plow-pbc/agent-index-client](https://github.com/plow-pbc/agent-index-client) | usage and story reporting | Apache-2.0 |
| [plow-pbc/plow-agents](https://github.com/plow-pbc/plow-agents) | the deploy and credential CLI | Apache-2.0 |
| `plow-pbc/plow` | the relay and the API | private |
| [Publish your agent](https://aiworthusing.com/agent-index/publish) | the two routes onto the Agent Index | — |
| [The hackathon](https://luma.com/zhkhsnpa) | dates, rules and prizes | — |
| [kumanaya/openplow](https://github.com/kumanaya/openplow) | this deployment, open source | MIT |
| [AI Worth Using](https://aiworthusing.com/) | the show, the community and the indexes | — |
| [AgentCribs](https://agentcribs.pwv.com/) | the curated PWV community that hosts the events | — |
| [The community Discord](https://discord.gg/ZSJZQ7Wmu) | where verification and 1-click deploy are requested | — |

## Where the real answer usually is

1. **The issue tracker**, when the answer is "is it broken". Search first — the
   question is usually already someone else's.
2. **`DESIGN.md`** in latch, for *why* something is the way it is, including the
   decisions that were made against an alternative — **but read
   [which sections are current](/concepts/latch-architecture.md) first**, since
   the broker-era chapters were never marked superseded.
3. **`docs/SANDBOX-BOUNDARY.md`** in latch, for what the sandbox does and does
   not enforce. It is more honest than the dialog it sits behind.
4. **`SECURITY.md`** in latch, for the two ideas the model rests on and the one
   boundary that is authenticated rather than gated.
5. **The `skill.md` in each project**, which is the same text an agent reads —
   so if a question is about what an agent is told, that is the literal answer.
6. **The shipped tool descriptions** in
   `packages/mcp-server/src/tools.ts`, over any prose. They are what an agent
   is actually told, and they were corrected where `DESIGN.md` was not.

**Two pages here are dated on purpose.** The
[hackathon](/concepts/aiworthusing-hackathon.md) has deadlines and
[the Agent Index](/concepts/agent-index.md) has a score that moves. Cite the
page and then say the date; an undated answer about a deadline is a guess.

## When this wiki is wrong

It will be. A page marked with a date is a snapshot. When a public source has
moved, the source wins — fix the page, and keep the `updated:` field honest
rather than re-dating everything to look fresh.

Never paraphrase a public page into something the page does not say. A receipt
that overstates is worse than no receipt, because it is checkable.
