# Install

OpenPlow needs Docker, `python3`, a Plow account with a support line, and a
POSIX filesystem for the credential file. On Windows, run the scripts from WSL
with Docker Desktop WSL integration enabled.

Latch and a Mac are optional. They are required only when the internal
Investigator must perform a real operator-authorized Mac-side workflow.

## Quick install

```sh
git clone https://github.com/kumanaya/openplow
cd openplow
./scripts/install.sh
```

The installer:

1. checks Docker, Python, and credential-file mode support;
2. clones `plow-agents`, logs in through its one SMS activation step, and mints
   the first free line unless told otherwise;
3. creates the external `openplow-wiki` volume and starts Compose;
4. waits for the base to render its owned OpenClaw configuration;
5. runs `bin/openplow-configure-organization`, which creates the Frontline,
   Investigator, and Curator native agent entries, then restarts the Gateway;
6. seeds the wiki without overwriting existing canonical pages.

Re-running the installer is safe: it reuses an existing credential, applies the
organization configuration again, and only imports missing seed pages.

```sh
./scripts/install.sh --line Willow   # select a specific free line
./scripts/install.sh --new-line      # provision another line; asks for SMS
```

## Verify the installed source

```sh
./scripts/verify.sh
./scripts/verify-organization.sh
./scripts/verify-wiki.sh
```

`verify-organization.sh` is the configuration check: it uses the real pinned
image and OpenClaw CLI against disposable volumes, validates the patched
configuration, lists `main`, `investigator`, and `curator`, then boots it again.
It does not contact Plow or Latch.

## Seed product knowledge

The default seed is this repository's example corpus. Import another validated
corpus before exposing the line to customers:

```sh
./scripts/seed-vault.sh --from ~/your/vault
./scripts/seed-vault.sh --check --from ~/your/vault
```

The vault is the `openplow-wiki` external Docker volume. It outlives Compose
rebuilds and `docker compose down -v`. Canonical pages are root-owned; human
maintenance promotes `_raw/OP-*.md` candidates.

## Configure Latch when needed

Do this only if the Investigator needs Latch:

1. Connect the deployed Plow line's MCP bridge to the operator's Latch setup.
2. Apply [LATCH-RULES.md](LATCH-RULES.md) to Latch Gatekeeper.
3. Keep the requested capability narrow and operator-authorized.
4. Run a live acceptance check from [docs/verification.md](docs/verification.md).

Frontline and Curator are denied the MCP bundle by native configuration and the
Gateway plugin. Do not interpret that as protection against a compromised
Gateway administrator; use separate hardened Gateways for hostile tenants.

## Manual deployment

If credentials already exist:

```sh
docker volume create openplow-wiki
docker compose up --build -d
until docker compose exec -T agent test -f /var/lib/plow/openclaw.json; do sleep 1; done
docker compose exec -T agent /opt/plow/bin/openplow-configure-organization
docker compose restart agent
./scripts/seed-vault.sh
```

Do not edit base-owned OpenClaw includes by hand. The configurator materializes
the required Frontline binding in owner configuration and applies
`organization/openclaw.patch.json5` through `openclaw config patch`.

## Operation

- Nothing is published to the host. There is no `ports:` entry and no proxy in
  front of the agent, so the Gateway's control surface is reachable only from
  inside the container. The base authenticates the proxy as `operator.admin`,
  which is why no port is opened: a published port is an administrator's
  console. Operate through the Plow channel and `docker compose exec`.
- Logs: `docker compose logs -f agent`.
- Inspect native roster:
  `docker compose exec -T agent openclaw agents list`.
- Reapply after an image upgrade:
  `docker compose exec -T agent /opt/plow/bin/openplow-configure-organization && docker compose restart agent`.

## Failure handling

- **No wiki answer:** Frontline creates a durable case. It does not invent an
  external ticket or operate a customer system.
- **Latch denial/unavailability:** Investigator records `BLOCKED`; do not retry
  via another tool path.
- **Canonical write denied:** expected. A human reviews and promotes the
  candidate using the deployment's wiki maintenance process.
- **Organization configuration fails:** inspect
  `docker compose logs agent`, rerun the configurator after the base has booted,
  and run `./scripts/verify-organization.sh` against the rebuilt image.

See [SECURITY.md](SECURITY.md) for the trusted-boundary assumptions.
