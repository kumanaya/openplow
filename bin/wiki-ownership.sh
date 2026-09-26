#!/bin/sh
# Re-assert the ownership contract for the vault.
#
# This is the only place that knows the arrangement, and it runs on every
# maintenance pass so an import cannot quietly widen it. The contract:
#
#   /data            root   r-x   the agent cannot add siblings
#   $WIKI_PATH/**    root   r-x   the agent READS canonical knowledge and
#   (canonical)            r--   cannot write, delete, rename or chmod it
#   $WIKI_PATH/_raw  agent  rwx   the ONE place the agent may write
#   $WIKI_PATH.git   root   r-x   history is evidence, not the agent's to edit
#
# Enforced by the filesystem, so it holds against a misbehaving agent with a
# shell — not against a well-behaved one obeying the persona. See SECURITY.md.
set -eu

: "${WIKI_PATH:=/data/wiki}"

# The agent is whoever the image runs as. Resolved rather than hardcoded, so a
# base bump that changes the uid does not silently make _raw unwritable.
AGENT_USER="${OPENPLOW_AGENT_USER:-node}"
AGENT_UID="${OPENPLOW_AGENT_UID:-$(id -u "$AGENT_USER" 2>/dev/null || echo 1000)}"
AGENT_GID="${OPENPLOW_AGENT_GID:-$(id -g "$AGENT_USER" 2>/dev/null || echo 1000)}"

parent=$(dirname "$WIKI_PATH")
[ "$parent" = "$WIKI_PATH" ] && parent=/

chown root:root "$parent" "$WIKI_PATH"
chmod 755 "$parent" "$WIKI_PATH"

# Everything under the vault is root-owned and world-readable EXCEPT _raw, which
# the agent owns. -prune stops the walk descending into the inbox.
find "$WIKI_PATH" -path "$WIKI_PATH/_raw" -prune -o -type d -exec chmod 755 {} +
find "$WIKI_PATH" -path "$WIKI_PATH/_raw" -prune -o -type f -exec chmod 644 {} +
chown -R root:root "$WIKI_PATH"
chown -R root:root "$WIKI_PATH"/* 2>/dev/null || true

mkdir -p "$WIKI_PATH/_raw"
chown "$AGENT_UID:$AGENT_GID" "$WIKI_PATH/_raw"
chmod 755 "$WIKI_PATH/_raw"

# History lives BESIDE the vault, inside the same volume. Same rule: readable,
# never writable by the agent.
if [ -d "$WIKI_PATH.git" ]; then
  chown -R root:root "$WIKI_PATH.git"
  find "$WIKI_PATH.git" -type d -exec chmod 755 {} +
  find "$WIKI_PATH.git" -type f -exec chmod 644 {} +
fi
