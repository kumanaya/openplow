#!/usr/bin/env bash
# Exercise the exact native OpenClaw multi-agent patch against a clean offline
# Plow bootstrap. Scratch volumes are deleted on exit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMG="${1:-${IMG:-openplow-support:verify}}"
STATE_VOLUME="openplow-org-verify-state-$$"
INCLUDE_VOLUME="openplow-org-verify-includes-$$"

cleanup() {
  docker volume rm -f "$STATE_VOLUME" "$INCLUDE_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker image inspect "$IMG" >/dev/null 2>&1; then
  docker build -t "$IMG" "$ROOT"
fi

docker volume create "$STATE_VOLUME" >/dev/null
docker volume create "$INCLUDE_VOLUME" >/dev/null

probe() {
  docker run --rm --network none \
    -v "$STATE_VOLUME:/var/lib/plow" \
    -v "$INCLUDE_VOLUME:/etc/plow/openclaw" \
    "$IMG" /opt/plow/probe 2>&1
}

first_probe="$(probe)"
grep -q 'PLOW_PROBE_OK' <<<"$first_probe"

docker run --rm --network none \
  -v "$STATE_VOLUME:/var/lib/plow" \
  -v "$INCLUDE_VOLUME:/etc/plow/openclaw" \
  "$IMG" /opt/plow/bin/openplow-configure-organization

docker run --rm --network none \
  -v "$STATE_VOLUME:/var/lib/plow" \
  -v "$INCLUDE_VOLUME:/etc/plow/openclaw" \
  --entrypoint openclaw "$IMG" config validate

agents="$(docker run --rm --network none \
  -v "$STATE_VOLUME:/var/lib/plow" \
  -v "$INCLUDE_VOLUME:/etc/plow/openclaw" \
  --entrypoint openclaw "$IMG" agents list)"
for agent in main investigator curator; do
  grep -q -- "- $agent" <<<"$agents"
done

second_probe="$(probe)"
grep -q 'PLOW_PROBE_OK' <<<"$second_probe"
printf 'OPENPLOW_ORGANIZATION_VERIFY_OK: main, investigator, curator configured and booted\n'
