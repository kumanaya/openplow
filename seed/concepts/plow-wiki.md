---
type: Concept
title: What plow-wiki is
description: The vault an agent reads and writes — where it lives, what the format guarantees, and the five commands that maintain it.
category: concepts
tags: [wiki, memory, okf]
sources:
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/README.md
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/skill.md
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/plow_wiki/cli.py
created: 2026-09-25
updated: 2026-09-26
---

An LLM wiki — Karpathy's pattern, as `obsidian-wiki` lays it out — kept as an
[OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format) bundle
in an Obsidian vault at **`$WIKI_PATH`**. In this deployment that is
`/data/wiki`, on a Docker named volume that outlives the container.

**Why it exists, in one line:** the agent forgets between days. It can see the
recent messages of the chat it is in, and nothing else — not yesterday, not any
other customer. The vault is the only store built to last, so it is the only
*knowledge*, and it is a curated one rather than a transcript. See
[where everything actually lives](/concepts/where-data-lives.md).

**The tool is not Mac-only.** `plow-wiki` is a Python CLI, Apache-2.0, and this
deployment runs it natively in the container — pinned to a commit, with its own
interpreter, so the vault format and the thing that maintains it move together.
Nothing about keeping a vault requires a laptop. See
[the org page](/entities/orgs/plow-pbc-plow-wiki.md).

Every path below is relative to `$WIKI_PATH`. The deployment sets it, the
volume it names is the one that persists, and the CLI reads it from the
environment — so nothing in the persona, the skills or the maintenance scripts
names a path of its own.

## The format, and what it guarantees

- Every page carries a `type`; links are `[text](/path.md)`; `index.md`
  declares `okf_version`; `log.md` is reserved.
- **Plow's difference from obsidian-wiki:** the page summary key is
  `description`, not `summary`. It adds `wiki.toml` (who may write which root),
  `_meta/schemas/` (what a root's pages must carry), the `^[inferred]` and
  `^[ambiguous]` bullet markers, and **snapshot history beside the vault**.

Those markers are the point. A bullet marked `^[inferred]` or `^[ambiguous]` is
one that must be **verified before it is repeated** — the wiki is allowed to be
unsure, in writing, and unsure is not allowed to propagate.

A base schema requires `[type, title, description, category, tags, sources,
created, updated]` on every page, and every fact cites a source as
`- resource: <string>`.

`entities/orgs` and `entities/people` pin `type` to `Organization` and `Person`.
The other roots leave `type` free.

## The eight roots

`entities/people`, `entities/orgs`, `entities/owner`, `concepts`, `skills`,
`references`, `synthesis`, `journal` — all `writer = "shared"`.

A root may nest (`[roots."projects/str"]`) but never inside another root, and
`wiki snapshot` refuses a top-level folder that no root starts with.

## The five commands

| Command | Does |
|---|---|
| `wiki init <path>` | creates the whole structure; refuses an existing non-empty path that is not a wiki |
| `wiki validate` | checks every page's frontmatter against its root's schema; exit 1 on any problem |
| `wiki index` | regenerates `index.md`, the root tables, and `.wiki/chunks.json` (the recall index) |
| `wiki snapshot` | commits into `$WIKI_PATH.git` **beside** the vault, after a credential scan |
| `wiki history <path>` | the commits touching a page |

**The vault must never contain `.git`.** History lives beside it, at
`$WIKI_PATH.git` — `/data/wiki.git`, on the same volume, which is why the two
cannot drift apart. A `.git` inside the wiki is a hard error, not a warning.

The refresh order is `validate`, `index`, `snapshot --author <name>`, and it
runs **as an operator, not as the agent**: all three write the canonical tree,
and the agent is not allowed to. `validate` and `history` only read, so the
agent may run those itself.

See [the Latch plugin model](/concepts/latch-plugins.md) and
[the vault is missing entirely](/skills/the-agent-cannot-see-the-wiki.md).
