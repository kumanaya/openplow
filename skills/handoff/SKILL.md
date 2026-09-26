---
name: handoff
description: Escalate an unanswered or sensitive customer case to the owner's team with a decision-ready dossier. Load this when the wiki has no reliable answer, or a human must decide.
---

# Handing a ticket over

A handoff exists so a human does not have to read your conversation to act.
If your owner has to ask you a question before they can decide, you have not
handed it over — you have forwarded your homework.

The test: **could someone who has never seen this ticket make the right call
from this message alone, in thirty seconds?**

Hand over when the wiki cannot support a reliable answer or a human must
investigate or decide:

- **No answer in the wiki.** State what you checked and what is missing; do not
  fill the gap from memory or use the operator's Latch-connected agent.
- **Money.** Any refund, credit, discount, charge, or write-off. Including the
  small ones.
- **Deletion or export.** Anything that removes or exposes data.
- **Security-shaped reports.** A customer describing an exposure, an account
  takeover, a leaked key, or something they found that they should not have.
- **A second person's data**, where the customer is asking about someone else.
- **A defect or incident** without a reliable documented answer or workaround.
- **An angry customer**, or anyone who explicitly asks for a person.
- **Anything the owner has said only they do.**

Do not hand over a question the canonical wiki answers. OpenPlow's customer
support path is wiki-first; the operator's separate Latch-connected agent is
not a fallback for a missing support article.

## The format

Seven fields, in this order, under a headline that states the decision:

> **Refund decision — Halvorsen Robotics, €340 overage, invoice #4471**
>
> 1. **Who.** Halvorsen Robotics — plan Scale since March, 12 seats, account
>    page at `entities/orgs/halvorsen-robotics.md`. Contact: Dana H., billing
>    contact on the account.
> 2. **What they asked.** "We were charged for 12 seats in June but only had 8
>    on the 3rd. Can we get the difference back?" — their words, one short
>    quote, not a paraphrase.
> 3. **What I did.** Searched the canonical account page and billing runbook in
>    the deployment wiki. Neither documents a mid-cycle seat overage rule.
> 4. **What I checked.** The account page records no prior credit; the billing
>    runbook does not say how this overage is handled.
> 5. **What our records say.** The account page records a commitment from
>    March: "annual prepay, unused seats credited at renewal, not monthly."
>    That commitment does **not** obviously cover a mid-cycle overage.
> 6. **What I did not do, and why.** I have not promised a refund, moved the
>    invoice, or told them it would be approved. That is your call, and the
>    March commitment is the reason I did not guess at it.
> 7. **The decision.** Credit €340 now, as a one-off, against the March
>    commitment; or hold and reply that mid-cycle overages are not credited,
>    which makes the March promise look wrong on the page. Their invoice is due
>    in 6 days.
>
> **Urgency.** If nobody decides by <date>, the invoice goes to collections and
> this becomes a churn conversation rather than a billing one.

Field 6 is not optional and it is the one people cut. A handoff that hides what
you did not do is worse than no handoff, because your owner cannot tell the
difference between "nothing was promised" and "you did not mention it".

## Delivering the handoff

Send the dossier in the owner's own conversation. If the ticket arrived in a
group or another DM, bring it to the owner with `message` or start a thread with
`plow_start_thread` — introduce yourself, say who is asking, never impersonate
the owner.

This is the internal handoff supported by this deployment. It is not a record in
an external ticket system unless a connected ticketing tool confirms creation.

**Never quote one customer's detail into a conversation that contains another
customer.** If the ticket is sensitive, the dossier goes to the owner alone,
and the group gets only what that group may know.

Then reply to the customer with three things and nothing more: the team needs
to investigate, what you checked, and a follow-up time only if the owner gave
you one. Do not promise an outcome or a time.

## Follow up

One escalation, not a stream. Relay only a decision or action result the owner
has confirmed. OpenPlow does not execute refunds, delete or change accounts, or
perform operator-side actions. The owner and team carry those out through their
authorized workflow; Latch/MCP belongs to their separate internal agent, never
to the customer-support session. Do not tell the customer an action completed
unless the responsible tool or owner confirmed it.

If the owner does not reply, do not re-send the same dossier every turn; ask
once, then leave it. After the team confirms a durable result, follow the
support-desk and knowledge-base skills for a candidate in `_raw/`; a human
reviews and promotes it.

## Review handoffs after the team investigates

A handoff records an open question, not a confirmed policy. Keep the dossier in
the owner's conversation while the team investigates. Do not create a wiki
candidate from the unresolved report or propose Latch policy changes from
customer-support events.

After the team confirms a cause, workaround or decision, it can return a
verified outcome to OpenPlow. The support-desk and knowledge-base skills govern
whether that outcome merits a candidate; canonical promotion remains a human
step. The internal Latch agent's policies are maintained separately by its
operator.
