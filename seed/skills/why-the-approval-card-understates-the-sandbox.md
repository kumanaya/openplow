---
type: Runbook
title: Why the approval card understates the sandbox
description: The card says what is enforced, but three lines of it are not the real bound — and a customer who finds out later stops trusting the card.
category: skills
tags: [runbook, sandbox, security, honesty]
sources:
  - resource: https://github.com/plow-pbc/latch/blob/main/docs/SANDBOX-BOUNDARY.md
  - resource: https://github.com/plow-pbc/latch/blob/main/DESIGN.md
created: 2026-09-25
updated: 2026-09-25
applies-to: Plow Latch
---

## The short version

The approval card's label above the capability list reads **"This will be
allowed to (enforced)"**. That is accurate for `Run:` and for `Network: denied`.
It is **not** accurate for two other lines, and Latch's own
`docs/SANDBOX-BOUNDARY.md` records this.

## What the card does not promise

- **A `Read:` line is not the bound.** The sandbox profile permits reading the
  whole `$HOME` regardless of which read paths were approved.
- **A `Write:` line on a `run_command` is not the bound either.** Five
  housekeeping directories under the home directory are writable whatever
  `write_paths` says: `~/Library/Caches`, `~/.cache`, `~/.config`,
  `~/.local/state`, `~/.npm`.

That second one is the one to be careful about. The approved write paths bound
where a command's *meaningful* writes land; they do not describe every byte the
process can touch.

This page is the short version a support agent needs before answering. The
full grant-by-grant account — including the housekeeping directories, the reapable
run exception, `ipc-sysv-sem`, and the three paths that run unsandboxed by
design — is [what the sandbox actually permits](/concepts/latch-sandbox-boundary.md).

## Why this page exists

Because a support agent should not be the thing that discovers this for a
customer. If a customer asks "does the card promise my SSH key is unread?",
the honest answer is: the card is the enforceable bound, and the read profile
is broader than the read line. The two together are the real boundary, and
`SECURITY.md` says which parts are a guarantee and which are defense-in-depth.

## What to say

> The card shows the capability that was approved, and that is what gets
> enforced for commands and network. The read profile is deliberately broader
> than the read line — an agent that could not read a path to find out it was
> blocked would be a worse product. If you want the real answer for your own
> setup, the sandbox's limits are written down in the app's own
> `docs/SANDBOX-BOUNDARY.md` rather than only implied by a dialog.

## Standing caveats, from Latch's own design notes

- `sandbox-exec` is deprecated but still load-bearing.
- `mach-lookup` is broad in the v1 profile.
- TCC still gates protected folders.
- The upgrade path for hostile workloads is a Virtualization.framework VM.

See [what Latch is](/concepts/latch.md) and
[the approval model](/concepts/latch-approval-model.md).
