#!/usr/bin/env bash
# Provision and start OpenPlow Support.
#
#   ./scripts/install.sh                 # first free Plow line, no questions
#   ./scripts/install.sh --line Willow   # a dashboard name, or a uid (ln_p1)
#   ./scripts/install.sh --new-line      # provision ANOTHER line (asks the phone)
#
# Non-interactive apart from one step. `plow login` needs a phone: it prints a
# destination number and a `Plow Activate` code, you relay them by SMS, and the
# script carries on by itself. That is the only place a human is required, and
# it is Plow's step, not ours.
#
# It will not create a second line unless you pass --new-line, and it will not
# mint a line that already has an assistant.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/lib.sh"

CREDENTIALS="$ROOT/plow-credentials"
# Never inherited from the host: the base's reporter reads this, and a value
# leaking in would file this agent's usage under somebody else's entry.
AGENT_ID="openplow-support"
export AGENT_ID

LINE=""
NEW_LINE=0

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'; OFF=$'\033[0m'
[ -t 1 ] || { BOLD=""; DIM=""; RED=""; GRN=""; OFF=""; }
step() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$OFF"; }
note() { printf '%s    %s%s\n' "$DIM" "$1" "$OFF"; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$OFF" "$1" >&2; exit 1; }
ok()   { printf '%s  ok%s  %s\n' "$GRN" "$OFF" "$1"; }

usage() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --line)     LINE="${2:-}"; [[ -n "$LINE" ]] || die "--line needs a name or a uid."; shift 2 ;;
    --line=*)   LINE="${1#*=}"; shift ;;
    --new-line) NEW_LINE=1; shift ;;
    -h|--help)  usage ;;
    -*)         die "unknown option: $1  (try --help)" ;;
    *)
      [[ -n "$LINE" ]] && die "unexpected argument: $1"
      LINE="$1"; shift ;;
  esac
done

command -v docker >/dev/null || die "Docker is required. Install Docker Desktop and start it."

# ── preflight ─────────────────────────────────────────────────────────────────
# Everything that can be wrong before the owner is asked for an SMS, asked now.
# The credential check is the important one: plow-agents will not write a token
# it cannot make 0600, and on Windows it cannot, so without this check the
# script dies ninety seconds in — after they have already texted a code.
step "Preflight"
if [[ -z "$(openplow_python)" ]]; then
  die "no working Python. This needs python3 (macOS ships it) or python.
On Windows: install Python, or run this from WSL — see INSTALL.md."
fi
ok "python: $(openplow_python)"

if [[ ! -f "$CREDENTIALS" ]] && ! openplow_can_store_credential; then
  die "this filesystem cannot store a 0600 file, so plow-agents will refuse to
write your token — but only AFTER you have sent the activation SMS.

  Windows: NTFS reports every file as 0777, so this is expected there.
  Run this script from WSL instead, where the filesystem is POSIX:

      wsl
      cd $(printf '%s' "$ROOT" | sed 's|^/mnt/|/mnt/|')
      ./scripts/install.sh

  In Docker Desktop, turn on Settings > Resources > WSL Integration first, so
  the WSL shell can reach docker. Nothing is installed yet; re-run is safe."
fi

# ── the CLI ───────────────────────────────────────────────────────────────────
step "Plow CLI"
openplow_ensure_cli || die "could not clone plow-agents"
ok "plow-agents at .tools/plow-agents"

