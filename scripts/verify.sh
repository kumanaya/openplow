#!/usr/bin/env bash
# Is this install actually working?
#
#   ./scripts/verify.sh
#
# Read-only. Changes nothing, starts nothing, sends nothing. Every check that
# can run without a Plow account runs first, so a broken build is reported
# before a missing token. Each failure prints the fix underneath it.
set -uo pipefail
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'  # see lib.sh — every path here is a path INSIDE the container


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS="$ROOT/.tools/plow-agents"
CREDENTIALS="$ROOT/plow-credentials"
IMG="${IMG:-openplow-support:verify}"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; OFF=$'\033[0m'
[ -t 1 ] || { BOLD=""; DIM=""; RED=""; GRN=""; YEL=""; OFF=""; }

PASS=0; FAIL=0; SKIP=0
sect() { printf '\n%s%s%s\n' "$BOLD" "$1" "$OFF"; }
pass() { printf '  %sok%s    %s\n' "$GRN" "$OFF" "$1"; PASS=$((PASS+1)); }
fail() { printf '  %sFAIL%s  %s\n' "$RED" "$OFF" "$1"; FAIL=$((FAIL+1)); printf '        %sfix:%s %s\n' "$DIM" "$OFF" "$2"; }
skip() { printf '  %sskip%s  %s\n' "$YEL" "$OFF" "$1"; printf '        %s%s%s\n' "$DIM" "$2" "$OFF"; SKIP=$((SKIP+1)); }

# ---------------------------------------------------------------- 1. tools
sect "Toolchain"
command -v docker  >/dev/null && pass "docker"       || fail "docker is not on PATH" "install Docker Desktop and start it"
command -v python3 >/dev/null && pass "python3"      || fail "python3 is not on PATH" "macOS ships it; 'xcode-select --install' if it is missing"

# ------------------------------------------------------------------ 2. cli
sect "Plow CLI"
if [[ -d "$TOOLS/.git" ]]; then pass "plow-agents cloned at .tools/plow-agents"
else skip "plow-agents not cloned" "run ./scripts/install.sh"; fi

# ------------------------------------------------------------ 3. credential
sect "Credentials"
if [[ -d "$CREDENTIALS" ]]; then
  fail "plow-credentials is a directory, not a file" "docker created it before mint ran. rmdir plow-credentials && ./scripts/install.sh"
elif [[ -f "$CREDENTIALS" ]]; then
  grep -q PLOW_AGENT_TOKEN "$CREDENTIALS" && pass "plow-credentials carries PLOW_AGENT_TOKEN" \
    || fail "plow-credentials has no PLOW_AGENT_TOKEN" "delete it and re-run ./scripts/install.sh"
else
  skip "plow-credentials not present" "run ./scripts/install.sh"
fi

sect "The image"
# Capture the build's own output. Swallowing it and printing a generic "fix"
# line is worse than no check: the reader cannot tell a network failure from a
# broken Dockerfile, and both look identical.
build_log=$(mktemp 2>/dev/null || echo /tmp/openplow-build.$$)
if docker build -q -t "$IMG" "$ROOT" >"$build_log" 2>&1; then
  pass "docker build succeeds"
  BUILD_OK=1
else
  BUILD_OK=0
  fail "docker build failed" "the last lines of the build are below"
  printf '        %s' "$DIM"; sed 's/^/        /' "$build_log" | tail -15; printf '%s' "$OFF"
fi
rm -f "$build_log" 2>/dev/null

BUILD_OK="${BUILD_OK:-0}"

