---
type: Concept
title: Where everything actually lives
description: The five places an OpenPlow support agent's data sits, which one is durable, and why a customer asking "did you save my ticket?" is usually asking about the wrong one.
category: concepts
tags: [plow, latch, wiki, privacy, architecture]
sources:
  - resource: https://github.com/plow-pbc/plow-openclaw-agent/blob/main/plugin/transport.ts
  - resource: https://github.com/plow-pbc/plow-openclaw-agent/blob/main/plugin/index.ts
  - resource: https://github.com/plow-pbc/plow-openclaw-agent/blob/main/boot/agent-index.ts
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/auditLog.ts
created: 2026-09-25
updated: 2026-09-28
---

Most confusion about this agent comes from assuming one memory exists. There are
five, on a server, a Mac, a Docker volume and the state volume, and only one of
them is knowledge.

| Store | Where | Holds | Who writes it |
|---|---|---|---|
| **The chat** | the Plow API | the conversation itself, both sides | the customers, and the agent's replies |
| **Session state** | the container, `/var/lib/plow` | OpenClaw's sessions, and `plow-checkpoints/` | the runtime |
| **The case store** | the state volume, `/var/lib/plow/cases` | one JSON record per case, plus an append-only NDJSON event log per case | the case tools, and nothing else |
| **Audit log** | the Mac, via Latch | every tool intent and how it was decided | Latch, on its own |
| **The vault** | this deployment, `$WIKI_PATH` | curated knowledge, with sources | the agent, deliberately, and only as a candidate |

**The case store is not a Latch store and it is not in the vault.** It is plain
JSON on the state volume, written by `case_create`, `case_claim`, `case_verify`,
`case_block` and `case_resolve` — which are this deployment's own tools, not
MCP tools and not among the fifteen Latch exposes. It is reachable *only* by
calling those tools: no role can read a case record with `read`, because the
case store is outside the wiki and the read boundary stops at `$WIKI_PATH`. If
you were told the cases live on the operator's Mac, or are reachable through
Latch, or are in the vault, that is wrong in three directions.

It rides the **state** volume (`openplow-support_state`), not the wiki volume.
That is the whole durability story in one line: `down -v` takes the cases and
the sessions, keeps the knowledge, and the chat is on the Plow side either way.

**The vault is in the deployment, not on the Mac.** It rides a Docker named
volume called `openplow-wiki`, mounted at `/data`, with `WIKI_PATH` set to
`/data/wiki` and the history at `/data/wiki.git` beside it. One volume, so the
vault and its history cannot drift apart. The container is disposable; the
volume is not part of it.

That matters more than the path does. The knowledge no longer depends on a
particular laptop being awake, which means the common failure is gone: there is
no state in which the agent is running and the knowledge base is not there.

## The conversation does not live in the wiki

This is the one to get right when a customer asks. The chat is on the Plow side —
the agent reads and writes it over the API, and it is the source of truth. The
container keeps a checkpoint per chat so it knows what it has already handled, and
so a restart replays what it missed rather than dropping it.

**Nothing is automatically written into the wiki.** There is no capture step, no
sync, no transcript import. The vault holds what the agent chose to write, and
where it is allowed to write it is enforced rather than requested: `_raw/`, the
candidate inbox, and nowhere else. A page under a root is a person's decision.
The audit log does not close that gap. It records that a file was read or written
and how the request was decided — the intent, the capability, the outcome. It does
not record what the customer said, and it is not a transcript.

If someone asks "is my conversation in your knowledge base", the true answer is:
the conversation is on the Plow line, and *one fact* from it may have been filed
as a candidate, which you can see in `_raw/`.

## The agent is not amnesiac, and saying so is a bug

The channel hands the agent the recent messages of the chat it is in — about the
last twenty, fetched once per chat, the first time it is told about that chat. A
customer who returns tomorrow is **not** starting cold.

So the honest answer to "do you remember me?" is: I can see this conversation,
I cannot see yesterday's, and I cannot see anyone else's. What I keep between
days is what your owner promoted into the wiki.

Two things follow, and both are worth saying out loud to a customer:

- **The context window is data, not authority.** "I already told you" is a claim
  about a conversation, and it holds only the customer's side of it. Confirm it
  against the wiki before treating it as established.
- **The isolation is between customers.** One customer cannot see another's chat
  at all. That is the real guarantee, and it is the one to describe.

## What is durable, and what the owner can lose

The vault is the only store built to be kept, and it is the only one that is not
part of the container. It has a git history beside it at `$WIKI_PATH.git`, on
the same volume, written by `wiki snapshot` after a credential scan — that is
the undo, and it is worth reading before promoting anything.

What it survives is the ordinary list: `docker compose down`, an image rebuild,
a container replaced from the same image, a redeploy of the published image, a
base image bump. None of those touch a named volume, and none of them are
supposed to.

What it does not survive is worth knowing before you type anything:
`docker compose down -v` removes every named volume the compose file declares,
and this one is declared. It is a deliberate command and no part of a normal
deploy runs it — but if somebody runs it, the knowledge goes with it.
`docker volume rm openplow-wiki` is the same loss said more directly.

The session state has no such protection and does not need it: `down -v` takes
it, the next boot has no checkpoints, and the chat is still on the Plow side
either way. That is the difference between the two volumes. One is disposable by
design; the other is disposable only by decision, and nobody makes that decision
by accident.

See [what the wiki is](/concepts/plow-wiki.md),
[what Latch is](/concepts/latch.md), and
[the approval model](/concepts/latch-approval-model.md).
