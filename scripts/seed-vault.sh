#!/usr/bin/env bash
# Put a knowledge base under the agent — either the one this repo ships, or
# your own.
#
#   ./scripts/seed-vault.sh                    # the pages this repo ships
#   ./scripts/seed-vault.sh --from ~/my-vault  # a wiki you already have
#   ./scripts/seed-vault.sh --check            # report, change nothing
#   ./scripts/seed-vault.sh --force            # overwrite pages already there
#
# WHERE THE VAULT IS. It is the deployment's, not the Mac's: the `openplow-wiki`
# Docker volume, mounted at /data in the container, with WIKI_PATH pointing into
# it. That is why this script is a `docker run` and not a `cp`. Seeding is
# knowledge arriving with the deployment, and it should not depend on whether a
# particular laptop is awake.
#
# SAFE BY DEFAULT. A page that is already in the vault is not overwritten
# without --force, because the vault is shared organizational knowledge and a
# team edits it. --check tells you what would change first.
#
# MIGRATING FROM THE OLD MAC VAULT. An existing ~/Plow/wiki is not abandoned,
# and nothing here deletes it:
#
#   ./scripts/seed-vault.sh --from ~/Plow/wiki --force
#
# That copies the pages in, validates, indexes and snapshots them, and the
# import becomes the first commit of the new history. The old ~/Plow/wiki.git
# stays on the Mac as a record of where the knowledge came from. See INSTALL.md.
#
# NO `wiki` BINARY NEEDED ON THE HOST. The CLI runs inside the image, so this
# works the same on a machine that has never had plow-wiki installed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=./lib.sh
source "$ROOT/scripts/lib.sh"

FROM="$ROOT/seed"
MODE="seed"
FORCE=0
CHECK=0

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; OFF=$'\033[0m'
[ -t 1 ] || { BOLD=""; DIM=""; RED=""; GRN=""; YLW=""; OFF=""; }

step() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$OFF"; }
note() { printf '%s    %s%s\n' "$DIM" "$1" "$OFF"; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$OFF" "$1" >&2; exit 1; }
ok()   { printf '%s  ok%s  %s\n' "$GRN" "$OFF" "$1"; }
warn() { printf '%s warn%s  %s\n' "$YLW" "$OFF" "$1"; }

usage() { sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)   MODE="import"; FROM="${2:?--from needs a directory}"; shift 2 ;;
    --check)  CHECK=1; shift ;;
    --force)  FORCE=1; shift ;;
    -h|--help) usage ;;
    *) die "unknown option: $1  (try --help)" ;;
  esac
done

command -v docker >/dev/null || die "Docker is required. Install Docker Desktop and start it."
[[ -d "$FROM" ]] || die "no such directory: $FROM
For the bundled pages that is $ROOT/seed — is the repository complete?"

COUNT="$(find "$FROM" -name '*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
[[ "$COUNT" -gt 0 ]] || die "no markdown under $FROM — nothing to copy."

# A vault is not a folder of markdown. These are what `wiki init` creates and
# what the roots are declared against, so their absence is the difference
# between "the agent has a knowledge base" and "the agent has notes it cannot
# structure". The bundled seed is pages-only by design — the structure comes
# from `wiki init`, which runs in the container.
MISSING=()
for want in AGENTS.md wiki.toml _raw; do
  [[ -e "$FROM/$want" ]] || MISSING+=("$want")
done

# ---------------------------------------------------------------- what is there
step "Where things stand"
note "volume: $OPENPLOW_VOLUME  (mounted at $OPENPLOW_MOUNT)"

EXISTING="$(openplow_wiki_run /opt/plow/bin/wiki-peek 2>/dev/null || true)"
if [[ -z "$EXISTING" ]]; then
  note "no vault yet — this will create one"
else
  note "$EXISTING"
fi

if [[ "$MODE" == "import" && ${#MISSING[@]} -eq 0 ]]; then
  note "the source looks like a complete wiki (AGENTS.md, wiki.toml, _raw present)"
fi
if [[ "$MODE" == "import" && ${#MISSING[@]} -gt 0 ]]; then
  warn "the source is pages only: ${MISSING[*]}"
  note "that is fine — the structure is created in the container, and the import"
  note "will be validated against it. If validation fails, the source was not a wiki."
fi

note "$COUNT pages in $FROM"
if [[ "$FORCE" -eq 0 && "$CHECK" -eq 0 ]]; then
  note "existing pages are left alone; pass --force to overwrite, --check to preview"
fi

if [[ "$CHECK" -eq 1 ]]; then
  step "Check"
  openplow_wiki_import "$FROM" "$FORCE" --check \
    || die "the check could not run"
  ok "nothing was changed"
  exit 0
fi

# ----------------------------------------------------------------------- copy
step "Importing"
openplow_ensure_image || die "the image did not build. Try:  docker build -t $OPENPLOW_IMAGE ."

openplow_wiki_import "$FROM" "$FORCE" \
  || die "the import failed. Nothing was promoted; the vault is as it was."

# ---------------------------------------------------------------------- report
step "After"
openplow_wiki_run /opt/plow/bin/wiki-peek || true

cat <<EOF

${BOLD}next${OFF}

  ${BOLD}See what is in there${OFF} — including candidates the agent has filed:

      docker run --rm --user root -v $OPENPLOW_VOLUME:$OPENPLOW_MOUNT \\
        $OPENPLOW_IMAGE /opt/plow/bin/wiki-peek

  ${BOLD}Promote a candidate${OFF} — move it out of _raw/ into the right root by
  hand, then refresh, from the repository root:

      docker compose run --rm --user root agent /opt/plow/bin/wiki-refresh

  The agent cannot do that step. It is not allowed to write canonical pages, and
  that refusal is the design rather than a fault to report.

  ${BOLD}Re-run this script${OFF} to add updated pages later. It will not overwrite
  what is already there without --force, and --check shows you what would change.
EOF
