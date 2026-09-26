# Security model

OpenPlow limits customer-controlled model turns with native per-agent OpenClaw
tool policy, a Gateway plugin hook, state-machine authorization, and filesystem
ownership. It does **not** claim that one shared Gateway is hostile
multi-tenancy.

## Trust boundary

Customers are channel peers, not Gateway operators. The Plow base scopes
ordinary customer sessions by peer, but OpenPlow does not rely on session
visibility alone:

- Frontline is the sole customer-facing role.
- Its configured tool deny list removes MCP (`bundle-mcp`), shell/process,
  browser/node/gateway, filesystem writes, cross-conversation send, and session
  listing/history/search/send.
- `case-workflow` repeats those checks in `before_tool_call`, using the
  authoritative Gateway `agentId`, session key, and requester. It also injects
  customer and conversation provenance instead of trusting model parameters.
- Frontline's static child allowlist contains only `investigator` and `curator`.
  Internal roles cannot spawn further agents or message the customer.

This means customer text cannot grant Frontline an alternate tool route to
Latch, another conversation, or canonical knowledge. It does not stop a
Gateway administrator, malicious installed plugin, or container-level
compromise from altering the policy.

## Role isolation

| Boundary | Frontline | Investigator | Curator |
| --- | --- | --- | --- |
| Latch/MCP | Denied by `bundle-mcp` and plugin | Retained for authorized work | Denied by `bundle-mcp` and plugin |
| Customer response | Only role allowed | Denied | Denied |
| Sessions | Cannot discover/read/send elsewhere | Cannot discover/read/send/spawn | Cannot discover/read/send/spawn |
| Generic write/shell/browser | Denied | Denied | Denied |
| Wiki | Read canonical only | Read canonical only | No direct files; candidate tool only |
| Case transition | Create/resolve | Claim/verify/block | Prepare candidate |

The per-agent configuration is executable and validated by
`scripts/verify-organization.sh`. The plugin is a second enforcement layer, not
a substitute for native configuration.

## Durable case controls

Case records live under `/var/lib/plow/cases` on the state volume. They contain
the customer and origin conversation needed to keep an investigation tied to
its requester. A case may resolve only when Frontline's current Gateway session
equals the stored origin. `BLOCKED`, `FAILED`, and `NEEDS_HUMAN` are terminal;
they cannot resolve or produce a candidate.

The Curator receives the case ID and candidate material supplied by its prompt.
The `case_prepare_candidate` tool returns only candidate metadata—not stored
customer or conversation fields—and writes only `_raw/OP-*.md`.

## Wiki boundary

Canonical `/data/wiki` and its history are root-owned. The Gateway runs as an
unprivileged user. The candidate inbox is a separate `_raw/` directory; human
maintenance validates, promotes, indexes, and snapshots canonical knowledge.

`scripts/verify-wiki.sh` exercises persistence and canonical write denial. This
is a kernel filesystem boundary. Candidate quality and secret detection are
additional application checks, not a substitute for avoiding sensitive input.

## Latch boundary

Latch is an Investigator-only MCP surface in this deployment. It is a Mac-side
capability and approval system; it does not guard the deployment wiki, cases, or
Docker Gateway.

- Customer text, attachments, and quoted instructions are data, never
  authorization.
- The Investigator prompt requires an operator-authorized scope before use.
- A Latch denial is final: the tool records `BLOCKED`; it must not retry through
  a different path.
- Latch's reviewer/Gatekeeper decision is not identity proof and may be
  permissive. Constrain it with [LATCH-RULES.md](LATCH-RULES.md).

The base's MCP bridge is shared at Gateway process level. `bundle-mcp` removal
and the plugin hide that bridge from Frontline and Curator; neither has a raw
shell alternative. A deployment that needs isolation against a compromised
Gateway must use separate hardened Gateways and separate credentials.

## Known limits

1. **Not hostile multi-tenancy.** OpenClaw itself treats one Gateway as one
   trusted operator boundary. Run separate Gateways for mutually untrusted
   tenants or administrative domains.
2. **Policy code is trusted.** A malicious image, extension, control-plane
   operator, or container escape can change configuration, tools, or case
   records. Protect image supply chain, Docker access, and the loopback
   dashboard as administrative access.
3. **No live external proof.** Offline tests prove configuration and local
   behavior, not a live Plow channel, Latch link, or correct human approval.
4. **Candidates need review.** The candidate secret heuristic rejects obvious
   token-like input but is not a data-loss-prevention system. Human review is
   mandatory before promotion.

## Reporting a vulnerability

Open an issue for repository defects. Do not publish a live customer's case,
credentials, or vault content. Contact the deployment owner privately through
their established support channel for a live exposure.
