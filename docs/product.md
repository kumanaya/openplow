# Product workflow

OpenPlow is a customer-support agent for product teams. It answers with
receipts, investigates approved sources when the knowledge base runs out, and
turns solved tickets into reviewable organisational knowledge.

## The three roles

- **Owner** — deploys the agent, owns the Mac and Latch, sets policy, and takes
  escalations that require judgement.
- **Customer** — uses the configured support line. They receive an answer in
  their conversation and never see anything another customer wrote.
- **Product knowledge** — a vault on a volume that belongs to the deployment:
  runbooks, account pages, known issues, incidents and decisions. It does not
  need the owner's laptop to be awake, and it is not on the laptop.

## A day in the life

A startup can put OpenPlow on its support line before it has a support team.
The agent answers how-to questions from the knowledge base, checks permitted
sources when the answer is not there, and leaves a candidate when a solved case
teaches the organisation something durable. The owner handles money, deletion,
security reports and other decisions through a concise handoff. Reviewed
knowledge makes the next ticket cheaper to answer.

The repository's `seed/` corpus is the Plow ecosystem worked example. It makes
the agent useful out of the box and is the default path for the Agent Index
entry. A company supporting another product can import its own vault with
`./scripts/seed-vault.sh --from ~/your/vault`; the support workflow is not tied
to Plow's product.

## The learning loop

```text
Customer A ─► scoped session ─► case is solved
                                  │
                                  ▼
                         candidate in _raw/
                                  │
                            owner review
                                  │
                                  ▼
                     canonical company knowledge
                                  │
                                  ▼
Customer B ─► another scoped session ─► benefits from it
```

The customer session is not the organisation's memory. A ticket can produce a
candidate in the vault's `_raw/` inbox; promoting it into a canonical page is a
separate owner decision, taken by running the maintenance command as root.

That boundary is **platform-enforced, not a convention**. The vault's canonical
pages are root-owned and the agent runs unprivileged, so a write attempt gets
`Permission denied` from the kernel. This is the one guarantee here that does
not depend on the model cooperating, and it is why the agent can be trusted
with a vault that every customer reads. See [SECURITY.md](../SECURITY.md) and
[architecture.md](architecture.md).

## Multiple participants

Customers use the configured support line, while the owner can join an
escalation and make the decision. This does not mean that OpenClaw's shared
Gateway operator mode is enabled or that it provides the isolation boundary.
See [SECURITY.md](../SECURITY.md) for the actual trust model.
