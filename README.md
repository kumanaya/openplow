# OpenPlow Support

**Answers from the product wiki. Hands unanswered cases to the team.**

`OpenClaw` × `Plow Wiki` × team handoff

[80-second explainer](assets/openplow-explainer.mp4) — illustrative film, not
proof of a live handoff or an enforced Latch boundary.

OpenPlow is a customer-facing support agent for product teams. A customer asks
on the configured support line; OpenPlow looks for a reliable answer in the
deployment's wiki and replies with a source. If the wiki does not cover the
case, OpenPlow prepares an internal handoff for the owner's team instead of
guessing or investigating the customer's systems.

The operator has a separate path: the owner may connect their own internal
OpenClaw agent to Latch over MCP for additional, owner-authorized actions on
the operator's systems. That agent is not OpenPlow's customer-facing support
session.

This follows the support pattern described by Plow's CEO: OpenClaw with a
product wiki and Latch. OpenPlow keeps Latch on the operator's separate
internal-agent path; it is not used to investigate a customer's device.

**Security boundary:** the inherited base image includes an MCP bridge, and
this repository does not prove a per-session gate that hides Latch tools from
customers. Do not connect privileged Latch capabilities to the shared support
gateway until that boundary is enforced; see [SECURITY.md](SECURITY.md).

This repository uses [Plow](https://plow.co),
[Latch](https://github.com/plow-pbc/latch) and
[plow-wiki](https://github.com/plow-pbc/plow-wiki) as its default integration
and worked example. **OpenPlow is not the support desk of any one of them.**
It is an independent open-source project; see [NOTICE](NOTICE).

## How it works

1. **A customer asks.** The configured Plow line opens a scoped conversation.
2. **OpenPlow checks the wiki.** A canonical page supports the answer → reply
   with a receipt. No reliable page → prepare a handoff dossier for the
   owner's team and tell the customer the team needs to investigate.
3. **The team investigates separately.** The owner may use an internal
   OpenClaw agent connected to Latch via MCP for authorized operations on the
   operator's systems. Customer text does not authorize those operations, and
   OpenPlow does not use this path to inspect a customer's device.
4. **The organization learns.** A solved case can leave a candidate in `_raw/`.
   A person reviews it before it becomes canonical knowledge.

The internal handoff currently means a dossier delivered to the owner's
conversation. This repository does not claim an integration that creates a
record in an external ticketing system.

## What it does today

| Behaviour | Status |
|---|---|
| **Know** | Offline/build-verified; live path designed, not proven end-to-end |
| **Escalate** | Handoff dossier designed; no external ticketing integration is claimed |
| **Learn** | Offline/build-verified; live write-back path designed, not proven end-to-end |
| **Operate** | Owner's separate Latch-connected agent is an optional operator path; deployment must keep it separate from customer sessions |
| **Money, deletion, credentials** | Not performed by the customer-facing support agent |

OpenPlow is built to do useful support work, not to imply more autonomy than
the deployment provides. See [SECURITY.md](SECURITY.md) for the trust boundary.

## Quick start

The live support installation needs a Plow account, Docker, and a support line.
The wiki answers do not need Latch or a Mac. A Mac with Latch is needed only if
the operator chooses to connect a separate internal agent for owner-side work.

```sh
git clone https://github.com/kumanaya/openplow
cd openplow
./scripts/install.sh
./scripts/verify.sh
```

The default `./scripts/seed-vault.sh` installs this repository's Plow, Latch,
plow-wiki and Agent Index corpus. For another product, import its vault:

```sh
./scripts/seed-vault.sh --from ~/your/vault
```

## Offline means verification only

Offline mode builds and probes the image without a Plow account, Latch or
network. It does not answer tickets, exercise the support line, or prove the
operator's separate MCP agent. See [verification](docs/verification.md).

## Documentation

- [Installation and deployment](INSTALL.md)
- [Product workflow](docs/product.md)
- [Architecture](docs/architecture.md)
- [Offline and live verification](docs/verification.md)
- [Security model](SECURITY.md)
- [Rules for the operator's Latch-connected agent](LATCH-RULES.md)

## License

MIT — see [LICENSE](LICENSE). OpenPlow is not Plow and this project grants no
trademark rights to Plow, OpenClaw, Latch or plow-wiki.
