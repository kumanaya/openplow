---
type: Runbook
title: Why the agent cannot edit canonical pages
description: A write to a page under a root comes back "Permission denied" — canonical knowledge and history are root-owned, and the agent owns exactly one directory in the vault.
category: skills
tags: [runbook, wiki, permissions, support]
sources:
  - resource: https://github.com/kumanaya/openplow/blob/main/bin/wiki-ownership.sh
  - resource: https://github.com/kumanaya/openplow/blob/main/SECURITY.md
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/skill.md
created: 2026-09-25
updated: 2026-09-26
applies-to: this deployment
---

## Symptom

The agent tries to change a page under a root — `concepts/`, `skills/`, one of
the `entities/` folders — and gets:

```
Permission denied
```

or a Python `PermissionError` naming the page it was writing. There is no
approval card behind it, and nothing was decided by a policy.

## Cause

The vault belongs to the deployment, and the deployment owns it. Canonical
knowledge and the history beside it are **root-owned**; the container runs as
`node`; and the agent owns **exactly one directory**:

| Path | Owner | The agent |
|---|---|---|
| `/data` | root | cannot add siblings |
| `$WIKI_PATH/**` | root | reads every page; cannot write, delete, rename or chmod one |
| `$WIKI_PATH/_raw` | the agent | **writes** — the one exception |
| `$WIKI_PATH.git` | root | reads history; cannot edit it |

The page the agent is reaching for is a file it does not own. `_raw/` is where
a candidate goes; a page under a root is somewhere a person has to move it to.

## Why the message reads like that

It is the **kernel**, not Latch and not a policy. No allowlist refused it, no
reviewer weighed it, and no owner rule could change it. `EACCES` is what the
filesystem says when the uid does not match the file's owner and none of the
other bits are set.

That decides how you answer. There is nothing to approve, and there is no
second route to the same write that would be legitimate: `chmod`, `chown`, a
rename, or a symlink planted in `_raw/` all fail identically, and each of them
is the shape of an attack rather than a workaround.

## What to say

> That is the boundary working, not a fault. The knowledge base belongs to your
> deployment, so pages under a root are read-only to the agent — it can read
> them and cannot change them, whatever it is asked to do. What I can do is file
> what I learned in the `_raw/` inbox, and a person promotes it from there.

## The consequence

Nothing is gained by retrying, and nothing is lost. A candidate in `_raw/`,
promoted by a person, is the whole design. If the owner wants a page changed
now, that is a maintenance operation run by the deployment operator, not a
request the agent can be given twice.

## Say what is enforced, not what is asked

This one is **mechanically enforced**. It holds against an agent that has a
shell and has decided to ignore its instructions, which is a different and
stronger claim than "the persona told it not to". It is also not a veto: the
operator writes the page, the change lands in history, and that is the only way
the page changes.

See [what plow-wiki is](/concepts/plow-wiki.md) and
[where everything actually lives](/concepts/where-data-lives.md).
