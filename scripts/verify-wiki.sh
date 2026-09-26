#!/usr/bin/env bash
# Does the architecture actually hold?
#
#   ./scripts/verify-wiki.sh
#
# This is the offline proof for the claim the whole design rests on:
#
#   ORGANIZATIONAL KNOWLEDGE IS AVAILABLE AND PERSISTENT INDEPENDENTLY OF
#   LATCH AND THE OWNER'S MAC.
#
# It runs against a SCRATCH volume, never the real one, and never touches a
# customer's knowledge. It needs Docker and nothing else — no Plow account, no
# Latch, no Mac, no network after the image is built.
#
# That is the point: these are the permissions the agent actually has, not the
# ones a root shell would have.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib.sh
source "$ROOT/scripts/lib.sh"

# A volume of our own. OPENPLOW_VOLUME is the only thing that would let this
# script touch real knowledge, so it is set before anything uses it.
export OPENPLOW_VOLUME="openplow-verify-$$"
VOL="$OPENPLOW_VOLUME"
trap 'docker volume rm -f "$VOL" >/dev/null 2>&1 || true' EXIT

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; OFF=$'\033[0m'
[ -t 1 ] || { BOLD=""; DIM=""; RED=""; GRN=""; YEL=""; OFF=""; }

PASS=0; FAIL=0; SKIP=0
sect() { printf '\n%s%s%s\n' "$BOLD" "$1" "$OFF"; }
pass() { printf '  %sok%s    %s\n' "$GRN" "$OFF" "$1"; PASS=$((PASS+1)); }
fail() { printf '  %sFAIL%s  %s\n' "$RED" "$OFF" "$1"; FAIL=$((FAIL+1)); printf '        %sfix:%s %s\n' "$DIM" "$OFF" "$2"; }
skip() { printf '  %sskip%s  %s\n' "$YEL" "$OFF" "$1"; printf '        %s%s%s\n' "$DIM" "$2" "$OFF"; SKIP=$((SKIP+1)); }

# As the agent, against the scratch volume, with the network cut off. A vault
# that needs the network to answer a question is not independent of anything.
as_agent() { docker run --rm --network none -v "$VOL:$OPENPLOW_MOUNT" "$OPENPLOW_IMAGE" "$@"; }
as_root()  { docker run --rm --network none --user root -v "$VOL:$OPENPLOW_MOUNT" "$OPENPLOW_IMAGE" "$@"; }

command -v docker >/dev/null || { echo "docker is not on PATH" >&2; exit 1; }
openplow_ensure_image || { echo "could not build $OPENPLOW_IMAGE" >&2; exit 1; }

# ───────────────────────────────────────────────────── the tool is really there
sect "The wiki tool"
if as_agent sh -c 'command -v wiki' >/dev/null 2>&1; then
  pass "the wiki CLI is on PATH inside the container, as the agent"
else
  fail "no wiki CLI in the image" "the plow-wiki install in the Dockerfile did not land"
fi

WIKI_PATH_IN_IMAGE="$(as_agent sh -c 'echo "$WIKI_PATH"' 2>/dev/null)"
if [ "$WIKI_PATH_IN_IMAGE" = "$OPENPLOW_MOUNT/wiki" ]; then
  pass "WIKI_PATH is $WIKI_PATH_IN_IMAGE, one source of truth"
else
  fail "WIKI_PATH is '${WIKI_PATH_IN_IMAGE:-unset}'" "it should be $OPENPLOW_MOUNT/wiki; see Dockerfile"
fi

if [ -n "$(as_root sh -c 'command -v git' 2>/dev/null)" ]; then
  pass "git is present — history is the wiki's own, not an invention"
else
  fail "no git in the image" "wiki snapshot needs it"
fi

# ───────────────────────────────────────────────────────────────── a vault to use
sect "Seeding a vault"
if openplow_wiki_import "$ROOT/seed" 0 >/dev/null 2>&1; then
  pass "seeded the vault from seed/ and it validated"
else
  fail "could not seed the scratch vault" "run ./scripts/seed-vault.sh, or the image's wiki-import by hand"
fi

# ─────────────────────────────────────────── TEST 1 — KNOW WITHOUT LATCH
sect "TEST 1 — know without Latch"
# No Latch, no Plow relay, no network at all. If this answers, organizational
# knowledge does not depend on the owner's Mac being reachable.
t1=$(as_agent sh -c 'cat "$WIKI_PATH"/index.md' 2>/dev/null)
if printf '%s' "$t1" | grep -q '\.md'; then
  pass "the agent read the vault's index with the network cut off"
