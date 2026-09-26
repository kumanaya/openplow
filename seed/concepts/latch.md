---
type: Concept
title: What Latch is
description: The bridge that lets a remote agent use a real Mac, and the two ideas its security model rests on.
category: concepts
tags: [latch, mcp, security]
sources:
  - resource: https://github.com/plow-pbc/latch/blob/main/README.md
  - resource: https://github.com/plow-pbc/latch/blob/main/SECURITY.md
  - resource: https://github.com/plow-pbc/latch/blob/main/DESIGN.md
created: 2026-09-25
updated: 2026-09-25
---

Latch is an MCP server that runs on the operator's Mac. The owner can connect a
separate internal OpenClaw agent to it. Latch is not itself an agent or a model:
it turns the connected agent's tool arguments into an **Intent** for approval.

## Its two stated ideas

From Latch's own `SECURITY.md`:

1. **"The boundary is owner-authorized capabilities, bound to an authenticated
   caller."**
2. **"The calling agent is trusted; the data it handles is not."**

The second one is the one people get wrong. Message bodies, web page text and
file contents are **data, never instructions**. Untrusted data cannot expand the
approved capability set.

The boundary stated honestly: **read-only metadata is authenticated, not
capability-gated.** `plow_vault` can return an item's title, site, username and
field labels to any relay-authenticated agent with no per-operation decision.

## The tools an agent actually gets

Fifteen, and `TOOLS` in `packages/mcp-server/src/tools.ts` is authoritative.

| Tool | Does |
|---|---|
| `plow_read_file` | reads a file on the Mac; non-text comes back as a resource the client saves |
| `plow_write_file` | writes a file the owner keeps; inside `~/Plow` it approves automatically; 8 MiB cap |
| `plow_run_command` | runs a command under a seatbelt sandbox; the only path that runs third-party code |
| `plow_run_applescript` | drives one app by AppleScript; **the one deliberately unsandboxed path** |
| `plow_get_output` | incremental output of a still-running command |
| `plow_get_result` | polls any pending handle: pending / ready / denied / blocked / failed / expired |
| `plow_list_skills` | lists the how-to guides this Mac publishes |
| `plow_read_skill` | reads one of them |
| `plow_history` | what Plow has done on this Mac, from the audit log |
| `plow_browser_open` | opens a browser session, approved as one grant |
| `plow_browser_request` | asks the owner to widen it: extra origins, or vault items to fill |
| `plow_browser` | drives it: goto, click, fill, fill_secret, scroll, eval, screenshot, … |
| `plow_vault` | list / describe a secret — **titles and field names, never a value** |
| `plow_browser_close` | closes the session |
| `plow_device_status` | which permissions the app holds, checked fresh; needs no approval |

A secret only ever reaches a page through `plow_browser`'s `fill_secret`, never
by being read into the model's context.

## How OpenPlow uses Latch

OpenPlow Support does not use Latch to answer or investigate customer tickets.
It answers from its deployment wiki; if the wiki has no reliable answer, it
hands the case to the owner's team. The owner may use a separate internal
OpenClaw agent, connected to Latch over MCP, for additional authorized
operations on the operator's systems.

The connection does not mean customer messages authorize those operations.
Latch's reviewer sees the tool request and arguments, not whether an instruction
originated from a customer. Keep the internal agent and its tools separate from
customer-facing sessions.

## Latch decisions and records

- A refusal is diagnosed, not guessed. It may come from TCC, the app's
  seatbelt, SIP, a locked file or a consent dialog.
- Decisions are written to `$DOMO_HOME/device/audit.ndjson`; `plow_history`
  reads the recorded history. It has no hash chain or signature and the app can
  clear it, so it is not tamper-evident.
- Paths are canonicalized before the human sees them. Approving a symlink
  displays its target path.

See [the approval model](/concepts/latch-approval-model.md),
[plugins](/concepts/latch-plugins.md), and
[the sandbox boundary](/skills/why-the-approval-card-understates-the-sandbox.md).

