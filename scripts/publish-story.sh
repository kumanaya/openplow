#!/usr/bin/env sh
# Publish a task story to the Agent Index page.
#
# The client is NOT downloaded here. The base image already carries it at a
# pinned commit, checksum-verified at build, and this script runs that copy
# inside the running container. Downloading a second copy on the host would mean
# a second thing to pin, and the one that matters is the one that boots holding
# a live credential.
#
# HOME matters: the client keeps this install's report key and usage ledger
# under $HOME/.agent-index, and in this image HOME is the state volume
# (/var/lib/plow), not /home/node. Run it without the override and the client
# reads a store that is not there.
#
# Usage:
#   scripts/publish-story.sh --tags
#   scripts/publish-story.sh <slug> <title> <body> [tag]
#   scripts/publish-story.sh <slug> --delete
set -eu

# The one file the Index page is judged on. Reuse a tag that already exists:
# "Orders & returns" and "Order returns" split one bar in two.
client() {
  docker compose exec -T \
    -e HOME=/var/lib/plow \
    -e OPENCLAW_STATE_DIR=/var/lib/plow \
    agent python3 /opt/plow/agent-index-client.py "$@"
}

case "${1:-}" in
  --tags)
    client --tags
    ;;
  --help|-h|"")
    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

slug="$1"; shift

if [ "${1:-}" = "--delete" ]; then
  client --delete-story "$slug"
  exit $?
fi

if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then
  echo "usage: $0 <slug> <title> <body> [tag]" >&2
  exit 2
fi

title="$1"; shift
body="$1"; shift
# Captured into its own name BEFORE the `set --` below. Reading $1 after it
# would read the new $1, which is `--story`, and post that as the tag.
tag="${1:-}"

set -- --story "$slug" --title "$title" --body "$body"
if [ -n "$tag" ]; then
  set -- "$@" --tag "$tag"
fi

# Not `exec client ...`: exec takes a command, and a POSIX sh function is not
# one. Under dash — /bin/sh on most Linux hosts, which is what this shebang
# resolves to there — `exec client` fails with "exec: client: not found".
client "$@"