# ------------------------------------------------------------------ 5. probe
if docker image inspect "$IMG" >/dev/null 2>&1; then
  # Captured, not piped into `grep -q`. `grep -q` exits the moment it matches
  # and closes the pipe, the probe takes SIGPIPE, and `pipefail` — which this
  # script sets — turns a passing probe into a failing check. Whether it fires
  # is a race, which is worse than a consistent answer.
  probe_out=$(docker run --rm --network none "$IMG" /opt/plow/probe 2>&1)
  if grep -q PLOW_PROBE_OK <<<"$probe_out"; then
    pass "offline boot probe returns PLOW_PROBE_OK"
  else
    fail "the boot probe did not return PLOW_PROBE_OK" "docker run --rm --network none $IMG /opt/plow/probe"
    printf '        %s' "$DIM"; tail -5 <<<"$probe_out" | sed 's/^/        /'; printf '%s' "$OFF"
  fi

  sect "What the image actually contains"
  skills=$(docker run --rm --network none "$IMG" ls -1 /opt/plow/skills 2>/dev/null | tr '\n' ' ')
  want="case-workflow google-workspace knowledge-base owners-mac support-desk "
  if [[ "$skills" == "$want" ]]; then pass "the five skills, including durable case workflow"
  else fail "skills are '$skills'" "we need: $want  — a skills/skills nesting is a SILENT failure"; fi

  docker run --rm --network none "$IMG" test -e /opt/plow/skills/skills 2>/dev/null \
    && fail "skills are nested under skills/skills" "fix Dockerfile:41 — the trailing slash in COPY skills/ /opt/plow/skills/ is load-bearing" \
    || pass "no skills/skills nesting"

  first=$(docker run --rm --network none "$IMG" head -1 /opt/plow/prompt/AGENTS.md 2>/dev/null)
  if [[ "$first" == "# OpenPlow Frontline" ]]; then
    pass "our Frontline persona replaced the base's"
  else
    fail "persona first line is '$first'" "it should be '# OpenPlow Frontline' - check prompt/AGENTS.md"
  fi

  # Identity is a product claim, so it is asserted rather than assumed. A
  # regression here re-brands the agent as someone else's support desk, on a
  # page the owner does not edit by hand.
  if docker run --rm --network none "$IMG" grep -qE 'You are not Plow' /opt/plow/prompt/AGENTS.md; then
    pass "the persona disclaims Plow affiliation"
  else
    fail "the persona does not disclaim Plow affiliation" "prompt/AGENTS.md must say the agent is not Plow"
  fi

  if docker run --rm --network none "$IMG" printenv AGENT_NAME 2>/dev/null | grep -q '^OpenPlow Support$'; then
    pass "AGENT_NAME is 'OpenPlow Support'"
  else
    fail "AGENT_NAME is not 'OpenPlow Support'" "it is published to the Agent Index - check Dockerfile:22"
  fi

  rt=$(docker run --rm --network none "$IMG" printenv AGENT_RUNTIME 2>/dev/null)
  [[ -n "$rt" ]] && pass "AGENT_RUNTIME is '$rt'" \
    || fail "AGENT_RUNTIME is empty" "the base predates d78e4ea. Re-pin Dockerfile:12 — tag and digest together"

  seedin=$(docker run --rm --network none "$IMG" test -e /opt/plow/seed 2>/dev/null && echo yes || echo no)
  [[ "$seedin" == "no" ]] && pass "seed/ is correctly NOT in the image (it is vault content)" \
    || fail "seed/ shipped inside the image" "it belongs in the vault volume, not in the container"

  # The vault is the deployment's own now, so the image has to carry the tool
  # that maintains it. If this fails, the base bump is fine and our build is
  # not — the `ARG PLOW_WIKI_REF` install did not land.
  if docker run --rm --network none "$IMG" sh -c 'command -v wiki' >/dev/null 2>&1; then
    pass "the wiki CLI is in the image, on PATH for the agent"
  else
    fail "no wiki CLI in the image" "the plow-wiki install in the Dockerfile did not land"
  fi

  wiki_path=$(docker run --rm --network none "$IMG" printenv WIKI_PATH 2>/dev/null)
  if [ "$wiki_path" = "/data/wiki" ]; then
    pass "WIKI_PATH is /data/wiki — one source of truth for the vault"
  else
    fail "WIKI_PATH is '${wiki_path:-unset}'" "it should be /data/wiki, and only the Dockerfile should set it"
  fi

  # Root-owned on purpose: it is what makes canonical knowledge unwritable by
  # the agent. scripts/verify-wiki.sh proves the whole contract; this is the
  # one-line version that runs on every build.
  data_owner=$(docker run --rm --network none "$IMG" stat -c '%U' /data/wiki 2>/dev/null)
  if [ "$data_owner" = "root" ]; then
    pass "/data/wiki is root-owned, so the agent cannot write canonical pages"
  else
    fail "/data/wiki is owned by '${data_owner:-unknown}'" "it must be root-owned - that is the write boundary"
  fi

  for s in wiki-bootstrap wiki-refresh wiki-import wiki-peek; do
    if docker run --rm --network none "$IMG" test -x "/opt/plow/bin/$s" 2>/dev/null; then
      pass "bin/$s is present and executable"
    else
      fail "bin/$s is missing" "the bin/ directory did not get copied into the image"
    fi
  done

  # Not run directly, but if it is missing the other four fail on their first
  # line — better to name the file that is absent.
  if docker run --rm --network none "$IMG" test -f /opt/plow/bin/wiki-ownership.sh 2>/dev/null; then
    pass "bin/wiki-ownership.sh is present"
  else
    fail "bin/wiki-ownership.sh is missing" "the bin/ directory did not get copied into the image"
  fi

  # The volume is what makes knowledge outlive the container. A compose file
  # that lost it is a silent downgrade, not an error.
  if grep -qE '^[[:space:]]*-[[:space:]]*wiki:/data' "$ROOT/compose.yml" 2>/dev/null; then
    pass "compose.yml mounts the wiki volume at /data"
  else
    fail "compose.yml does not mount the wiki volume" "knowledge would not survive the container"
  fi
fi

