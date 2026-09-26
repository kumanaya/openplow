# demo

Screenshots for the video and for the Agent Index page. Filenames are the beat,
not the timestamp, so the order in this folder is the order of the story.

No live screenshots are checked in yet. Capture these only after each path has
been exercised; do not present mockups or the explainer as proof of deployment
behavior.

| File | The frame | Evidence required |
|---|---|---|
| `01-ticket-in.png` | a customer's question, in the support conversation | redact identities and customer data |
| `02-answered-with-receipt.png` | a wiki-backed answer with its source URL | the answer matches the cited canonical page |
| `03-vault.png` | the deployment's wiki, open in a viewer | show the canonical source without exposing secrets |
| `04-validate.png` | wiki validation output | capture the command and observed result |
| `05-history.png` | history for a verified wiki change | show the commit and provenance of the change |
| `06-dossier.png` | a no-wiki-match handoff in the owner's conversation | show the investigation dossier, not an assumed external ticket |
| `07-internal-agent.png` | the operator's separate OpenClaw+Latch path, if safely configured | prove that privileged tools cannot enter customer sessions before capturing |

The first six frames describe the customer-support workflow and its verified
artifacts. The seventh is a distinct operator-side workflow; omit it until the
deployment enforces and tests the security boundary documented in `../../SECURITY.md`.

## Rules

- **No credentials. No real phone numbers. No customer data.** Blur before you
  commit. A screenshot of a real vault is a screenshot of someone's life.
  Use a **throwaway vault** seeded from `../../seed/`. Nothing in the demo has to be
  real to be convincing, and a clean vault has no PII in it at all.
- Commit the files. The repo is public and the demo is the argument.

Naming: `NN-short-slug.png`, lowercase, hyphens. Numbering follows the beats;
gaps are intentional.

