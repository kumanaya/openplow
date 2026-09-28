---
type: Runbook
title: How to publish your agent on the Agent Index
description: The two routes onto the index, what each one actually gets you, and the three-step gate between a local agent and a 1-click install.
category: skills
tags: [runbook, agent-index, deploy, plow-agents]
sources:
  - resource: https://aiworthusing.com/agent-index/publish
  - resource: https://github.com/plow-pbc/plow-agents
  - resource: https://github.com/plow-pbc/plow-openclaw-agent
  - resource: https://github.com/plow-pbc/agent-index-client
created: 2026-09-28
updated: 2026-09-28
applies-to: The Agent Index
---

## The short version

Publishing is **two different things**, and confusing them is the most common
wasted afternoon:

1. **Being listed** — a page on the index and a usage reporter. You do this
   yourself.
2. **Being installable in one click by a stranger** — a Plow admin has to admit
   your image. You cannot do this part alone.

Everything below is one of those two.

## Route 1: you built on a Plow base image

You already have a Plow line, a Dockerfile and a `compose.yml`. Two commands:

```sh
plow-agents login
plow-agents deploy --local --line ln_p1
```

That mints a credential and starts Compose locally. Text the line; the agent
answers.

To **register the listing**, set the id and restart:

```sh
echo AGENT_ID=YOUR_AGENT_SLUG >> plow-credentials
docker compose up -d
```

The base's client registers on boot. `plow-agents image set SLUG` edits the
listing's name, blurb, repo, video, link and screenshot afterwards.

## Route 2: you already have an agent

Take `agent_index_client.py` from
[plow-pbc/agent-index-client](https://github.com/plow-pbc/agent-index-client)
and run it every five minutes next to your agent. It reads Hermes, Claude Code
and Codex usage out of the box; anything else works by swapping in your own
usage function.

```sh
plow-agents login
export PLOW_AGENT_TOKEN=$(cat ~/.config/plow/token)
python3 agent_index_client.py --agent YOUR_AGENT_SLUG --dry-run
```

`--dry-run` first — it shows exactly what would be reported. Then:

```sh
python3 agent_index_client.py --register \
  --agent YOUR_AGENT_SLUG \
  --name 'My Agent' \
  --blurb 'One line about what it does' \
  --logo ./logo.png
```

`--logo` is optional: the square image the leaderboard shows instead of your
agent's first letter. Run the command again to change any of it.

## The three-step gate to 1-click deploy

This is the part the publish page compresses into "an admin enables it", and it
is the part worth stating precisely:

| Step | Command | Who |
|---|---|---|
| 1. **Register** | `image set SLUG` | you — creates **no** Plow catalog row |
| 2. **Admit** | `image promote SLUG REF --owner YOUR_UID` | a Plow admin, non-admins cannot |
| 3. **Promote** | `image push IMAGE --promote SLUG` | you, no admin needed after that |

Admission **requires an existing index listing**, and it takes the initial Plow
name from that listing. It reads the public Plow row first and refuses, before
any write, if the row is missing and no `--owner` was given.

Once admitted you ship releases yourself:

```sh
plow-agents image push ghcr.io/YOU/your-agent:v2 --promote YOUR_AGENT_SLUG
```

`plow-agents image push` without `--promote` only prints a digest — it changes
nothing. A promotion affects **new** agents; running agents keep the image they
booted with.

**Rollback is not a version tag.** `plow-agents image promote SLUG <old-digest>`
rolls back, and `plow-agents image promote SLUG --none` stops new provisions.

## The human step the pages compress

The index spells the last mile out, and it is a person, not a command:

> Getting your agent one-click deployable is done with the Plow team. Message
> **danedelattre** on the [AI Worth Using Discord](https://discord.gg/ZSJZQ7Wmu)
> and we will set it up with you.

The three steps that precede it:

1. Watch the video on getting an agent running in Plow's cloud — it is embedded
   on the [Agent Index page](https://aiworthusing.com/agent-index).
2. Deploy your image with `plow-agents` and **make sure it texts you back**.
   The index's own note applies to the *Hermes* base; this repository builds on
   `plow-openclaw-agent`, so there is no Hermes version to match.
3. Post your repo, the **commit hash** and your **Agent Index ID** in the
   Discord verification thread.

So the honest answer to "why is my agent not installable" is usually step 2 —
the agent never texted back — or step 3, because nobody asked.

## GHCR specifics that cost people an hour

- Use a **classic** GitHub PAT with `write:packages`. A fine-grained PAT cannot
  push to GHCR.
- After the first push, make the package **public** in GitHub's settings. Until
  you do, Plow's anonymous pull fails and the error points at the wrong thing.
- Copy the **full** `repository@sha256:…` reference printed on the last line.

## Two rules that are not negotiable

**Never bake `PLOW_AGENT_TOKEN` into an image.** It says *who* runs that
container. In a published image it makes every installer an installer of your
entry — which is correct for the agent id and catastrophic for the token.

**A listing is a page, and the page is judged.** A wall of dated stories with
real numbers in them reads as a different artifact from a demo video. See
[the Agent Index](/concepts/agent-index.md) for the score.

## Where this deployment already is

This repository is not at step zero. `AGENT_ID` is set in the
`Dockerfile`/`compose.yml` and `scripts/register.sh` performs the `--register`
call, so the listing exists and usage is reported. **What has not been done is
steps 2 and 3**: no public image has been pushed, so there is nothing for an
admin to admit and no 1-click install.

## Local teardown

```sh
plow-agents revoke
docker compose down -v
```

`-v` deletes the state volume, so the next boot starts fresh. The
`openplow-wiki` volume is external and survives it — see
[where the data lives](/concepts/where-data-lives.md).

## Tell the customer the truth about what they have

A listing is not an installation path unless `--install-url` is set, and
community agents have no cloud deploy path, so that field *is* the install
tutorial. If a customer asks "how do I run this", the answer is that field plus
the repo, not a promise that the leaderboard installs anything.

Prerequisites for the whole route: Python 3.11+, Git, Docker, a registry
account that can publish public images, and a phone that can send an activation
text.