# --------------------------------------------------------- 5b. the guard
# The rulebook has a test suite; a guard whose rules rot silently is a guard
# that stops working before anyone notices. Node is not in the base, so this
# runs against the host's — the same file the image ships, from the repo.
sect "Infrastructure guard"
if [[ -d "$ROOT/plugin/infra-guard" ]]; then
  if docker run --rm --network none "$IMG" test -f /app/dist/extensions/infra-guard/index.js 2>/dev/null; then
    pass "infra-guard is inside the image, where the base's boot will find it"
  else
    fail "infra-guard is not at /app/dist/extensions/infra-guard/" "the COPY in the Dockerfile is missing or the path is wrong"
  fi
  if docker run --rm --network none "$IMG" test -f /app/dist/extensions/infra-guard/openclaw.plugin.json 2>/dev/null; then
    pass "infra-guard ships the manifest that enables it without config"
  else
    fail "infra-guard/openclaw.plugin.json is missing" "the plugin cannot be discovered without it"
  fi

  if docker run --rm --network none "$IMG" test -f /app/dist/extensions/case-workflow/index.js 2>/dev/null \
    && docker run --rm --network none "$IMG" test -f /app/dist/extensions/case-workflow/openclaw.plugin.json 2>/dev/null; then
    pass "case-workflow plugin and manifest are inside the image"
  else
    fail "case-workflow plugin is missing" "copy plugin/case-workflow/ to /app/dist/extensions/case-workflow/"
  fi
  if docker run --rm --network none --tmpfs /var/lib/plow --entrypoint node "$IMG" \
      /app/openclaw.mjs plugins list 2>/dev/null | grep -q 'stock:case-workflow/index.js'; then
    pass "the Gateway discovers case-workflow by itself"
  else
    fail "the Gateway does not discover case-workflow" "check its manifest and COPY path"
  fi
  # Discovery, not a cache file. The base scans /app/dist/extensions/ at boot,
  # and /var/lib/plow is the state volume — so a registry cache written at
  # build time is masked before the Gateway starts. Check the thing that
  # actually has to work, with the state path masked so a cached copy cannot
  # make it look like it does.
  if docker run --rm --network none --tmpfs /var/lib/plow --entrypoint node "$IMG" \
      /app/openclaw.mjs plugins list 2>/dev/null | grep -q 'stock:infra-guard/index.js'; then
    pass "the Gateway discovers infra-guard by itself, with no cached registry"
  else
    fail "the Gateway does not discover infra-guard" "check the COPY path and the manifest's enabledByDefault"
  fi
  if command -v node >/dev/null 2>&1; then
    if (cd "$ROOT" && node --test test/ >/dev/null 2>&1); then
      pass "guard and durable-case tests pass"
    else
      fail "repository tests fail" "cd $ROOT && node --test test/"
    fi
  else
    skip "node is not on the host" "the rules run inside the Gateway; check them with: node --test test/"
  fi
else
  fail "plugin/infra-guard/ is missing" "the agent has no in-container enforcement channel"
fi

# ---------------------------------------------------------------- 6. the seed
sect "Knowledge base"
n=$(find "$ROOT/seed" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
if [[ "$n" -gt 0 ]]; then pass "seed/ carries $n pages, ready to import into the vault"
else fail "seed/ is empty" "git clone should have brought it; check .gitattributes is not excluding *.md"; fi

# ------------------------------------------------------------------ 7. live
sect "Running agent"
if docker compose -f "$ROOT/compose.yml" ps --status running --services 2>/dev/null | grep -qx agent; then
  pass "container is running"
  logs=$(docker compose -f "$ROOT/compose.yml" logs agent 2>/dev/null | tail -40)
  grep -q "plow-boot: identity resolved" <<<"$logs" \
    && pass "boot resolved an identity and started the gateway" \
    || skip "no boot line in the last 40 log lines" "docker compose logs -f agent"
else
  skip "the agent is not running" "start it with ./scripts/install.sh"
fi

# ----------------------------------------------------------------- summary
printf '\n%s─────────────────────────────────────────%s\n' "$DIM" "$OFF"
if [[ "$FAIL" -eq 0 ]]; then
  printf '%s  %d passed%s' "$GRN" "$PASS" "$OFF"
  [[ "$SKIP" -gt 0 ]] && printf ', %d skipped' "$SKIP"
  printf '\n\n  The build is sound. Next:\n'
  printf '    1. optionally configure Gatekeeper for the Investigator Latch workflow\n'
  printf '       (Frontline and Curator are MCP-denied; see SECURITY.md)\n'
  printf '    2. seed the vault — ./scripts/seed-vault.sh\n'
  printf '    3. run ./scripts/verify-organization.sh and ./scripts/verify-wiki.sh\n'
  printf '    4. text the line and ask a wiki-backed question\n'
  printf '       "why can'"'"'t you just fix the page yourself?"\n'
else
  printf '%s  %d passed, %d failed%s\n' "$RED" "$PASS" "$FAIL" "$OFF"
  [[ "$SKIP" -gt 0 ]] && printf '  %d skipped\n' "$SKIP"
  printf '\n  Fix the failures above, then run this again.\n'
fi
exit $([[ "$FAIL" -eq 0 ]] && echo 0 || echo 1)
