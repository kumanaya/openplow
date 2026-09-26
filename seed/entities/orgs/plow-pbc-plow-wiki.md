---
type: Organization
title: plow-wiki
description: The LLM wiki an agent reads and writes — an Obsidian vault of curated, sourced facts, plus the wiki CLI.
category: entities
tags: [org, product, wiki]
sources:
  - resource: https://github.com/plow-pbc/plow-wiki
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/README.md
created: 2026-09-25
updated: 2026-09-26
website: https://github.com/plow-pbc/plow-wiki
---

A curated wiki of durable facts for Plow agents, kept as an
[OKF v0.2](https://github.com/GoogleCloudPlatform/open-knowledge-format) bundle
in an Obsidian vault, plus the `wiki` CLI that maintains it. The vault is at
`$WIKI_PATH` — `/data/wiki` on the `openplow-wiki` volume in an OpenPlow
deployment, not on anybody's Mac.

- **License:** Apache-2.0. The obsidian-wiki skills it depends on are MIT.
- **Language:** Python. The published releases carry darwin-only binaries,
  which is what a Latch `wiki` plugin stages on a Mac. A Linux deployment does
  not use those: it installs the source with `uv`, pinned to commit
  `4faad4d9c9b15e3fb1ea6919e7334a814270e02e` (v0.2.0), against a CPython 3.12
  it fetches itself — the base image ships 3.11 and no pip. The pin is by
  commit rather than tag, because a tag can be re-pointed and this is the tool
  that validates, indexes and commits the knowledge base.
- **Not darwin-only.** That was true of the packaged artifact, not the tool.
- **The loop closes:** this wiki is documented by, and documents, the agent
  platform that reads it.

[What the wiki is](/concepts/plow-wiki.md) ·
[public sources](/references/public-sources.md)