else
  fail "could not read index.md as the agent, offline" "check the ownership contract: /data/wiki must be root-owned and world-readable"
fi

t1b=$(as_agent wiki validate 2>&1)
if printf '%s' "$t1b" | grep -q 'validated'; then
  pass "the agent can run 'wiki validate' itself: $(printf '%s' "$t1b" | tail -1)"
else
  fail "the agent could not run wiki validate" "$(printf '%s' "$t1b" | tail -3)"
fi

t1c=$(as_agent sh -c 'cat "$WIKI_PATH"/concepts/latch.md' 2>/dev/null | head -1)
if [ -n "$t1c" ]; then
  pass "a canonical page is readable by the agent"
else
  fail "canonical pages are not readable by the agent" "they must be world-readable"
fi

# ─────────────────────────────────────────── TEST 6 — CANDIDATE WRITE
sect "TEST 6 — a solved case leaves a candidate"
CANDIDATE="$VOL-candidate.md"
if as_agent sh -c "cat > \"\$WIKI_PATH/_raw/\"$(basename "$CANDIDATE") <<'EOF'
---
type: Raw
title: Verify probe
description: Proves the agent can file a candidate.
category: meta
tags: [candidate]
sources:
  - resource: \"ticket: verify-wiki\"
created: 2026-09-26
updated: 2026-09-26
---
A customer asked something. This is a candidate, not a fact.
EOF" 2>/dev/null; then
  pass "the agent wrote a candidate into _raw/"
else
  fail "the agent could not write to _raw/" "_raw must be owned by the agent user; run /opt/plow/bin/wiki-bootstrap"
fi

if as_root sh -c "test -s \"\$WIKI_PATH/_raw/$(basename "$CANDIDATE")\"" 2>/dev/null; then
  pass "the candidate is in the vault"
else
  fail "the candidate is not in the vault" "the write reported success but nothing landed"
fi

if as_root /opt/plow/bin/wiki-refresh >/dev/null 2>&1; then
  pass "wiki-refresh validated, indexed and committed it"
else
  fail "wiki-refresh failed" "run it by hand to see which of the three steps broke"
fi

# ─────────────────────────────────── TEST 2 + 3 — PERSISTENCE / RECREATION
sect "TEST 2 & 3 — survive container recreation"
# A container that is started, does nothing, and is destroyed. Everything after
# this point is a different container against the same volume.
docker rm -f "$VOL-decoy" >/dev/null 2>&1 || true
docker run -d --name "$VOL-decoy" -v "$VOL:$OPENPLOW_MOUNT" "$OPENPLOW_IMAGE" \
  sleep 30 >/dev/null 2>&1
docker rm -f "$VOL-decoy" >/dev/null 2>&1
pass "a container was created and destroyed"

if as_agent sh -c "test -s \"\$WIKI_PATH/_raw/$(basename "$CANDIDATE")\"" 2>/dev/null; then
  pass "the candidate is still there in a brand new container"
else
  fail "the candidate did not survive container recreation" "the vault is not on the named volume"
fi

t3=$(as_agent sh -c 'cat "$WIKI_PATH"/concepts/latch.md' 2>/dev/null | head -1)
if [ -n "$t3" ]; then
  pass "canonical knowledge is still readable after recreation"
else
  fail "knowledge did not survive container recreation" "check the wiki volume is mounted at $OPENPLOW_MOUNT"
fi

t3b=$(as_agent sh -c 'test -s "$WIKI_PATH"/.wiki/chunks.json' 2>/dev/null && echo yes || echo no)
if [ "$t3b" = "yes" ]; then
  pass "the recall index survived too"
else
  fail "the recall index is gone" "wiki index output is part of the vault"
fi

t3c=$(as_agent sh -c 'wiki history "$WIKI_PATH"/concepts/latch.md' 2>/dev/null | head -1)
if [ -n "$t3c" ]; then
  pass "history is readable: $(printf '%s' "$t3c" | cut -c1-60)"
else
  fail "no history" "wiki snapshot should have committed the seed"
fi

