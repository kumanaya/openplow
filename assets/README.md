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
is still linked from the README as a legacy illustration, under a caption that
says so.

`01.png`–`04.png` describe current behavior and are used in the README:

- **01** an isolated session per customer, no cross-conversation memory
- **02** wiki-first, internal handoff on a gap, and explicitly *not*
  investigating the customer's device or systems
- **03** a receipt on every factual answer
- **04** a candidate staged in the vault's `_raw/` inbox for human review

One inaccuracy remains in `04.png`: it labels the inbox `~/Plow/wiki/_raw/`. The
deployment path is `$WIKI_PATH/_raw` — `/data/wiki/_raw`, a Docker volume.
`~/Plow` is the Latch auto-approve carve-out on the operator's Mac and is
unrelated. The panel needs regenerating; the README notes the correction.

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
