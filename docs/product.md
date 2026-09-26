# Product workflow

OpenPlow is a three-role support organization. Only Frontline is customer
facing. The other roles are native static OpenClaw agents spawned for a case;
they are not customer-visible chats or a free-form human handoff.

## Roles

| Role | Receives | Produces | Cannot do |
| --- | --- | --- | --- |
| **Frontline** | Customer message and canonical wiki | Cited answer, durable case, customer-safe verified reply | Use Latch/MCP, inspect other sessions, write wiki, send elsewhere |
| **Investigator** | Case ID and minimum diagnostic context | Claim, verified evidence or terminal blocked/failed/human-needed outcome | Talk to customer, write wiki, spawn an agent |
| **Curator** | Resolved durable-case ID | Sanitized `_raw/OP-*.md` candidate | Use Latch/MCP, see customer context from tool output, write/promote canonical pages |
| **Human** | `_raw` candidate and canonical vault | Reviewed promotion and wiki maintenance | N/A |

## Customer journey

1. A customer asks a question or reports a problem.
2. Frontline searches the canonical wiki.
3. A supported answer is replied to with its source. The workflow stops.
4. An unsupported, sensitive, or authority-bound request creates an
   `ESCALATED` case with the problem, wiki findings, and desired outcome.
5. Frontline spawns the static Investigator. The customer receives a brief
   acknowledgement, not a promise or an invented external ticket number.
6. Investigator claims the case, reads relevant knowledge, and uses Latch only
   when an operator-authorized Mac-side workflow is necessary.
7. Verified evidence transitions the case to `VERIFIED`. A Latch denial or a
   required human decision is terminal and does not become a customer result.
8. Frontline resolves only the verified case in the original Gateway session,
   then relays its stored customer-safe summary.
9. If the lesson is durable, Frontline spawns Curator. Curator stages a
   generalized candidate. A human review is required before the next customer
   can treat it as canonical knowledge.

## Lifecycle

```text
NEW → KNOWLEDGE_CHECKED → ESCALATED → INVESTIGATING → VERIFIED → RESOLVED
                                                               ↓
                                                  KNOWLEDGE_CANDIDATE

INVESTIGATING → BLOCKED | FAILED | NEEDS_HUMAN
```

No path from a terminal state reaches `RESOLVED` or
`KNOWLEDGE_CANDIDATE`. A case is bound to its original Gateway conversation;
a verified result cannot be used to reply to another customer.

## Latch use

Latch is not a customer feature and is not a wiki fallback. Frontline and
Curator have both per-agent `bundle-mcp` denies and plugin enforcement.
Investigator may see the deployment's MCP bridge, but customer text alone is
not authorization. The operator's Gatekeeper policy must constrain what the
Latch reviewer permits; see [LATCH-RULES.md](../LATCH-RULES.md).

## What this workflow does not claim

- It does not create a third-party ticket.
- It does not perform refunds, deletion, account changes, or other
  authority-bound actions merely because a customer asks.
- It does not make one Gateway safe for mutually hostile tenants.
- It does not prove a live Plow or Latch interaction from its offline tests.
