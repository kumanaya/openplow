#!/usr/bin/env bash
# Print the Plow line this checkout is on: the dashboard name and the phone
# number. Nothing else, and never a guess.
#
#   ./scripts/announce-line.sh
#
# Installing agents must relay both to the owner in the same turn. An owner who
# has to work out which number to text has not been installed anything.
#
# How it resolves: `plow mint` writes a `# plow-agent-uid:` comment into
# plow-credentials. That uid is matched against the STATUS column of
# `plow-agents lines`, which is the only place the name and number appear.
#
# It never prints the token or the contents of plow-credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/lib.sh"
CREDENTIALS="$ROOT/plow-credentials"
TOOLS="$ROOT/.tools/plow-agents"
TOKEN_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/plow/token"

usage() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

if [[ ! -f "$CREDENTIALS" ]]; then
  echo "announce-line: no plow-credentials. The line is not signed in." >&2
  echo "announce-line: tell the owner the install is not done, and that they" >&2
  echo "               re-run scripts/install.sh. Do not guess a number." >&2
  exit 1
fi

uid="$(sed -n 's/^# plow-agent-uid:[[:space:]]*//p' "$CREDENTIALS" | head -n 1)"
uid="${uid%"${uid##*[![:space:]]}"}"
if [[ -z "$uid" ]]; then
  echo "announce-line: plow-credentials has no # plow-agent-uid comment." >&2
  echo "announce-line: tell the owner you could not name the line. Do not guess." >&2
  exit 1
fi

if [[ ! -s "$TOKEN_FILE" ]]; then
  echo "announce-line: no Plow account token at $TOKEN_FILE." >&2
  echo "announce-line: tell the owner you could not name the line. Do not guess." >&2
  exit 1
fi

if [[ ! -d "$TOOLS/.git" ]]; then
  mkdir -p "$(dirname "$TOOLS")"
  git clone --depth 1 https://github.com/plow-pbc/plow-agents.git "$TOOLS" >/dev/null
fi

# TSV: uid, name, number, status — and status is the agent uid once a line is
# taken, which is what we match. The full table is NOT printed: other lines on
# the account are not this agent, and showing them invites the owner to text
# someone else's number.
matched=0
while IFS=$'\t' read -r _uid name number status; do
  [[ "$status" == "$uid" ]] || continue
  echo "announce-line: dashboard name: $name"
  echo "announce-line: text this number: $number"
  echo "announce-line: give the owner both in this turn. They text that number."
  matched=1
  break
done < <(openplow_plow lines 2>/dev/null | awk -F '\t' 'NR > 1 && NF >= 4 { print }')

if [[ "$matched" -ne 1 ]]; then
  echo "announce-line: this credential did not match any dashboard line." >&2
  echo "announce-line: tell the owner you could not name the line. Do not guess." >&2
  echo "announce-line: run 'plow-agents lines' and match STATUS to the uid in" >&2
  echo "               plow-credentials. Never print the token." >&2
  exit 1
fi
