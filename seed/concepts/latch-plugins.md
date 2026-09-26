---
type: Concept
title: The Latch plugin model
description: What a latch-plugin.json declares, how a binary is staged and verified, and how the argv allowlist turns a command into a read or a write.
category: concepts
tags: [latch, plugins, security]
sources:
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/plugins/manifest.ts
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/plugins/stage.ts
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/plugins/argvRules.ts
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/plugins/env.ts
created: 2026-09-25
updated: 2026-09-26
---

A plugin is a folder with a `latch-plugin.json` and, if it ships binaries, a
staged `runtime/<arch>/bin/<binary>`. Latch ships three: `gog` (Gmail and
Calendar), `messages` (iMessage history) and `wiki` (the vault CLI). Browser use
is a hardwired row with no manifest at all.

**OpenPlow does not use the `wiki` plugin.** The vault it maintains is in its
own deployment, on a named volume, and the CLI runs natively in the container.
An owner who has the plugin installed may still have a vault on the Mac; it is
not the knowledge base this deployment reads, and consulting it would mean
crossing to the Mac for something already on local disk. The manifest contract
below is still Latch's and is still described accurately.

## What a manifest declares

- `name`, `version`, `command` — the argv[0] an agent types.
- `runtime.binaries[]` — per-arch `arm64`/`x64` **https** `url` and a `sha256`,
  plus an optional `executable` name inside the archive.
- `exec.argv` — non-empty; argv[0] may not contain a `..` segment.
- `env` — UPPER_SNAKE names to `{fixed: "…"}`. The only substitutions are
  `${plugin_home}` and `${owner_home}`. `wiki` uses
  `WIKI_PATH = ${owner_home}/Plow/wiki`, which is why the agent never passes
  `--wiki`.
- `argv.read` and `argv.write` — the allowlists, below. They may not overlap.
- `requires.accounts` and `requires.permissions` — what setup asks for.
- `skill` — a Markdown file inside the plugin, published to the Mac's skill list
  while the plugin is on.

Every manifest refusal is a **fixed sentence naming a field**, never quoting a
value — so a stranger's text can never reach a sentence the owner reads.

## The argv allowlist is the interesting part

The lists are **prefixes matched against the argv tail** (`argv.slice(1)`). So
`["validate"]` means the argument after `wiki` is literally `validate`.

`classifyArgv` returns read, write, or refused. The refusal names the allowed
subcommands in the manifest author's own words and **never echoes the agent's
argv** — that would put a stranger's text into the audit log.

For `wiki`: `validate` and `history` are reads; `init`, `index` and `snapshot`
are writes. `index` counts as a write because it regenerates files on disk. A
`--wiki <path>` flag is **refused outright**, because only the subcommand at the
front of the tail is recognised.

A read call's rule key collapses to `[argv[0], ...prefix]`, so query text may
vary freely. A **write** is keyed on the full argv.

## Staging is verified, every time

The runtime tree is deleted and rebuilt on every run, so a modified staged
binary never survives. The archive is fetched by expected sha, **re-hashed on
every run** (a stale cache entry cannot be hit), a digest mismatch deletes the
archive and throws, and any failure removes the whole `runtime/<arch>` tree — a
half-staged plugin is never left.

The directory name must equal the manifest name, and a `command` is claimed by
the first plugin to stage it.

See [what Latch is](/concepts/latch.md) and
[why a command is refused](/skills/why-the-agent-cannot-edit-canonical-pages.md).
