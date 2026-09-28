---
type: Organization
title: Plow Latch
description: The Mac app that gives a remote AI agent approved, sandboxed use of a real computer.
category: entities
tags: [org, product, latch]
sources:
  - resource: https://github.com/plow-pbc/latch
  - resource: https://github.com/plow-pbc/latch/blob/main/DESIGN.md
created: 2026-09-25
updated: 2026-09-28
website: https://github.com/plow-pbc/latch
---

The Mac app. A remote agent — Claude Code, OpenClaw, any MCP client — uses a
person's Mac through it: read and write files, run commands, drive a real
browser, all through an intent-based approval system.

- **License:** Apache-2.0. The product is Plow Latch; the codebase is still
  named `domo` throughout (`DOMO_HOME`, `@domo/*` scope, the update feed).
- **Language:** TypeScript (Node + Electron).
- **Does not host the relay.** The relay lives in the private `plow-pbc/plow`
  repository. Latch owns the client that dials it and the MCP server it
  forwards to.
- **A Mac dials out.** The in-repo broker was removed; there is no listener and
  no bound port, so the app is unreachable inbound.

Design notes live in its `DESIGN.md`, threat posture in its `SECURITY.md`, and
the sandbox's real limits in `docs/SANDBOX-BOUNDARY.md` — which is unusually
honest about what the approval card does **not** promise. That last one is the
file to quote; `DESIGN.md` still carries the retracted "derived from exactly
the approved capabilities" wording, and several of its chapters predate the
rebuild.

See [what Latch is](/concepts/latch.md),
[how the Mac app is put together](/concepts/latch-architecture.md),
[what the sandbox actually permits](/concepts/latch-sandbox-boundary.md),
[the approval model](/concepts/latch-approval-model.md) and
[the plugin model](/concepts/latch-plugins.md).
