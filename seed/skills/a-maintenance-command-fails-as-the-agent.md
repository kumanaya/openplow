---
type: Runbook
title: A maintenance command fails as the agent
description: "`wiki index`, `wiki snapshot` or `wiki init` run by the agent fails with a PermissionError or EACCES — they are canonical writes, and they run as root from the deployment."
category: skills
tags: [runbook, wiki, maintenance, permissions]
sources:
  - resource: https://github.com/kumanaya/openplow/blob/main/bin/wiki-refresh
  - resource: https://github.com/kumanaya/openplow/blob/main/bin/wiki-bootstrap
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/skill.md
created: 2026-09-25
updated: 2026-09-26
applies-to: this deployment
---

## Symptom

A maintenance command comes back with a Python `PermissionError` or a bare
`EACCES`, and the traceback names a temp file beside the page it was rewriting:

```
PermissionError: [Errno 13] Permission denied: '/data/wiki/.index.md.<suffix>.tmp'
```

`wiki index` is the usual one, because it writes a new file and renames it over
the old. `wiki snapshot` and `wiki init` fail the same way, on `$WIKI_PATH.git`
and on the root directory respectively.

## Cause

These three are **canonical writes**, and the agent is not permitted to make
them. It runs as `node`; the vault, its history and `/data` itself are
root-owned. See
[why the agent cannot edit canonical pages](/skills/why-the-agent-cannot-edit-canonical-pages.md)
for the whole ownership contract.

The division is deliberate: the knowledge base is maintained **by the
deployment, not by the thing answering customers from it.** If the agent could
run `wiki init`, it could create a vault, re-own it, and hand itself write
access to every canonical page. The maintenance commands therefore run as root,
in their own container, beside the agent's:

```sh
docker compose run --rm --user root agent /opt/plow/bin/wiki-bootstrap
docker compose run --rm --user root agent /opt/plow/bin/wiki-refresh
```

`wiki-refresh` runs `validate`, then `index`, then `snapshot`, in that order — it
does not index pages that fail their schema, and it does not commit a broken
tree. It re-asserts ownership afterwards, so a first run on a fresh volume
cannot leave an agent-writable `.git` behind.

## What it is not

It is **not** a Latch refusal, and there is no approval card to explain. A Latch
denial names allowed subcommands; an `EACCES` names a file. The two are
different layers, and the traceback tells you which one you are looking at —
the plugin's allowlist is described under
[the Latch plugin model](/concepts/latch-plugins.md).

## What to say

> The indexing step is not something I am allowed to run, and that is on
> purpose — the agent that answers customers from the knowledge base is not the
> thing that maintains it. Running it is a deployment operation, and it takes a
> moment. Nothing is lost; the vault is exactly as it was.

## The consequence

A failed `wiki index` leaves the recall index stale, not wrong. The canonical
pages are unchanged and still readable, and the agent can still answer from
them — it is the thing that finds a page by meaning, not the thing that holds
it, that is behind. `wiki validate` is the one the agent *can* run: it is a
read, and it is worth running before anyone concludes the vault is broken.

See [what plow-wiki is](/concepts/plow-wiki.md) and
[the vault is not there](/skills/the-agent-cannot-see-the-wiki.md).
