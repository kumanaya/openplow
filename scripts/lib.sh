#!/usr/bin/env bash
# Facts more than one script needs to agree on. Sourced, never executed.
#
#   . "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
#
# The image tag and the volume name are here because getting either wrong
# produces a script that appears to work against the wrong vault. compose.yml
# carries the same volume name next to its declaration.
#
# Every container path here is a POSIX path INSIDE the container —
# `/opt/plow/bin/wiki-peek`, `/data/wiki`. Git Bash on Windows rewrites any
# argument that looks like a leading-slash path into a Windows one before the
# process ever sees it, so `/opt/plow/bin/wiki-peek` arrives as
# `C:/Program Files/Git/opt/plow/bin/wiki-peek` and the container dies with
# "exec ... failed: No such file or directory". The error names a file that
# does not exist, so it reads as a broken image rather than a mangled argument.
#
# One variable, set here because every docker call in the repository is either
# in this file or calls something in it. macOS and Linux ignore it.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

OPENPLOW_ROOT="${OPENPLOW_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Where the container mounts the volume. Must match WIKI_PATH in the Dockerfile.
OPENPLOW_MOUNT="${OPENPLOW_MOUNT:-/data}"

# The persistent volume holding organizational knowledge. Matches
# `volumes.wiki.name` in compose.yml. Override to run against a second
# deployment's knowledge, which is how verify-wiki.sh gets a scratch vault.
OPENPLOW_VOLUME="${OPENPLOW_VOLUME:-openplow-wiki}"

# The locally built image the maintenance commands run.
OPENPLOW_IMAGE="${OPENPLOW_IMAGE:-openplow-support:local}"

# Build the image if it is not there. Never rebuilds an existing one: a
# maintenance command should act on what is deployed, not silently upgrade it.
openplow_ensure_image() {
  if docker image inspect "$OPENPLOW_IMAGE" >/dev/null 2>&1; then
    return 0
  fi
  echo "building $OPENPLOW_IMAGE (first run only)..." >&2
  # Relative context, deliberately. An absolute path from `pwd` can be a path
  # the docker CLI cannot resolve — under WSL it is /mnt/c/... — and on macOS
  # it buys nothing. The context is always the repository.
  ( cd "$OPENPLOW_ROOT" && docker build -q -t "$OPENPLOW_IMAGE" . ) >/dev/null \
    || return 1
}

# Run a command as root against the vault volume. Root because every
# maintenance step is a canonical write, and the agent is not allowed to make
# one — see SECURITY.md.
#
#   openplow_wiki_run <script> [args...]
openplow_wiki_run() {
  docker run --rm --user root \
    -v "$OPENPLOW_VOLUME:$OPENPLOW_MOUNT" \
    "$OPENPLOW_IMAGE" "$@"
}

# Import a directory of pages into the vault, streaming them as a tar rather
# than bind-mounting a host path into the container. The daemon's idea of a
# host path is not the string the script has — under WSL it is a /mnt/c/...
# path, on macOS a /Users/... one — and getting that wrong fails in a way that
# looks like a Docker fault rather than a path fault.
#
#   openplow_wiki_import <dir> <force: 0|1> [--check]
openplow_wiki_import() {
  local dir="$1" force="$2" check="${3:-}"
  ( cd "$dir" && tar -cf - . ) \
    | docker run --rm -i --user root \
        -v "$OPENPLOW_VOLUME:$OPENPLOW_MOUNT" \
        "$OPENPLOW_IMAGE" /opt/plow/bin/wiki-import - "$force" $check
}

# The two compose volumes that hold container state, named by compose.yml. Both
# survive `down -v` on purpose, which is exactly what makes them outlive the
# container — and exactly what makes stale ownership survive an upgrade.
OPENPLOW_STATE_VOLUME="${OPENPLOW_STATE_VOLUME:-openplow-support_state}"
OPENPLOW_CONFIG_VOLUME="${OPENPLOW_CONFIG_VOLUME:-openplow-support_config}"

