---
type: Runbook
title: "The agent cannot see the wiki"
description: Symptom, cause and fix when the agent says it has no knowledge base, or answers as if it has no memory — now a deployment problem, not a Mac problem.
category: skills
tags: [runbook, wiki, deployment, permissions]
sources:
  - resource: https://github.com/kumanaya/openplow/blob/main/Dockerfile
  - resource: https://github.com/kumanaya/openplow/blob/main/compose.yml
  - resource: https://github.com/kumanaya/openplow/blob/main/bin/wiki-peek
  - resource: https://github.com/plow-pbc/plow-wiki/blob/main/skill.md
created: 2026-09-25
updated: 2026-09-26
applies-to: this deployment
---

## Symptom

The agent says it has no long-term memory, that the knowledge base is missing,
or it answers a question the vault plainly answers. It never gets a refusal —
the pages are not there to refuse anything.

## What changed, and why it decides the answer

The vault used to be a directory on the owner's Mac, and "is the agent awake?"
was a real diagnostic. It is not any more. The vault is **the deployment's**:
a Docker volume named `openplow-wiki`, mounted at `/data`, with `$WIKI_PATH`
pointing into it. The container is replaceable and the knowledge is not, so a
customer's laptop being asleep is no longer an explanation for anything.

## Cause, in order of likelihood

1. **The volume is not mounted.** `$WIKI_PATH` resolves to `/data/wiki`, and
   `/data` is a mount. A compose file without the volume, or a container run
   outside compose, gives the agent an empty directory that looks like an empty
   vault. `WIKI_PATH` being right is necessary and not sufficient.
2. **The vault was never bootstrapped.** A fresh volume has no `wiki.toml`
   until `wiki-bootstrap` runs. The structure and the ownership contract are
   created together, so this is one failure, not two.
3. **The ownership contract was never asserted**, so a canonical page is
   root-owned and not world-readable. The contract is 755 on directories and
   644 on files, root-owned, with `_raw/` the single exception — a page the
   agent cannot read is a page that was never set up, not one that was locked
   on purpose. The distinction matters: locked-on-purpose is a refusal, and this
   is a missing step.
4. **The tree does not validate.** A page fails its root's schema, `wiki
   validate` exits 1, and `wiki index` declines to index it. The pages are
   there; one of them is wrong.

## How to check

Start where the answer comes from, not on the host:

```sh
wiki-peek
```

It is read-only and answers from the deployment: where the vault is, how many
canonical pages and candidates are in it, and when history was last committed.
`no vault at /data/wiki` means the mount or the bootstrap, and the two are told
apart by whether the directory is empty or has files but no `wiki.toml`.

Then, as the agent, read something that must be there:

```sh
docker compose exec agent head -1 "$WIKI_PATH"/concepts/latch.md
docker compose exec agent wiki validate
```

If the read fails and `wiki-peek` counts pages, it is the ownership contract
(cause 3). If the read works and answers are still empty, the recall index
(`.wiki/chunks.json`) is stale — see
[a maintenance command fails as the agent](/skills/a-maintenance-command-fails-as-the-agent.md).

## What to say

> The knowledge base ships with the deployment, on a volume that belongs to it,
> and it should be there even with your laptop closed. If the agent cannot see
> it, that is a problem with this deployment, not with your machine — and it is
> worth me naming the step that is missing rather than guessing.

## The honest limit

The agent can tell you what it can see and what it cannot. It cannot repair a
missing mount, re-assert ownership, or reindex — those are root operations run
by whoever operates the deployment. Say which one is missing and stop. Do not
offer to run it as the agent, and do not suggest a route around the boundary.

See [what plow-wiki is](/concepts/plow-wiki.md) and
[where everything actually lives](/concepts/where-data-lives.md).
