# assets

This directory contains legacy illustrations and placeholders. They do not
ship in the container.

```
assets/
  banner.png               legacy illustration; former Latch workflow
  01.png–04.png            legacy storyboard stills; not current behavior
  openplow-explainer.mp4   current 80-second concept film
  demo/                    placeholder for verified live screenshots
```

Do not use `banner.png` or `02.png` in product pages: they show OpenPlow
investigating customer systems through Latch. The current support path is
wiki-first and hands unanswered cases to the owner's team. Latch via MCP is an
operator-side path for a separate internal agent.

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
