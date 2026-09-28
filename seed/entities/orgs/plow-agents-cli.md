---
type: Organization
title: plow-agents
description: The command-line tool that mints a Plow line, runs an agent locally, pushes its image and manages what the index can install.
category: entities
tags: [org, tool, deploy, plow]
sources:
  - resource: https://github.com/plow-pbc/plow-agents
  - resource: https://github.com/plow-pbc/plow-agents/blob/main/README.md
created: 2026-09-28
updated: 2026-09-28
website: https://github.com/plow-pbc/plow-agents
---

Python 3.11+, run with `python3` — a repository, not a package. Apache-2.0.

Build an agent image, run it on Plow, and text it from your phone. Prerequisite
for a local run: Docker Compose 2.24+ and an agent repo with a `Dockerfile` and a
`compose.yml`.

## The commands a support question actually turns on

| Command | Does |
|---|---|
| `login` | log in by text; you text the activation phrase to the printed number |
| `lines` | the phone lines an agent can be deployed on, with ids, numbers and availability |
| `profile --show` | the account `uid` — the thing you hand to a Plow admin |
| `mint LINE` | write a credential for a self-hosted agent |
| `rotate` / `revoke` | replace the credential / retire the agent |
| `image build` / `image push` | build for `linux/amd64`; push and print the digest |
| `image set SLUG` | claim or edit index metadata. **Never creates a Plow row** |
| `image promote` | admit an image as an admin, or update a pin, and mirror to the index |
| `image show SLUG` | public view of the Plow pin and the index listing; **needs no token** |
| `deploy --local --line LINE` | mint a credential and start Compose locally |
| `agents` | line, target and status — run it until the status is `running` |

`--api-base`, `--index-base` and `--token-file` go **before** the command.
`--index-base` defaults to `PLOW_INDEX_BASE`, otherwise production.

## Two behaviours worth knowing before you debug them

**`lines` never guesses.** A line held by another account shows `in use`, and an
older API that does not report availability shows `unknown` — not "free". An
agent claiming a line it does not own is a support ticket, so the tool refuses
the ambiguity.

**`image show` recognises a missing listing only from a specific 404.** The
Index has to answer `{"ok": false, "error": "no such agent"}`; an HTML or
malformed 404 fails loudly with the URL and status, so a misconfigured
`--index-base` is never mistaken for an absent listing.

Writing to the index goes through the
[reporting client](/entities/orgs/plow-pbc-agent-index-client.md); the install
path is in
[how to publish your agent](/skills/how-to-publish-your-agent-on-the-agent-index.md).
