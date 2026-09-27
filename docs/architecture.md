# Architecture

OpenPlow runs one OpenClaw Gateway with three explicit agent entries. This is
role isolation inside one Gateway, not a hostile multi-tenant deployment.

```mermaid
flowchart TB
  C[Customer] --> F[Frontline / main]
  F -->|read-only| W[Canonical wiki]
  F -->|case_create| S[State volume: durable cases]
  F -->|sessions_spawn investigator| I[Investigator]
  I -->|case_claim / verify / block| S
  I -. authorized MCP only .-> L[Latch on operator Mac]
  I -->|verified result| F
  F -->|case_resolve in origin session| C
  F -->|sessions_spawn curator| U[Curator]
  U -->|case_prepare_candidate| R[_raw/OP-*.md]
  R --> H[Human review, promotion, index]
```

## Native configuration

`organization/openclaw.patch.json5` defines `main`, `investigator`, and
`curator`, each with a distinct OpenClaw workspace and agent directory.
`main.subagents.allowAgents` admits only the two static internal role IDs.
Investigator and Curator cannot spawn children.

The Plow base owns portions of `openclaw.json` through includes. On first
install `bin/openplow-configure-organization` materializes the channel-wide
Frontline binding in owner configuration, copies internal role prompts into
their workspaces, and applies the native `openclaw config patch`. The installer
then restarts the Gateway. This is idempotent. The materialization is necessary
for the pinned OpenClaw version to add internal entries without appending into a
base-owned binding include.

Internal work uses `sessions_spawn`, not sibling session discovery or arbitrary
agent-to-agent messaging. The child receives the supplied case ID; Frontline
retains the customer session and resolves only there.

## Durable cases

`case-workflow` is an auto-discovered Gateway plugin. It stores JSON case
records and NDJSON transition events in `/var/lib/plow/cases`, the persistent
state volume. Atomic replace writes and an in-process sequence lock make case
IDs and transitions durable within the Gateway process.

| Transition | Authorized role | Required condition |
| --- | --- | --- |
| `NEW → KNOWLEDGE_CHECKED → ESCALATED` | Frontline | Canonical wiki status is `unresolved` |
| `ESCALATED → INVESTIGATING` | Investigator | `case_claim` |
| `INVESTIGATING → VERIFIED` | Investigator | Root cause, remediation, evidence, verification, safe summary |
| `INVESTIGATING → BLOCKED/FAILED/NEEDS_HUMAN` | Investigator | Terminal reason |
| `VERIFIED → RESOLVED` | Frontline | Gateway session equals the stored origin session |
| `RESOLVED → KNOWLEDGE_CANDIDATE` | Curator | Investigator marked lesson durable |

The plugin obtains customer identity and conversation from Gateway hook context,
overwriting model-provided values. Candidate tool output deliberately omits
customer and conversation data.

## Tool and data boundaries

| Role | Tool profile | Enforced deny surface | Explicitly retained |
| --- | --- | --- | --- |
| Frontline | `minimal` | `bundle-mcp`, shell/process, browser/node/gateway, writes, direct messages, all four session-orchestration tools | Wiki reads; static `sessions_spawn`; case create/resolve |
| Investigator | `minimal` | Local writes, shell/process, browser/node/gateway, direct messages, all four session-orchestration tools | Wiki reads; case claim/verify/block; MCP including Latch |
| Curator | `minimal` | `bundle-mcp`, reads, shell/process, browser/node/gateway, writes, messages, all four session-orchestration tools | Candidate staging tool only |

Each role runs `tools.profile: "minimal"` and grants its own tools back with
`alsoAllow`. The base deploys the whole Gateway on `profile: "messaging"`, which
is right for a general assistant and far too wide here: subtracting from it
means any tool a future OpenClaw release adds to `messaging` silently reaches
all three roles, because a `deny` array is a closed list of names someone has
to remember to extend. The `deny` lists are retained as the backstop — deny
wins over allow — and `tools.agentToAgent` is disabled, since cross-agent
session access is on by default and no role needs to address another's session
outside the case workflow.

`sessions_spawn` is denied as part of a group, not alone. OpenClaw grants
`sessions`, `sessions_spawn`, `sessions_yield` and `subagents` together as the
spawn lifecycle; denying only the spawn would still leave the Curator able to
cancel the Investigator's live run, and any role able to reset, delete or
reassign a visible session.

`tools.agentToAgent` cannot be set from here. The base owns the `tools` object
through an `$include` and the pinned OpenClaw refuses to write into it, the
same wall `materialize-main-binding.mjs` works around for bindings. Cross-agent
access is closed by the deny lists instead: every session-orchestration tool is
denied for every role, so none keeps a route to another role's session.

The plugin's `before_tool_call` hook repeats these role checks. It confines
Frontline and Curator reads to `$WIKI_PATH`, blocks their MCP access including
the MCP bundle, and prevents the Frontline tool from resolving another
conversation.

The wiki remains a second boundary: canonical `/data/wiki` and its history are
root-owned; `_raw/` is the controlled candidate inbox. Curator never gets a
generic filesystem write tool. Human promotion is outside the Gateway.

## Exposure

Nothing is published to the host. `compose.yml` declares no `ports:` and runs no
proxy in front of the agent, so the Gateway's control surface is reachable only
from inside the container, through `docker compose exec`. The base authenticates
its proxy as `operator.admin` with device auto-approval, which is why no port
is opened at all rather than opened on loopback: a published port is an
administrator's console. The wiki is the only thing brought in from outside,
through the named `openplow-wiki` volume that `scripts/seed-vault.sh` populates.

## Limit

Separate workspaces, configured agent IDs, per-agent tool denials, and plugin
checks limit customer-controlled model turns. They do **not** make this one
Gateway a security boundary against a compromised Gateway administrator,
malicious plugin, or container escape. Deploy separate hardened Gateways for
mutually hostile tenants or separate operator credentials. Latch remains the
Mac-side authorization and capability boundary; its reviewer decision is not
proof that a customer was authorized.
