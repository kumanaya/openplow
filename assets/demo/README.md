# demo

Screenshots for the video and for the Agent Index page. Filenames are the beat,
not the timestamp, so the order in this folder is the order of the story.

Nothing here exists yet — the agent has never run against a live line. That is
the next thing that has to happen, and these are the frames to grab when it does.

| File | The frame | Why it earns its place |
|---|---|---|
| `01-ticket-in.png` | the customer's question, in the chat | the thing that makes it support rather than a demo |
| `02-answered-with-receipt.png` | the reply, **with the URL visible** | the whole thesis in one screenshot |
| `03-vault.png` | the deployment's own vault, open in Obsidian | the memory is a real artefact, not a database |
| `04-validate.png` | `wiki validate` → `validated N pages` | it is a real corpus, not prose |
| `05-history.png` | `wiki history <page>` — the git log of claims, beside the vault in the same volume | **the only frame a screenshot of someone else's chatbot cannot fake** |
| `06-dossier.png` | a handoff, in the owner's thread | it knows the difference between answering and deciding |

`03` and `05` are the deployment's own knowledge, not a folder on the owner's
Mac. The vault is a named volume (`openplow-wiki`) that `WIKI_PATH` points
into, and the history is committed beside it at `$WIKI_PATH.git`, in that same
volume — so the two cannot drift apart, and both outlive the container. `05` is
the one to spend time on. `02` proves it cites. `05` proves the citation
was written down, by this agent, on a date, with a commit — and that is the
claim the whole project rests on.

## Rules

- **No credentials. No real phone numbers. No customer data.** Blur before you
  commit. A screenshot of a real vault is a screenshot of someone's life.
- Use a **throwaway vault** seeded from `seed/`. Nothing in the demo has to be
  real to be convincing, and a clean vault has no PII in it at all.
- Commit the files. The repo is public and the demo is the argument.

Naming: `NN-short-slug.png`, lowercase, hyphens. Keep the numbering even if you
skip a frame — gaps read as intentional, renumbering reads as churn.
