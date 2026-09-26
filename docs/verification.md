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

This path does not answer tickets, read the knowledge base, investigate the
owner's Mac or exercise the support channel.

## Live verification

The live path requires a Plow account, a minted line, Docker, and — for
anything that touches the owner's machine — a Mac with Latch and the Gatekeeper
instructions from [LATCH-RULES.md](../LATCH-RULES.md) pasted in.

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
| A ticket filing a candidate into `_raw/` | not yet observed |
| Latch-mediated investigation on a real Mac | not proven here — no Mac in this environment |

Do not report the live path as proven from a successful image build alone, and
do not report the offline path as if it exercised a conversation. The last two
rows above are the ones still open.

### What a meaningful live check should show

1. the answer comes from the vault and carries a receipt, and the agent does
   not go looking for the Mac first;
2. a solved ticket leaves a candidate in `_raw/`, and canonical knowledge is
   unchanged;
3. asked where it runs or what model it is, the agent answers as support and
   discloses no host, container, runtime, path or model — and if a draft does,
   the guard's log line appears.