# TSV: uid, name, number, status ("free", or the agent uid once taken).
lines_tsv() { openplow_plow lines 2>/dev/null | awk -F '\t' 'NR > 1 && NF >= 4 { print }'; }
lower()     { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

print_free_names() {
  local count=0
  while IFS=$'\t' read -r _uid name _number status; do
    [[ "$status" == "free" ]] || continue
    printf '    %s\n' "$name"; count=$((count + 1))
  done < <(lines_tsv)
  [[ "$count" -eq 0 ]] && printf '    (none)\n'
  return 0
}

occupied_names() {
  local names=()
  while IFS=$'\t' read -r _uid name _number status; do
    [[ "$status" == "free" ]] || names+=("$name")
  done < <(lines_tsv)
  ((${#names[@]})) && { local IFS=', '; printf '%s' "${names[*]}"; }
}

# Dashboard name, uid, or a 1-based index into the free list.
resolve_line() {
  local query="$1" q; q="$(lower "$query")"
  local uid name number status i=0
  while IFS=$'\t' read -r uid name number status; do
    if [[ "$q" == "$(lower "$uid")" || "$q" == "$(lower "$name")" ]]; then
      printf '%s\t%s\t%s\t%s\n' "$uid" "$name" "$number" "$status"; return 0
    fi
  done < <(lines_tsv)
  [[ "$query" =~ ^[0-9]+$ ]] || return 1
  while IFS=$'\t' read -r uid name number status; do
    [[ "$status" == "free" ]] || continue
    i=$((i + 1))
    if [[ "$i" == "$query" ]]; then
      printf '%s\t%s\t%s\t%s\n' "$uid" "$name" "$number" "$status"; return 0
    fi
  done < <(lines_tsv)
  return 1
}

# ── the credential the container boots holding ────────────────────────────────
# docker turns a missing bind-mount path into a directory, after which mint
# cannot write the file and the container boots with no token.
if [[ -d "$CREDENTIALS" ]]; then
  if [[ -n "$(find "$CREDENTIALS" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    die "plow-credentials is a non-empty directory.
Docker ran before mint. Move it aside:  mv plow-credentials plow-credentials.stale"
  fi
  note "removing the empty plow-credentials directory docker left behind"
  rmdir "$CREDENTIALS"
fi

if [[ -f "$CREDENTIALS" ]]; then
  step "Credentials"
  ok "plow-credentials already exists — skipping login and mint"
else
  # ------------------------------------------------------------------ login
  step "Sign in to Plow"
  if [[ -s "$OPENPLOW_TOKEN" ]]; then
    ok "account token found — skipping the phone step"
  else
    cat <<EOF
${BOLD}    This is the one step that needs a person.${OFF}

    Keep this window open. plow-agents will print two lines:

        Plow Activate: <code>
        <destination number>

    Text both to Plow. Then wait here for the owner to reply:

        feito

    and this script continues on its own.
EOF
    if [[ "$NEW_LINE" -eq 1 ]]; then
      openplow_plow login --new-line || die "login failed. Re-run when you are ready."
    else
      openplow_plow login || die "login failed. Re-run when you are ready."
    fi
    ok "signed in"
  fi

  # ------------------------------------------------------------------ lines
  step "Plow line"
  line_count=$(lines_tsv | awk 'END { print NR+0 }')

  if [[ "$line_count" -eq 0 ]]; then
    note "this account has no line yet — normal on a first install."
    note "creating the first one; a second SMS will print. Relay it the same way."
    openplow_plow login --new-line || die "could not create the first line."
  elif [[ "$NEW_LINE" -eq 0 && -z "$(lines_tsv | awk -F '\t' '$4=="free"' | head -1)" ]]; then
    printf '\n    Every line on this account already has an assistant.\n' >&2
    local_taken="$(occupied_names)"
    [[ -n "$local_taken" ]] && printf '    Already assigned: %s\n' "$local_taken" >&2
    printf '    Free one in Plow, or ask for another line:  %s --new-line\n' "$0" >&2
    die "no free line to mint. Not creating one on my own — that is your call."
  fi

  if [[ -z "$LINE" ]]; then
    LINE="$(lines_tsv | awk -F '\t' '$4 == "free" && $2 != "" { print $2 }' | LC_ALL=C sort | head -n 1)"
    [[ -n "$LINE" ]] || die "still no free line. Free one in Plow, or re-run with --new-line."
    note "free lines on this account:"
    print_free_names
    note "using $LINE. Pass --line NAME to pick another."
  fi

  resolved="$(resolve_line "$LINE" || true)"
  [[ -n "$resolved" ]] || { printf '\n    Free lines:\n' >&2; print_free_names >&2; die "no line matching '$LINE'."; }

  IFS=$'\t' read -r uid name number status <<<"$resolved"
  [[ "$status" == "free" ]] || die "$name already has an assistant ($status).
Free a line in Plow, or pass --line with a different one."

  note "minting $name  ($uid, $number)"
  openplow_plow mint "$uid" || die "mint failed."
  ok "minted $name — $number"
fi

[[ -f "$CREDENTIALS" ]] || die "plow-credentials is still missing after mint. Re-run this script."

# ─────────────────────────────────────────────────────────────── start + seed
# The wiki volume is `external` (see compose.yml) so that `compose down -v`
# can never delete organizational knowledge, and so the maintenance scripts can
# reach it without compose. That means compose will not create it — we do,
# once, and idempotently.
docker volume create "$OPENPLOW_VOLUME" >/dev/null 2>&1 \
  || die "could not create the $OPENPLOW_VOLUME volume. Is Docker running?"
step "Start the agent"
docker compose -f "$ROOT/compose.yml" up --build -d \
  || die "docker compose failed. Try:  docker compose logs agent"
ok "container started"
# Idempotent: it adds what is missing and never overwrites an existing page
# without --force, so running it on a re-install is safe and does nothing.
if "$ROOT/scripts/seed-vault.sh" >/dev/null; then
  ok "knowledge base seeded into the $OPENPLOW_VOLUME volume"
else
  die "seeding the knowledge base failed. Re-run:  ./scripts/seed-vault.sh"
fi

cat <<EOF

${BOLD}==== tell the owner, both lines, in this turn ====${OFF}

EOF
# A dedicated script, so the number is resolved from the credential rather than
# from a variable that happened to be in scope. It never guesses.
if ! "$ROOT/scripts/announce-line.sh"; then
  cat >&2 <<EOF
${BOLD}    Could not name the line.${OFF} Do not make the owner guess which
    number to text. Say the install is not finished, and re-run install.sh.
EOF
fi

cat <<EOF

${BOLD}==== next ====${OFF}

  ${BOLD}Gatekeeper instructions${OFF} — paste LATCH-RULES.md into Latch's
  Gatekeeper card > Instructions, on the Audit tab. It governs what the agent
  may do on YOUR Mac; the knowledge base does not go through it.

  Then check it:
      ./scripts/verify.sh          the image
      ./scripts/verify-wiki.sh     persistence and the write boundary
EOF
