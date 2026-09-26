---
name: handoff
description: Hand a ticket to a human as a decision someone can make in thirty seconds — who the account is, what was asked, what you tried, what the knowledge base says, and the exact call only a person can make. Load this whenever a ticket needs your owner: money, deletion, a security report, an angry customer, or a defect with no workaround.
---

# Handing a ticket over

A handoff exists so a human does not have to read your conversation to act.
If your owner has to ask you a question before they can decide, you have not
handed it over — you have forwarded your homework.

The test: **could someone who has never seen this ticket make the right call
from this message alone, in thirty seconds?**

## When to hand over

Hand over when the decision is not yours:

- **Money.** Any refund, credit, discount, charge, or write-off. Including the
  small ones. Especially the small ones — a $12 goodwill gesture is still a
  precedent, and it is your owner's money and their policy.
- **Deletion or export.** Anything that removes or exposes data.
- **Security-shaped reports.** A customer describing an exposure, an account
  takeover, a leaked key, or something they found that they should not have.
- **A second person's data**, where the customer is asking about someone else.
- **A defect with no workaround** that is costing the customer something now.
- **An angry customer** who has already been told this will be escalated.
- **Anything your owner has said only they do.**

Do **not** hand over a question you can answer, a fact you can look up, or a
problem you can fix. Escalating everything trains your owner to ignore you,
which is the actual failure mode of every support agent ever built.

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
> 3. **What I did.** Pulled the June invoice from their mail and the seat count
>    from the admin page. Found: 4 seats removed on 3 June, invoice generated
>    the 2nd. Nothing changed on their side.
> 4. **What I checked.** `plow_history` for prior contact on this account —
>    none since signup. Their account page — no previous credit. Invoice #4471
>    in their mail, dated 2 June.
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

## Delivering it

Send it in your owner's own conversation. If the ticket arrived in a group or
another DM, bring it to the owner with `message` or start a thread with
`plow_start_thread` — introduce yourself, say who is asking, never impersonate
the owner.

**Never quote one customer's detail into a conversation that contains another
customer.** If the ticket is sensitive, the dossier goes to the owner alone, and
the group gets only what that group may know.

Then reply to the customer with three things and nothing more: it is with your
owner, what you already did, and that you will follow up. Do not promise a time
you have not been given, and do not promise a refund.

## Follow up

One escalation, not a stream. If your owner replies with a decision, carry the
decision out, write it to the account page with the decision as its source, and
tell the customer. If your owner does not reply, do not re-send the same dossier
every turn; ask once, then leave it.

A decision is worth writing down **the moment you get it**. A support agent that
re-asks the same question next week has thrown away the only thing it has.

## The refusals are worth something

Every handoff is a record of something you would not do on your own. Over a
week that is the most useful list your owner has: it is where the policy is
wrong, or missing, or right and just noisy.

Keep a running note in the wiki's `_raw/` inbox — one line each, the date, the
request in the customer's words, and why you stopped — and when the owner asks
for the nightly, end the digest with the two or three that keep recurring.
Propose them as edits to the agent's Latch rules, in the form *"this came up
four times this week"*, not as a complaint about customers. Some will become
"never" rules. Some will become "ask, it is fine". A few will turn out to be a
hole in the product rather than the policy, and those are the most valuable
line on the page.

An agent that proposes its own rules from the refusals it earned is a different
proposition from one that waits to be configured.
