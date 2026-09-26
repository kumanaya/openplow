# Verification

Offline checks and a live support interaction prove different things. Report
only the one actually exercised.

## Deterministic local checks

```sh
node --test test/
./scripts/verify.sh
./scripts/verify-organization.sh
./scripts/verify-wiki.sh
```

| Check | Evidence |
| --- | --- |
| `node --test test/` | Case lifecycle rules, concurrent IDs, Gateway provenance overwrite, origin-session resolution, terminal Latch denial, candidate staging, and role tool policy |
| `verify.sh` | Image build, offline boot, copied skills/prompts/plugins, plugin discovery, wiki mount/ownership, and all repository tests |
| `verify-organization.sh` | Real pinned image offline bootstrap, actual `openclaw config patch`, schema validation, three-agent listing, and post-patch restart |
| `verify-wiki.sh` | Persistent volume behavior plus canonical wiki writes refused to the agent user |

`verify-organization.sh` uses disposable Docker volumes for the state and the
base-owned configuration includes, deleting both on exit. The duplicate include
mount reproduces two boot phases in separate short-lived containers; production
uses one running container and the installer performs the same steps in it.

These checks do **not** send a customer message, authenticate a Plow line,
connect a Mac to Latch, or prove the result of an approval decision.

## Live acceptance check

Requires a minted Plow line, Docker, a seeded wiki, and—only for an actual
investigation—an operator Mac with Latch and its Gatekeeper policy.

1. Send a question supported by a canonical wiki page. Confirm a cited reply
   and no case.
2. Send a question absent from the wiki. Confirm Frontline creates a case and
   tells the customer investigation is needed; do not accept an external-ticket
   claim.
3. Observe the configured Investigator claim the case. If Latch is used,
   confirm the operation matches an explicit operator authorization and inspect
   the Latch decision.
4. Confirm `case_verify` contains evidence and a customer-safe summary.
5. Confirm Frontline calls `case_resolve` in the original customer session
   before replying. Try no cross-customer resume.
6. If the lesson is durable, confirm Curator creates only `_raw/OP-*.md`; have
   a human validate, promote, and index the page.
7. Confirm Frontline and Curator cannot see or invoke Latch tools and cannot
   send to another conversation.

## Current evidence boundary

The repository's local evidence covers the executable workflow and native
configuration. No live Plow or Latch transaction was observed by those checks.
Do not describe that external integration as proven until the acceptance check
above is run in the intended deployment.