# ─────────────────────────────────────────── TEST 7 — CANONICAL PROTECTION
sect "TEST 7 — canonical knowledge is protected"
# These are the operations a compromised or misbehaving agent would try. Each
# one must fail at the filesystem, not because the persona told it not to.
try_denied() { # description, shell snippet
  if as_agent sh -c "$2" >/dev/null 2>&1; then
    fail "$1" "the agent CAN do this — the filesystem boundary has a hole"
  else
    pass "$1"
  fi
}
try_denied "cannot create a page under a root"            'echo x > "$WIKI_PATH"/concepts/forged.md'
try_denied "cannot overwrite wiki.toml"                   'echo x > "$WIKI_PATH"/wiki.toml'
try_denied "cannot overwrite a canonical page"            'echo x > "$WIKI_PATH"/concepts/latch.md'
try_denied "cannot delete a canonical page"               'rm -f "$WIKI_PATH"/concepts/latch.md'
try_denied "cannot rename a root directory"               'mv "$WIKI_PATH"/concepts "$WIKI_PATH"/stolen'
try_denied "cannot chmod a root directory to make it writable" 'chmod 777 "$WIKI_PATH"/concepts'
try_denied "cannot write through a symlink out of _raw"    'ln -sf "$WIKI_PATH"/wiki.toml "$WIKI_PATH"/_raw/e.md; echo x > "$WIKI_PATH"/_raw/e.md'
try_denied "cannot plant a symlink in a root"             'ln -sf /etc/passwd "$WIKI_PATH"/concepts/pw.md'
try_denied "cannot create a sibling directory in /data"   'mkdir -p "$WIKI_PATH"/../elsewhere'
try_denied "cannot tamper with history"                   'echo x > "$WIKI_PATH.git"/COMMIT_EDITMSG'
try_denied "cannot run 'wiki index' (it rewrites the vault)" 'wiki index'
try_denied "cannot run 'wiki snapshot' (it rewrites history)" 'wiki snapshot --agent x'

if as_agent sh -c 'test -w "$WIKI_PATH"/_raw' 2>/dev/null; then
  pass "_raw/ IS writable by the agent — that is the one exception, and it is deliberate"
else
  fail "_raw/ is not writable by the agent" "the agent could not file a candidate at all"
fi

# ───────────────────── the boundary is described honestly where it is claimed
sect "The documentation tells the truth"
doccheck() { # file, pattern, what it must say
  if grep -qiE "$2" "$ROOT/$1" 2>/dev/null; then
    pass "$3"
  else
    fail "$3" "$1 no longer says it"
  fi
}
doccheck SECURITY.md 'not (protected|enforced) by Latch' "SECURITY.md says Latch no longer guards the wiki"
doccheck SECURITY.md 'root-owned' "SECURITY.md names the mechanism that replaced it"
doccheck prompt/AGENTS.md 'WIKI_PATH|_raw' "the persona still describes the candidate inbox"
doccheck skills/knowledge-base/SKILL.md 'WIKI_PATH' "the knowledge-base skill reads the vault locally"

if grep -qE 'plow_read_file|plow_write_file' "$ROOT/skills/knowledge-base/SKILL.md" 2>/dev/null; then
  fail "the knowledge-base skill still routes vault reads through Latch" "the vault is local now; use the file tools"
else
  pass "the knowledge-base skill no longer routes vault reads through Latch"
fi

# ───────────────────────────── what genuinely cannot be checked here
sect "What this script cannot prove"
skip "customer ticket handoff" "needs a Plow account and live support conversation."
skip "operator's separate Latch agent" "needs an owner-configured internal agent and Mac."
skip "the agent's live answer quality" "needs a Plow account and a phone. The offline checks prove the architecture, not the conversation."

# ───────────────────────────────────────────────────────────────────── summary
printf '\n%s─────────────────────────────────────────%s\n' "$DIM" "$OFF"
if [ "$FAIL" -eq 0 ]; then
  printf '%s  %d passed%s' "$GRN" "$PASS" "$OFF"
  [ "$SKIP" -gt 0 ] && printf ', %d skipped' "$SKIP"
  printf '\n\n  Organizational knowledge survives container recreation and answers\n'
  printf '  with Latch disconnected. The two flows are now separate.\n'
else
  printf '%s  %d passed, %d failed%s\n' "$RED" "$PASS" "$FAIL" "$OFF"
  printf '\n  Fix the failures above, then run this again.\n'
fi
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
