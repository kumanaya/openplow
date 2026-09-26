# assets

Images and video for the README and the Agent Index page. Nothing here ships in
the image — this folder is documentation, not runtime.

```
assets/
  banner.png        the hero at the top of README.md
  (explainer video is hosted, not stored here - see below)
  01.png            "a customer asks"          - How it works, beat 1
  02.png            "it investigates"          - How it works, beat 2
  03.png            "it answers with evidence" - How it works, beat 3
  04.png            "it learns for next time"  - How it works, beat 4
  demo/             real screenshots, for the Agent Index page
```

`01`–`04` are the four **How it works** frames, rendered vertically in the
README, one per beat. They are illustrations of the designed behaviour, not
transcripts of a real run — the agent has never run against a live line yet,
and the README says so. `assets/demo/` is where *real* screenshots go, once
there are any.

## The explainer video

Not in this folder. The 1:30 explainer is a **GitHub user attachment**, linked
from the README hero, so a 9.5 MB file never enters the repository:

```
https://github.com/user-attachments/assets/15e8e1fe-53bc-450d-b2e5-bb1024727d58
```

To replace it, open any issue, drag the new `.mp4` into the editor, wait for the
upload to finish, and copy the URL it produces. It is served from S3 with
`content-type: video/mp4` behind a 302, so it stays playable and does not
outlive the repo.

**The README links it; it does not embed it.** `<video>` is stripped from
READMEs by GitHub's sanitizer and `![](file.mp4)` renders as nothing, so the
hero is wrapped in `<a href="…">` and a `▶ Watch the explainer` line sits beside
the tagline. If that line ever stops looking like a link, it is still one.

**It is an explainer, not a screen recording.** The agent has not run against a
live line, and the README says so. Do not let the two imply each other.

## `banner.png`

The real one — 1774 × 887, hand-drawn, with the Know / Act / Learn cards.

| | |
|---|---|
| Size | Any width works: GitHub scales it to the content column and the README sets `width="100%"`. 1774 is comfortable; you do not need to match it |
| Format | `.png` for a drawing like this one, `.svg` if it is a diagram, `.webp` if you want the page lighter |
| Content | the product doing something |

**Still to change: the Act card.** It reads *"Investigate and fix issues"*, and
the product **does not fix issues** — no refunds, no plan changes, no deletes,
no sending on anyone's behalf, and the starter policy says `never`. The README
now avoids the word entirely: its four behaviours are **KNOW, INVESTIGATE,
LEARN, ESCALATE**, and the `What it does today` table lists those actions under
*intentionally forbidden*. So the prose is consistent and **the banner is the
last place the contradiction survives.**

It matters because the banner is read first and the table is read later, so
the overclaim lands in the worst order. The frames in this folder already use
the honest framing — `02.png` says "It investigates", and it names the
capability as inspection, not repair.

Something true and just as strong: **"Investigate through Latch, act with
approval"** — the agent does act, every time; what it will not do is anything
irreversible without a human.

## `demo/`

Screenshots for the video and for the Agent Index page. Name them for the beat
they show, not for when you took them, so the order in the file tells you the
order of the story:

```
demo/01-ticket-in.png          the customer's question
demo/02-answered-with-receipt.png   the reply, with the URL visible
demo/03-vault.png              the deployment's own vault, open in Obsidian
demo/04-validate.png           wiki validate -> validated N pages
demo/05-history.png            wiki history <page> — the git log of claims,
                               beside the vault in the same volume
demo/06-dossier.png            a handoff, in the owner's thread
```

`03` and `05` are the deployment's own knowledge, not a folder on anybody's
laptop: the vault is a named volume (`openplow-wiki`) at `WIKI_PATH`, and the
history sits beside it at `$WIKI_PATH.git` in that same volume. A screenshot of
them is a screenshot of this deployment, and the vault survives a rebuild
because it was never in the container.

`01`, `02`, `05` and `06` are the frames worth a judge's time. `05` especially:
it is the only one a screenshot of somebody else's chatbot cannot fake.

## Hygiene

- **No credentials, no real phone numbers, no customer data.** Blur before you
  commit. A screenshot of a real vault is a screenshot of someone's life.
- Prefer a **fresh throwaway vault** over your own. Nothing in the demo needs to
  be real to be convincing.
- Commit the images. The repo is public and the demo is the argument.
- `.gitattributes` already marks `png`, `jpg`, `jpeg`, `gif`, `webp` and `mp4`
  binary. Add a line beside them before committing a new format, or Git will try
  to diff it.
