---
type: Organization
title: plow-openclaw-agent
description: Plow's maintained base image for OpenClaw — the boot, the channel plugin, the Latch bridge and the usage reporter.
category: entities
tags: [org, product, openclaw]
sources:
  - resource: https://github.com/plow-pbc/plow-openclaw-agent
  - resource: https://github.com/plow-pbc/plow-openclaw-agent/blob/main/README.md
created: 2026-09-25
updated: 2026-09-25
website: https://github.com/plow-pbc/plow-openclaw-agent
---

The base image an agent is built `FROM`. It runs OpenClaw on Plow's cloud host
or locally in Docker, reachable over a Plow phone line, able to reply in group
and email threads, and able to use the owner's Mac through
[Latch](/concepts/latch.md).

It owns the parts a variant should not rewrite: the boot, the Plow channel
plugin, the MCP bridge, the gateway config and the Agent Index reporter. A
built-on-Plow agent is a `FROM` line plus its own prompt and skills.

- **License: none declared.** The repository has no `LICENSE` file and GitHub
  reports no license. A variant that builds on it and copies none of it is on
  different ground from one that vendors it — but this is stated plainly here
  because a customer asking "what licence is that under?" deserves the real
  answer, which is "none published".
- **Images:** one immutable tag per commit, pinned by digest, in the public ECR
  gallery. There is no `latest`.

[the Agent Index](/concepts/agent-index.md) ·
[public sources](/references/public-sources.md)
