# Verification

There are two different verification paths. They should not be confused, and
neither should be reported as the other.

## Offline verification

Offline means the image and the container, not a usable support deployment. It
requires no Plow account, no Latch and no network.

```sh
./scripts/verify.sh      # 27 checks: image, volume, prompt, guard, seed, live
./scripts/verify-wiki.sh # 33 checks: persistence and the write boundary
```

`verify.sh` needs an image; build one first with
`docker compose build agent`. It checks that the container assembles the
persona, the skills and the guard plugin correctly, that the wiki volume exists
and is mounted where the Dockerfile says, and that the guard's rulebook still
passes its own suite. `verify-wiki.sh` proves the property the whole design
rests on: knowledge survives a container being deleted, and the agent cannot
write a canonical page.

Both exit non-zero on a failure and print what to run next.

This path does not answer customer tickets, exercise the support line, create
an external ticket, or prove the operator's separate Latch-connected agent.

## Live verification

The live support path requires a Plow account, a minted line and Docker.
Customer answers come from the seeded wiki. The operator's optional, separate
internal agent additionally requires macOS, Latch and the Gatekeeper
instructions from [LATCH-RULES.md](../LATCH-RULES.md).

To provision, `./scripts/install.sh` uses the first free line, mints the
credential with mode 600, seeds the vault and starts the container. It is
idempotent: re-running it with a credential in place skips login and mint.

### What is proven here, and what is not

| | |
|---|---|
| Image, volume, write boundary, prompt, guard plugin | **proven**, 60 checks |
| Identity resolution and the channel connecting | **proven**, live |
| A conversation answered from the vault with a receipt | **proven**, live |
| The guard catching a leak in a live reply | **proven**, live — `[infra-guard] revise` on `/opt/plow` |
| A missing-wiki case delivered as an owner-team handoff | designed; live path not yet observed |
| An external ticket-system record created | not implemented or claimed |
| Owner's separate Latch-connected internal agent | not proven end-to-end |

Do not report the live path as proven from a successful image build alone, and
do not report the offline path as if it exercised a conversation. The handoff
and operator-agent rows remain open.

### What a meaningful live check should show

1. A wiki-backed customer question receives an answer with a receipt.
2. A question without a reliable wiki answer is handed to the owner with a
   dossier; the customer is told the team needs to investigate; no external
   ticket is claimed unless a ticketing tool confirms it.
3. OpenPlow does not use the operator's Latch-connected agent to inspect a
   customer's machine or fill a wiki gap.
4. Separately, the operator's internal agent can use only the Latch capabilities
   the owner configured. This requires an enforced boundary from customer
   sessions; the current repository does not prove that separation.
