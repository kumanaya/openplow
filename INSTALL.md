# Install

Written against Plow's own documentation. The image in this repository has been
built, its offline boot probe passes, and the architecture checks pass; the
`plow-agents` steps have not been run against a live account from here.

**The container needs macOS. The credential step needs a POSIX filesystem.**
Those are two different constraints and it is worth keeping them apart:

- The knowledge base is a Docker volume and runs anywhere Docker does.
- Latch — the half that reaches your files — is macOS only.
- `plow-agents` writes your token and the agent credential, and **refuses to
  write either unless the file is mode 0600**. On Windows, NTFS reports every
  file as 0777, so that check can never pass. This is not a limitation we
  chose; it is the CLI being careful with a live credential.

On Windows, run the scripts from **WSL**, which has a POSIX filesystem. The
installer checks this before it asks you for anything and tells you if it is
wrong, so you find out in a second rather than ninety seconds after you have
texted an activation code.

## What you need

| | |
|---|---|
| **A Plow line** | A number your customers can text. From [plow.co](https://plow.co). |
| **`plow-agents`** | Not an installed package — it is a git clone you run with `python3`. `install.sh` clones it for you. |
| **Docker** | The agent is a container. |
| **A Mac, with Latch** | Only for the half that reads *your* files. Latch has no Windows or Linux build. The knowledge base does not need it. |

## The short version

```sh
git clone https://github.com/kumanaya/openplow
cd openplow
./scripts/install.sh
```

That clones `plow-agents`, signs you in (one phone SMS), picks the first free
line, mints it, seeds the knowledge base, starts Compose, and prints the line's
name and number. It is safe to re-run: it skips what is already done.

```sh
./scripts/install.sh --line Willow   # a specific line, by name or uid
./scripts/install.sh --new-line      # provision another line (another SMS)
```

The installer will not create a second line unless you ask, and will not mint a
line that already has an assistant. If every line is taken it says which ones
are, and stops.

## Windows: run it from WSL

```sh
wsl
cd /mnt/c/Users/<you>/path/to/openplow
./scripts/install.sh
```

In Docker Desktop, turn on **Settings → Resources → WSL Integration** first, so
the WSL shell can reach `docker`. The vault, the CLI and Compose then all work
unchanged; `install.sh` tells you the exact path if you run it from the wrong
shell.

## Before the first ticket: set the rules

Latch's premise is that *you* define what safe means, and a support agent's
answer is not a personal assistant's. Paste a starter policy from
[LATCH-RULES.md](LATCH-RULES.md) into **Gatekeeper → Instructions** on the Audit
tab before you let anyone text the line — there is no "Settings → Rules" screen.
It governs what the agent may do on *your Mac*. The knowledge base does not go
through Latch at all, and neither of them is described there any more.

## If you prefer the steps by hand

`plow-agents` is a git clone, not a binary, so it is run through `python3` and
the path has to be spelled out. The commands below set one variable rather than
defining a shell function: a function like `plow() { … }` lives in the one
terminal you typed it into, and every new shell — a second terminal, a `docker
exec`, a colleague following along — fails with `plow: command not found` and
no explanation.

```sh
# 1. the CLI
git clone --depth 1 https://github.com/plow-pbc/plow-agents.git .tools/plow-agents
CLI=.tools/plow-agents/bin/plow-agents

# 2. sign in — INTERACTIVE, needs a phone. See below.
python3 "$CLI" login

# 3. see your lines. TSV: uid, name, number, status
python3 "$CLI" lines

# 4. mint the first FREE one, by uid from step 3. Writes ./plow-credentials
python3 "$CLI" mint <uid>

# 5. seed the vault, then start
./scripts/seed-vault.sh
docker compose up --build
```

`CLI` is a plain variable, so it survives in this shell and is re-declared by
one line in the next one. If you would rather not retype it, put the export in
your shell profile:

```sh
export OPENPLOW_CLI=.tools/plow-agents/bin/plow-agents   # adjust to your path
```

Do not run `docker compose up` before minting: compose will not create the
credential file for you, and the container boots with no token and parks
itself waiting for one. When you have minted by hand, run
`./scripts/announce-line.sh` to print this agent's line name and number rather
than reading them out of the `lines` table — that table lists every line on the
account, not just this agent's.

### `plow login` needs a human

This is the step that cannot be automated, and it is why this document cannot
hand you a finished agent. Run it in the foreground, in a real terminal — it
reads from stdin. It prints two lines:

```
Plow Activate: <code>
<destination number>
```

Show both to the owner, they relay them to Plow by SMS, and wait for them to
reply **`feito`**. The script then continues. Everything before this point can
be scripted; this part is a person on a phone.

### Which line to mint

`lines` prints TSV — `uid`, `name`, `number`, `status` — where `status` is
`free` or the uid of the agent already on that line. Mint the first **free**
one. If every line already has an assistant, stop and ask the owner which to
free; do not create a second line on your own initiative.

```sh
python3 "$CLI" lines | awk -F '\t' 'NR > 1 && $4 == "free" { print $1, $2, $3 }'
```

`plow-credentials` holds `PLOW_AGENT_TOKEN`, the credential the container boots
with. It is in `.gitignore`; treat it like a password.

### The dashboard, and who it is for

Open <http://localhost:3001> and text the line number from your phone.

`localhost:3001` is the dashboard, and **anyone who can reach it is admin of
this agent**. It is published to loopback only and the proxy in `dev/Caddyfile`
refuses a foreign browser `Origin`, but it is a dev convenience, not a boundary
to rely on.

`docker compose down` keeps the state volume and the knowledge base. `down -v`
does not touch either: the wiki volume is declared `external`, so a teardown
cannot reach organizational knowledge. The conversation itself is on the Plow
side and comes back with it.

## First run

1. **Put a knowledge base under it.** It does not start empty. The vault is a
   Docker volume belonging to this deployment, so seeding is an import rather
   than a `cp` into a home folder, and it does not matter whether the Mac is
   awake:

   ```sh
   # A. this repo's pages: Plow, Latch, plow-wiki, the Agent Index
   ./scripts/seed-vault.sh

   # B. a wiki you already have
   ./scripts/seed-vault.sh --from ~/some/other/vault
   ```

   The import creates the vault if it is not there, copies the pages, then runs
   `validate` → `index` → `snapshot` inside the image. If validation fails it
   stops and names the pages, and it does **not** index or commit a tree it
   could not validate. Existing pages are never overwritten without `--force`;
   `--check` shows what would change and touches nothing.

   To see what you have:

   ```sh
   docker run --rm --user root -v openplow-wiki:/data \
     openplow-support:local /opt/plow/bin/wiki-peek
   ```

2. **Text the line.** Any message starts the conversation; there is no setup
   greeting. Try *"why can't you just fix the page yourself?"* — it should be
   answered from the vault, with a source, without touching the Mac.
3. **Let a real ticket in.** `docker compose logs -f agent` shows every turn and
   every tool call.

## Migrating from an older `~/Plow/wiki`

If you ran this before the knowledge base moved into the deployment, your vault
is still on your Mac at `~/Plow/wiki`, with its history beside it at
`~/Plow/wiki.git`. **Nothing here deletes either of them.** This is the whole
migration:

```sh
./scripts/seed-vault.sh --check --from ~/Plow/wiki    # see what would come across
./scripts/seed-vault.sh --force --from ~/Plow/wiki    # do it
```

What that does, in order: copies every page into the volume, re-asserts the
ownership contract, validates the result against the vault's own schemas,
rebuilds the index, and commits — so the import becomes the first commit of the
new history, and `wiki history <page>` works from that moment on.

What it does **not** do: copy the old git history, and touch
`~/Plow/wiki` or `~/Plow/wiki.git` in any way. They stay where they are, as the
record of where the knowledge came from. The new history starts at the import.

Afterwards there is exactly one authoritative store. The agent no longer reads
`~/Plow/wiki` — nothing in its skills or persona points there any more, and
crossing to the Mac to consult a copy of knowledge it already has locally would
be a bug. You can uninstall Latch's `wiki` plugin if you like; it is no longer
part of how this works, and leaving it installed only means you have an old
folder on your Mac.

## Talking to it

| You text | It does |
|---|---|
| A customer question | triage, look it up locally, answer with a receipt, file a candidate |
| "wikify" | runs `wiki validate`, lists what is waiting in `_raw/`, and tells you the refresh command — the refresh itself is yours, because the agent cannot write canonical pages |
| A decision | carries it out, files the outcome as a candidate, tells the customer |
| "what do you know about the wiki plugin" | reads the runbook and answers, with the public URL |

## When something is wrong

- **"I can't reach the knowledge base."** The deployment was never seeded, or
  the volume is not mounted. Run `./scripts/seed-vault.sh`, and check it with
  `wiki-peek` as shown above. This is a deployment problem, not a "wake the
  Mac" problem — the vault does not live there.
- **"I can't check that right now."** Latch is asleep or disconnected, and the
  question needed their machine. It retries; ask again in a minute. After two
  failures, wake the Mac or open Latch. Everything the knowledge base covers
  still works, which is the point of the split.
- **"I can't edit that page."** Not an error. Promotion is a person's step; the
  vault refuses the write. Move the candidate yourself and run
  `docker compose run --rm --user root agent /opt/plow/bin/wiki-refresh`.
- **Answers with no receipt.** That is a real answer meaning "I did not know and
  here is what I checked" — but if it happens constantly, the knowledge base is
  thin and the next few tickets are the ones that fill it.
- **A wrong answer.** `wiki history <page>` shows every commit that touched that
  page, in the same volume. Fix the page; the next answer will be right.
- **Something is wrong and the checks can prove it.**
  `./scripts/verify-wiki.sh` seeds a scratch volume, cuts the network, destroys
  a container and tries to attack the vault as the agent. It never touches your
  knowledge.

## Publishing on the Agent Index

`scripts/register.sh` publishes or edits this agent's page; it is idempotent
against a slug you own.

```sh
docker compose up -d
AGENT_VIDEO=<youtube-video-id> AGENT_LOGO=./logo.png \
AGENT_INSTALL_URL="https://github.com/<you>/openplow/blob/main/INSTALL.md" \
  scripts/register.sh

scripts/publish-story.sh --tags          # tags already in use; reuse one
scripts/publish-story.sh <slug> <title> <body> <tag>
```

`--video` takes a **YouTube video id**, not a URL. Both scripts run the client
already inside the image, at a pinned commit, rather than downloading a second
copy to the host.
