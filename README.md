<p align="center">
  <a href="https://github.com/user-attachments/assets/15e8e1fe-53bc-450d-b2e5-bb1024727d58">
    <img src="assets/banner.png" alt="OpenPlow Support — a customer support agent that investigates, cites its sources, and learns from solved cases" width="100%">
  </a>
</p>

# OpenPlow Support

**Customer support that investigates, cites its sources, and learns from solved
cases.**

`OpenClaw` × `Latch` × `plow-wiki`

<p align="center">
  <a href="https://github.com/user-attachments/assets/15e8e1fe-53bc-450d-b2e5-bb1024727d58"><strong>▶ Watch the explainer — 1:30</strong></a>
</p>

OpenPlow is a customer-support agent for product teams. It answers questions
from a knowledge base it maintains itself, investigates approved sources when
the knowledge base runs out, and leaves what it learns as reviewable candidate
knowledge.

This repository uses [Plow](https://plow.co),
[Latch](https://github.com/plow-pbc/latch) and
[plow-wiki](https://github.com/plow-pbc/plow-wiki) as its default integration
and worked example. **OpenPlow is not the support desk of any one of them.**
It is an independent open-source project; see [NOTICE](NOTICE).

## How it works

### 01 — A customer asks

![A customer texts a support line asking how to reset an API key and getting a 401 error. Each customer gets a scoped conversation.](assets/01.png)

The customer uses the configured support line. Session tools are scoped per
account, channel and sender, but this is not hostile multi-tenancy: sessions
have the same tool surface, and the persona is part of the boundary. See
[SECURITY.md](SECURITY.md).

### 02 — It investigates

![The agent searches the knowledge base and falls back to permitted owner sources.](assets/02.png)

The knowledge base comes first. If it is not enough, the agent investigates
only approved, relevant sources through Latch. Customer text is data, not
permission to scan the owner's Mac.

### 03 — It answers with evidence

![The agent explains a cause, cites a receipt URL, and lists the sources it used.](assets/03.png)

Every factual answer should carry a **receipt**: a wiki page, public URL, file,
or tool result that was actually consulted.

### 04 — It learns for next time

![The agent files candidate knowledge, which a human reviews before it becomes canonical.](assets/04.png)

A solved case can leave a candidate in the vault's `_raw/` inbox, on a volume
that belongs to the deployment. The owner decides
whether it becomes canonical knowledge. The full workflow is in
[docs/product.md](docs/product.md).

## What it does today

| Behaviour | Status |
|---|---|
| **Know** | Offline/build-verified; live path designed, not proven end-to-end |
| **Investigate** | Designed and documented; live path depends on the owner's policy and is not proven end-to-end |
| **Learn** | Offline/build-verified; live write-back path designed, not proven end-to-end |
| **Escalate** | Dossier format designed and documented; live path not proven end-to-end |
| **Money, deletion, credentials** | Intentionally forbidden or owner-only |

The claim is not that OpenPlow fixes everything. It answers, investigates,
learns through review, and escalates decisions it cannot own.

## Quick start

The live installation needs a Plow account, Docker, and a support line. A Mac
with Latch is needed only for the part that reaches the owner's machine — the
knowledge base answers without it.

```sh
git clone https://github.com/kumanaya/openplow
cd openplow
./scripts/install.sh
./scripts/verify.sh
```

The default `./scripts/seed-vault.sh` installs this repository's Plow,
Latch, plow-wiki and Agent Index corpus. For another product, use the optional
side path:

```sh
./scripts/seed-vault.sh --from ~/your/vault
```

Before customer traffic, paste the rules from
[LATCH-RULES.md](LATCH-RULES.md) into Latch's **Gatekeeper → Instructions**.

## Offline means verification only

Offline mode does not run a support desk. It builds and probes the image with
no Plow account, Latch or network. It cannot answer tickets, read the vault,
investigate the owner's Mac or exercise the support channel. See the complete
[verification guide](docs/verification.md).

## Documentation

- [Installation and deployment](INSTALL.md)
- [Product workflow](docs/product.md)
- [Architecture](docs/architecture.md)
- [Offline and live verification](docs/verification.md)
- [Security model](SECURITY.md)
- [Rules to paste into Latch](LATCH-RULES.md)

## License

MIT — see [LICENSE](LICENSE). OpenPlow is not Plow and this project grants no
trademark rights to Plow, OpenClaw, Latch or plow-wiki.
