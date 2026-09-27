# assets

This directory mixes one legacy illustration with the current storyboard. They do
not ship in the container.

```
assets/
  banner.png               legacy illustration; former Latch workflow
  01.png–04.png            current storyboard, used in the README
  openplow-explainer.mp4   current 80-second concept film
  demo/                    placeholder for verified live screenshots
```

Do not use `banner.png` in product pages: it shows OpenPlow investigating
customer systems through Latch, which is the workflow this project replaced. It
is still the README's header illustration, so treat it as a legacy asset and
replace it when a current one exists.

`01.png`–`04.png` describe current behavior and are used in the README:

- **01** an isolated session per customer, no cross-conversation memory
- **02** wiki-first, internal handoff on a gap, and explicitly *not*
  investigating the customer's device or systems
- **03** a receipt on every factual answer
- **04** the Curator stages `OP-<caseId>.md` in `/data/wiki/_raw/` for human
  review; approved content becomes canonical knowledge for the next customer

Panel 04 was regenerated to match the implementation. It previously showed the
inbox as `~/Plow/wiki/_raw/` — the Latch auto-approve carve-out on the
operator's Mac, not the vault — named the candidates descriptively instead of
by case ID, and claimed reusable knowledge for "future tickets", which the
project does not support.

The top navigation bar is inconsistent across the set: `04.png` reads
`ASK / SEARCH / ANSWER / LEARN`, while `01`–`03` still read
`KNOW / INVESTIGATE / LEARN / ESCALATE`. Only the navigation needs
regenerating on those three; their content is accurate.

## Explainer video

The Remotion source composition lives in the sibling workspace at
`../../remotion/plow/openplow/`. The regenerated 80-second output is committed
here as `assets/openplow-explainer.mp4`. It illustrates the intended workflow;
it is not a recording or proof of live support, handoff delivery, or tool
isolation.

The previous GitHub-hosted video attachment may still be linked from the Agent
Index and shows the old Latch-investigates-customer-systems workflow. The
repository README now links to this versioned artifact; replace the old hosted
attachment manually before reusing its link. A checkout cannot update a
GitHub-hosted user attachment.

## Verified demos

No live transcript or screenshot is implied by the Remotion explainer. Add
screenshots under `demo/` only after exercising the live path. Use throwaway
customer and vault data; never commit credentials or real customer details.