# Hand a volume to the user the image runs as.
#
# This image used to run as root, so on any deployment created before that was
# fixed every file in these volumes is root-owned. The boot now runs as `node`
# and cannot read its own configuration:
#
#   /var/lib/plow/openclaw.json  -> the container exits 1
#   /etc/plow/openclaw/gateway.json5 -> the boot parks and never serves
#
# Both read as a broken image rather than as stale ownership, which is why
# every symptom had to be chased twice.
#
# A FRESH volume needs none of this — it inherits `node:node` from the image's
# own directory, the same mechanism that makes /data safe. So this is a no-op
# on a new install and the one-time migration on an old one, which is why it
# is safe to run every time.
#
# The user is named rather than numbered so a drift from the Dockerfile's final
# `USER` shows up in the command rather than in a silent numeric mismatch.
openplow_ensure_volume_owner() { # <volume> <mountpoint>
  docker run --rm --user root \
    -v "$1:$2" \
    --entrypoint sh "$OPENPLOW_IMAGE" -c \
    "chown -R node:node '$2' 2>/dev/null || true"
}

openplow_ensure_state_owner() {
  openplow_ensure_volume_owner "$OPENPLOW_STATE_VOLUME" /var/lib/plow
  openplow_ensure_volume_owner "$OPENPLOW_CONFIG_VOLUME" /etc/plow/openclaw
}

# ── the Plow account CLI ──────────────────────────────────────────────────────
# One place that knows how to call plow-agents, because three scripts do and
# they must not disagree about the interpreter.
OPENPLOW_TOOLS="${OPENPLOW_TOOLS:-$OPENPLOW_ROOT/.tools/plow-agents}"
OPENPLOW_CLI="$OPENPLOW_TOOLS/bin/plow-agents"
OPENPLOW_TOKEN="${OPENPLOW_TOKEN:-${XDG_CONFIG_HOME:-$HOME/.config}/plow/token}"

# A working interpreter, whatever this machine calls it. macOS has python3;
# some Windows setups have only `python`; WSL has python3.
OPENPLOW_PYTHON=""
openplow_python() {
  if [[ -z "$OPENPLOW_PYTHON" ]]; then
    for candidate in python3 python; do
      if command -v "$candidate" >/dev/null 2>&1 \
         && "$candidate" -c 'import sys' >/dev/null 2>&1; then
        OPENPLOW_PYTHON="$candidate"
        break
      fi
    done
  fi
  printf '%s' "$OPENPLOW_PYTHON"
}

openplow_ensure_cli() {
  [[ -d "$OPENPLOW_TOOLS/.git" ]] && return 0
  mkdir -p "$(dirname "$OPENPLOW_TOOLS")"
  git clone --depth 1 https://github.com/plow-pbc/plow-agents.git "$OPENPLOW_TOOLS" >/dev/null
}

openplow_plow() {
  local py; py="$(openplow_python)"
  [[ -n "$py" ]] || { echo "openplow: no working python (tried python3, python)" >&2; return 1; }
  "$py" "$OPENPLOW_CLI" "$@"
}

# Whether this filesystem can hold a 0600 file.
#
# plow-agents refuses to write a credential it cannot make private, and on
# Windows it cannot — NTFS reports every file as 0777, so the check fails after
# the owner has already sent their activation SMS. That is the worst possible
# moment to discover it, so every provisioning script asks first, and says what
# to do about it, rather than finding out ninety seconds later.
openplow_can_store_credential() {
  "$(openplow_python)" - "$OPENPLOW_ROOT" <<'PY' >/dev/null 2>&1
import os, stat, sys, tempfile
directory = sys.argv[1]
try:
    fd, tmp = tempfile.mkstemp(dir=directory)
except OSError:
    sys.exit(1)
try:
    os.fchmod(fd, 0o600)
    os.close(fd)
    sys.exit(0 if stat.S_IMODE(os.stat(tmp).st_mode) == 0o600 else 1)
finally:
    try: os.unlink(tmp)
    except OSError: pass
PY
}
