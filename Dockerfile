# ── The wiki tool ────────────────────────────────────────────────────────────
# A build-time stage, declared first because everything after it inherits from
# it. uv is how plow-wiki gets an interpreter: it needs Python >= 3.12 and the
# base ships 3.11 with no pip. Pinned by digest, like the base — a tag is a name
# somebody can move, and this is the tool that validates, indexes and commits
# the knowledge base.
FROM ghcr.io/astral-sh/uv:0.12.19@sha256:04d046b13e60d6bcec73cbc5e1cad25d680dea90c8573340950a0ac2d1aef424 AS uv

# OpenPlow Support — a customer support agent for the Plow ecosystem.
#
# A variant image on Plow's maintained base. The base owns the boot, the channel
# plugin, the MCP bridge to Latch, the gateway config and the usage reporter; we
# own the persona, the skills and the vault. Every line we do not write is a boot
# fix we inherit free on the next bump.
#
# Pinned by digest as well as tag. A tag is a name somebody can move, and the
# code it names boots holding this agent's live Plow credential. The tag names
# the plow-openclaw-agent commit the image was published from; the digest is
# that image's manifest. Bump both together, from a published build.
FROM public.ecr.aws/e1h7x4a2/plow-cloud-agents:base-d78e4ea75e7c44b9b63d7ea4b50b2aa180daf51f@sha256:f687b5eb54153edcf143deeef52c66465a19efb5e371b03f054465f5e46337f7

# 4faad4d9c9b15e3fb1ea6919e7334a814270e02e is plow-wiki v0.2.0. Pinned by
# COMMIT and not by tag: a tag can be re-pointed at a later commit, and this is
# the tool that validates, indexes and commits the knowledge base. Bump it and
# nothing else; the vault format rides with it.
ARG PLOW_WIKI_REF=4faad4d9c9b15e3fb1ea6919e7334a814270e02e

# Where uv keeps the interpreter it fetches. Under /opt/plow, so a base bump
# that moves /opt/plow moves this with it.
ENV UV_PYTHON_INSTALL_DIR=/opt/plow/wiki-python \
    UV_TOOL_DIR=/opt/plow/wiki-tool \
    UV_TOOL_BIN_DIR=/opt/plow/wiki-tool/bin \
    UV_PYTHON=3.12

# Root for the install and the mount point; /opt/plow and / are root-owned and
# the image runs as `node`, so this step cannot be skipped. It is the ONLY place
# the image assumes root.
USER root

COPY --from=uv /uv /usr/local/bin/uv

COPY bin/ /opt/plow/bin/

# /data and /data/wiki are root-owned and world-readable on purpose. The agent
# runs as `node` (uid 1000), so it can read every canonical page and cannot
# write, delete, rename or chmod one — the filesystem is the boundary, not the
# prompt. The single exception is the candidate inbox, which wiki-bootstrap
# hands to the agent once it creates the vault; see SECURITY.md.
#
# A fresh named volume inherits this directory's ownership, which is what makes
# the arrangement hold without an entrypoint hook.
RUN uv tool install --python 3.12 \
      "plow-wiki @ git+https://github.com/plow-pbc/plow-wiki@${PLOW_WIKI_REF}" \
 && find /opt/plow/wiki-tool -name __pycache__ -type d -prune -exec rm -rf {} + \
 && chown -R node:node /opt/plow/wiki-tool /opt/plow/wiki-python \
 && mkdir -p /data/wiki \
 && chown root:root /data /data/wiki \
 && chmod 755 /data /data/wiki \
 && chown -R root:root /opt/plow/bin \
 && chmod 755 /opt/plow/bin/*

USER node

ENV PATH="/opt/plow/wiki-tool/bin:${PATH}"

# ONE source of truth for where the vault is. Nothing else may name a path: the
# persona, the skills and the maintenance scripts all read this. It points into
# the named volume, not into the container's writable layer, so replacing the
# container does not replace the knowledge.
ENV WIKI_PATH=/data/wiki

# What the Agent Index page says this agent is. The base's reporter sends the
# name and blurb once, on first registration: the Index leaves a field it is not
# given alone, so a value passed every pass would overwrite an edit the owner
# made on their own page. Edit the page on the Index, not here.
#
# AGENT_ID is the slug, and it is what makes an installer of this image an
# installer of this entry. Changing it means a rebuild and a re-push.
ENV AGENT_ID=openplow-support
ENV AGENT_NAME="OpenPlow Support"
ENV AGENT_BLURB="OpenPlow, a customer support agent built with OpenClaw, Latch and plow-wiki. It answers with receipts, investigates through Latch when the knowledge base runs out, and files what it learns as candidate knowledge for a human to promote."

# AGENT_RUNTIME is deliberately unset here. The base sets it for us as of
# d78e4ea, which carries 072da08d ("Send the runtime to the Agent Index on
# register"). scripts/register.sh still sends it, and that is fine — the Index
# ignores a second claim on a slug you own. See SECURITY.md.

# The base AGENTS.md is the persona: boot renders it into the workspace on
# every start and deletes BOOTSTRAP.md/SOUL.md/IDENTITY.md/USER.md around it.
COPY prompt/AGENTS.md /opt/plow/prompt/AGENTS.md

# Trailing slash, and this is load-bearing. `COPY skills/ /opt/plow/skills/`
# copies the CONTENTS of this directory in, merging with what the base already
# put there, so we inherit the base's `owners-mac` and `google-workspace` and add
# ours beside them. Without the slash ours would nest at /opt/plow/skills/skills
# and the base's two would be the only ones loaded.
COPY skills/ /opt/plow/skills/

# The infrastructure guard, shipped INSIDE OpenClaw's own bundled extensions.
# That path is the load-bearing part: the base's boot owns the plugin load
# paths, so a plugin anywhere else is dropped at first start. Copied to
# /app/dist/extensions/<id>/ it is discovered by a directory scan, enabled by
# enabledByDefault in its manifest, and given conversation access with no
# config at all.
#
# There is deliberately no `plugins registry --refresh` here, though the
# reference implementation this follows has one. Measured on this base
# (d78e4ea): the refresh writes /var/lib/plow/state/openclaw.sqlite, and
# /var/lib/plow is the state VOLUME — so the file this step writes is masked
# and discarded before the Gateway ever starts. The loader scans
# /app/dist/extensions/ instead: with that path masked behind an empty tmpfs,
# `plugins list` still reports `stock:infra-guard/index.js, enabled`. The step
# is a no-op that costs build time and implies a dependency that does not
# exist. scripts/verify.sh checks real discovery, not the absence of a cache.
#
# Without this plugin the agent has exactly one enforcement channel and it is
# the owner's Mac, which may be asleep. With it, the rule that a support agent
# never reports the host, container, runtime, paths or model it runs on is
# enforced in the Gateway on every boot, on every machine. That rule exists
# because it was violated: asked where it was running, this agent answered
# with its container id, WSL2, x64, Node v24.19.0 and the model id. The persona
# says not to. A prompt is not enforcement. See plugin/infra-guard/.
USER root
COPY plugin/infra-guard/ /app/dist/extensions/infra-guard/
