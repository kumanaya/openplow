# Product workflow

OpenPlow is the customer-facing support agent. It answers from the startup's
canonical wiki; when the wiki does not support an answer, it hands the case to
the owner's team for investigation. It does not use Latch to inspect a
customer's machine.

## The roles and the two paths

- **Customer** — asks a question on the configured support line.
- **OpenPlow Support** — reads canonical wiki pages, replies with a source, or
  sends an internal handoff dossier when it cannot answer.
- **Owner and team** — review handoffs, make decisions, and curate canonical
  knowledge.
- **Operator's internal OpenClaw agent** — a separate agent the owner may
  connect to Latch over MCP for additional authorized actions on the
  operator's own systems. It is not the customer-facing OpenPlow session.
- **Product knowledge** — the deployment-owned vault of runbooks, accounts,
  known issues, incidents and decisions.

The support line and the internal agent are separate trust paths. A customer's
message is not permission for the operator's tools. A deployment must keep
Latch-capable internal tools unavailable to customer sessions; see
[SECURITY.md](../SECURITY.md) for the current configuration gap.

## A customer ticket

1. A customer asks a question or reports a problem.
2. OpenPlow checks the canonical wiki.
3. If a page supports the answer, OpenPlow replies with that page as its
   receipt.
4. If the wiki has no reliable answer, OpenPlow prepares a dossier and hands
   the case to the owner's team. The customer is told that the team needs to
   investigate; no unsupported answer or resolution-time promise is made.
5. After the team verifies an outcome, it can be shared with the customer and
   recorded as a candidate in `_raw/`. A person reviews a candidate before it
   becomes canonical knowledge.

The current handoff is a message to the owner's conversation, not an
integration that creates a record in a third-party ticketing system.

## The operator's internal work

Separately, the owner may connect an internal OpenClaw agent to Latch through
MCP. That agent can request additional operations on the operator's systems,
subject to the capabilities and approval behavior configured in Latch. This
path supports the people operating the startup; it is not a customer
investigation path, and customer text does not authorize its use.

The repository does not yet configure or prove an isolated internal agent
alongside the customer-facing deployment. Do not treat a prompt instruction
alone as enforcement.

## The learning loop

```text
Customer ─► OpenPlow ─► canonical wiki supports answer ─► cited reply
                 │
                 └── wiki has no answer ─► owner-team handoff
                                                │
                                  internal agent via MCP/Latch, if authorized
                                                │
                                    verified outcome / candidate in _raw/
                                                │
                                        human review
                                                │
                                      canonical knowledge
```

Canonical pages and the history are root-owned; the support agent runs
unprivileged and writes candidates only to `_raw/`. The filesystem, not a model
instruction, prevents it from promoting its own candidate. See
[SECURITY.md](../SECURITY.md) and [architecture.md](architecture.md).

## Multiple participants

Customers use the support line; the owner and team handle internal handoffs
through their operator workflow. OpenClaw multiplayer features are not
themselves a security boundary. See [SECURITY.md](../SECURITY.md) for what the
current deployment does and does not isolate.
