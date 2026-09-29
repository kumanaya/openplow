#!/usr/bin/env sh
# Publish (or update) this agent's page on the Agent Index.
#
# This sends --runtime, which the base's own boot does not: that forwarder is not
# in any published base yet, so the container registers with --name and --blurb
# only and the page would fall back to the Index's Hermes placeholder. The
# client in this base does accept the flag, so registering once ourselves is the
# whole fix — after that the boot's `status` returns 0 and it never registers
# again. Re-running this is safe: it is the documented way to edit the page, and
# we own the slug. See SECURITY.md; re-check after any base bump.
#
# The client is NOT downloaded here. The base image carries it at a pinned
# commit, checksum-verified at build, and this runs that copy.
#
# HOME matters: the client keeps this install's report key and usage ledger under
# $HOME/.agent-index, and in this image HOME is the state volume, not
# /home/node. Without the override it reads a store that is not there.
#
# Usage:
#   scripts/register.sh                       # name, blurb and runtime only
#   AGENT_VIDEO=<youtube-id> scripts/register.sh
#   AGENT_LOGO=./logo.png AGENT_INSTALL_URL=https://… scripts/register.sh
set -eu

# The page content. Only what you set is sent: the Index leaves a field it is
# not given alone, so omitting one here never clears an edit you made there.
AGENT_SLUG="${AGENT_SLUG:-openplow-support}"
AGENT_NAME="${AGENT_NAME:-OpenPlow Support}"
AGENT_BLURB="${AGENT_BLURB:-OpenPlow answers customer questions from the product wiki and hands unanswered cases to the owner. The owner can separately connect an internal OpenClaw agent to Latch over MCP for authorized operations.}"

# Must match --video's expectation: a YouTube VIDEO ID, not a URL.
AGENT_VIDEO="${AGENT_VIDEO:-}"
AGENT_LOGO="${AGENT_LOGO:-}"
AGENT_INSTALL_URL="${AGENT_INSTALL_URL:-}"
AGENT_REPO="${AGENT_REPO:-https://github.com/kumanaya/openplow}"

client() {
  docker compose exec -T \
    -e HOME=/var/lib/plow \
    -e OPENCLAW_STATE_DIR=/var/lib/plow \
    agent python3 /opt/plow/agent-index-client.py "$@"
}

set -- --register --agent "$AGENT_SLUG" \
  --name "$AGENT_NAME" \
  --blurb "$AGENT_BLURB" \
  --repo "$AGENT_REPO" \
  --runtime OpenClaw

[ -n "$AGENT_VIDEO" ] && set -- "$@" --video "$AGENT_VIDEO"
[ -n "$AGENT_LOGO" ] && set -- "$@" --logo "$AGENT_LOGO"
[ -n "$AGENT_INSTALL_URL" ] && set -- "$@" --install-url "$AGENT_INSTALL_URL"

# The container must be up: this is its credential and its state volume.
if ! docker compose ps --status running --services 2>/dev/null | grep -qx agent; then
  echo "the agent is not running — 'docker compose up -d' first." >&2
  exit 1
fi

# Not `exec client ...`: exec takes a command, and a POSIX sh function is not
# one. Under dash — /bin/sh on most Linux hosts, which is what this shebang
# resolves to there — `exec client` fails with "exec: client: not found".
client "$@"
