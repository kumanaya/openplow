<p align="center">
  <a href="https://github.com/user-attachments/assets/39dfcbef-e886-4b39-be8e-b0a895e76bfa">
    <img src="assets/banner.png" alt="OpenPlow concept illustration" width="100%">
  </a>
</p>

<h1 align="center">OpenPlow Support</h1>

<p align="center">
  <strong>Answers from the product wiki. Hands unanswered cases to the team.</strong>
</p>

<p align="center">
  <code>OpenClaw</code> × <code>Plow Wiki</code> × team handoff × <code>Latch</code>
</p>

<p align="center">
  <a href="https://github.com/user-attachments/assets/39dfcbef-e886-4b39-be8e-b0a895e76bfa">Watch the 80-second explainer</a>
  &middot;
  <a href="#how-it-works">How it works</a>
  &middot;
  <a href="#quick-start">Quick start</a>
  &middot;
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <sub>Illustrative film, not proof of a live handoff or an enforced Latch boundary.</sub>
</p>

> [!NOTE]
> **Concept illustration:** this artwork predates the current security model.
> Customer-facing OpenPlow answers from the wiki or prepares a handoff; Latch
> is reserved for the operator's separate internal agent.

OpenPlow is a customer-facing support agent for product teams. A customer asks
on the configured support line; OpenPlow looks for a reliable answer in the
deployment's wiki and replies with a source. If the wiki does not cover the
case, OpenPlow prepares an internal handoff for the owner's team instead of
guessing or investigating the customer's systems.

The operator has a separate path: the owner may connect their own internal
OpenClaw agent to Latch over MCP for additional, owner-authorized actions on
the operator's systems. That agent is not OpenPlow's customer-facing support
session.

> [!WARNING]
> **Security boundary:** the inherited base image includes an MCP bridge, and
> this repository does not prove a per-session gate that hides Latch tools from
> customers. Do not connect privileged Latch capabilities to the shared support
> gateway until that boundary is enforced; see [SECURITY.md](SECURITY.md).

This follows the support pattern described by Plow's CEO: OpenClaw with a
product wiki and Latch. OpenPlow keeps Latch on the operator's separate
internal-agent path; it is not used to investigate a customer's device.

This repository uses [Plow](https://plow.co),
[Latch](https://github.com/plow-pbc/latch) and
[plow-wiki](https://github.com/plow-pbc/plow-wiki) as its default integration
and worked example. **OpenPlow is not the support desk of any one of them.**
It is an independent open-source project; see [NOTICE](NOTICE).

## How it works

| Step | Flow |
| --- | --- |
| **01 — A customer asks** | The configured Plow line opens a scoped conversation. |
| **02 — OpenPlow checks the wiki** | A canonical page supports the answer → reply with a receipt. No reliable page → prepare a handoff dossier for the owner's team and tell the customer the team needs to investigate. |
| **03 — The team investigates separately** | The owner may use an internal OpenClaw agent connected to Latch via MCP for authorized operations on the operator's systems. Customer text does not authorize those operations, and OpenPlow does not use this path to inspect a customer's device. |
| **04 — The organization learns** | A solved case can leave a candidate in `_raw/`. A person reviews it before it becomes canonical knowledge. |

The internal handoff currently means a dossier delivered to the owner's
conversation. This repository does not claim an integration that creates a
record in an external ticketing system.

## Workflow illustrations

The illustrations below describe the intended support workflow; they are not
screenshots or evidence of a live deployment.

<p align="center">
  <img src="assets/01.png" alt="Illustration of a customer asking OpenPlow for support" width="800">
</p>

<p align="center">
  <img src="assets/02.png" alt="Illustration of OpenPlow investigating across authorized systems" width="800">
</p>

<p align="center">
  <img src="assets/03.png" alt="Illustration of OpenPlow answering with a wiki receipt" width="800">
</p>

<p align="center">
  <img src="assets/04.png" alt="Illustration of a solved case becoming reviewed canonical wiki knowledge" width="800">
</p>

The customer-facing session answers from the wiki or prepares a handoff. A
person reviews any candidate knowledge before it becomes canonical.

## What it does today

| Behaviour | Status |
| --- | --- |
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

### Use another product corpus

The default `./scripts/seed-vault.sh` installs this repository's Plow, Latch,
plow-wiki and Agent Index corpus. For another product, import its vault:

```sh
./scripts/seed-vault.sh --from ~/your/vault
```

## Offline means verification only

> [!IMPORTANT]
> Offline mode builds and probes the image without a Plow account, Latch or
> network. It does not answer tickets, exercise the support line, or prove the
> operator's separate MCP agent. See [verification](docs/verification.md).

## Documentation

| Topic | Read |
| --- | --- |
| Installation and deployment | [INSTALL.md](INSTALL.md) |
| Product workflow | [docs/product.md](docs/product.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Offline and live verification | [docs/verification.md](docs/verification.md) |
| Security model | [SECURITY.md](SECURITY.md) |
| Rules for the operator's Latch-connected agent | [LATCH-RULES.md](LATCH-RULES.md) |

## License

MIT — see [LICENSE](LICENSE). OpenPlow is not Plow and this project grants no
trademark rights to Plow, OpenClaw, Latch or plow-wiki.
