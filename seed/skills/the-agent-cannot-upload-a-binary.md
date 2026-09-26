---
type: Runbook
title: "The agent cannot put a binary on the Mac"
description: plow_write_file only carries model-typed text, so any file that is not text has no path to the Mac today.
category: skills
tags: [runbook, files, known-issue]
sources:
  - resource: https://github.com/plow-pbc/latch/issues/539
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/mcp-server/src/tools.ts
created: 2026-09-25
updated: 2026-09-25
applies-to: Plow Latch on main, 2026-09-25
---

## Symptom

The agent is asked to put a PDF, an image, an audio file or any archive on the
Mac, and it cannot. It may produce something that looks like the file and is
not.

## Cause

`plow_write_file` takes model-typed **text** and nothing else. There is no
binary write path. `plow_read_file` is the mirror of that: it reads text
inline, and any other file comes back as an embedded resource the client saves
locally — so reading a binary is possible, and writing one is not.

This is tracked and open:
[latch#539](https://github.com/plow-pbc/latch/issues/539) — "No way for an agent
to push a binary file to the Mac — `plow_write_file` only takes model-typed
text".

## What to say

> There is no path for that today, and it is not a configuration problem.
> `plow_write_file` carries text only, so a binary cannot get onto the Mac from
> the agent. It is tracked. Put the file there by hand, or have the agent fetch
> it and hand you the URL.

## What the agent must not do

- It must not base64 a binary and write it through `plow_write_file`. That is a
  different operation with different approval semantics, and it is the kind of
  workaround that turns a "no" into a "yes" nobody approved.
- It must not claim the file is on the Mac when it is not. That is the exact
  failure the receipts exist to prevent.

**Verify the state of this page against the tracker before answering.** It is
marked with a date because the answer is a moving target.

See [what Latch is](/concepts/latch.md) and
[a refusal is not a bug report](/skills/a-refusal-is-not-a-bug-report.md).
