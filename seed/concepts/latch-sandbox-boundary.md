---
type: Concept
title: What the Latch sandbox actually permits
description: The seatbelt profile Latch generates per command, the grants that exist regardless of what was declared, and the two paths that run unsandboxed on purpose.
category: concepts
tags: [latch, sandbox, security, seatbelt]
sources:
  - resource: https://github.com/plow-pbc/latch/blob/main/docs/SANDBOX-BOUNDARY.md
  - resource: https://github.com/plow-pbc/latch/blob/main/DESIGN.md
  - resource: https://github.com/plow-pbc/latch/blob/main/packages/device-core/src/executor.ts
created: 2026-09-28
updated: 2026-09-28
---

Only one tool is sandboxed. `plow_run_command` gets a per-invocation macOS
seatbelt profile generated from the approved capabilities. Everything else runs
somewhere else, and knowing *where* is the difference between an honest answer
and a dangerous one.

## What the profile grants no matter what was declared

**A read of the whole home directory, on every invocation, before any declared
path is considered:**

```
(allow file-read* (subpath <home>))
```

The command runs with the **real** `$HOME` and a `PATH` that includes the user's
own bin directories, so tools installed under the home resolve. The declared
read paths are appended *after* this. Latch's own words: they "can only ever
widen an already-broad grant; they never narrow it."

So `read_paths` is not a bound on reads. It is a declaration shown to the human,
recorded in the audit log, and used to widen the profile. Latch verified this
against the real executor: a command that declared **no** read paths ran
`wc -c < ~/.zshrc` and got 838 bytes back.

**Five housekeeping directories are writable regardless of `write_paths`:**

`~/Library/Caches`, `~/.cache`, `~/.config`, `~/.local/state`, `~/.npm`

**One exception.** A *reapable* run — one that declared no write paths, no
network and no apple events, and so may be killed for going silent — gets
**none** of the five. A run that can be shot mid-write must have nowhere
persistent to write; only its scratch, which the reaper deletes with it, stays
writable. Declaring `apple_events` lifts reapability, because a sent message is
a side effect a 15-minute kill must not truncate.

**`ipc-sysv-sem`,** but only when a staged plugin's own hash-pinned binary is
dispatched. An ordinary approved command never gets it. SBPL cannot filter it,
so for that one binary the grant is the host's whole SysV semaphore namespace.

## What the profile forbids

Writes stay confined to the approved write paths plus the scratch dir plus the
housekeeping set above. **Network is allowed only if declared and approved** —
with exactly one documented exception: a *provider command* driven by a bundled
plugin reaches its service by definition, so it gets the network capability
even when the field is omitted **or explicitly false**. That is not hidden: it
is in the capability set the human approves, and a call approved without it is a
call the sandbox then denies.

Latch is direct about the consequence: broad read plus network is "a
mitigation, not the boundary." A command with network approved for a legitimate
reason has both halves.

## The three things that are not sandboxed

1. **File tools.** `plow_read_file` and `plow_write_file` run in-process in the
   device app — trusted code, bounds-checked against the approved paths,
   canonicalized and symlink-safe. This is why `Write:` on a `write_file` call
   really is enforced.
2. **AppleScript.** Deliberately outside the sandbox: `osascript` is Apple's own
   binary and no profile would admit it. Its capability is the app (resolved to
   a bundle id, never by asking macOS, which would put a chooser on screen) plus
   the whole script. It can never be a stored rule — decided fresh every time.
3. **The browser.** A seatbelt cannot cage a browser, because network is
   all-or-nothing. Enforcement is TypeScript between the agent and Playwright:
   targets checked before navigation, the URL re-checked after every action,
   popups swept and audited, and the session locks on an out-of-scope page.

## Why the approval card understates all of this

The card's label still reads **"This will be allowed to (enforced)"**. Per
capability:

| Card line | Enforced? |
|---|---|
| `Read: …` | **no** — the profile permits the whole home directory |
| `Write: …` on a `write_file` | yes |
| `Write: …` on a `run_command` | **no** — plus the five housekeeping dirs |
| `Run: …` | yes — the argv shown is the argv executed |
| `Network: denied` | yes |

And the understatement reaches the no-human path: the adversarial reviewer is
told the same untrue description, and in that mode its "allow" is acted on
directly with **no dialog and no human seeing it**.

**Do not quote `DESIGN.md`'s phrasing.** It says "derived from exactly the
approved capabilities" — the phrase that was retracted. Latch fixed its own
tool descriptions, test and README; it deliberately left the card's label and
the reviewer prompts alone. `SANDBOX-BOUNDARY.md` is the current statement.

## What a refusal actually means

An approval is not the last gate. `hostGate/` diagnoses a refused operation by
probing, with the discriminator being the app itself opening the path in a
child process outside any profile: app succeeds and the profile would not, so
it is outside the approved bound; the app also refused, so it is a macOS gate
and TCC still has to say which one. The diagnosis **does not narrow** what a
command can read — it only says, after a refusal, whose refusal it was.

Standing caveats from Latch's own design notes: `sandbox-exec` is deprecated but
still load-bearing, `mach-lookup` is broad in the v1 profile, TCC still gates
protected folders, and the upgrade path for hostile workloads is a
Virtualization.framework VM.

See [what Latch is](/concepts/latch.md),
[the approval model](/concepts/latch-approval-model.md) and
[why the card understates the sandbox](/skills/why-the-approval-card-understates-the-sandbox.md).
