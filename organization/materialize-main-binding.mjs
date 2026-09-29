import { readFile, writeFile } from "node:fs/promises";

/**
 * Materialize the channel-wide Frontline binding so OpenClaw can register
 * internal agents.
 *
 * The base owns `bindings` through an `$include`, and the pinned OpenClaw
 * refuses to write to an include-owned path. Registering `investigator` and
 * `curator` makes OpenClaw materialize `main`'s ownership of them, which
 * needs a binding that matches the whole channel, and
 * `assertAutomaticBindingsWriteAllowed` rejects the entire `config patch`
 * while that path is include-owned:
 *
 *   Automatic agent ownership materialization cannot append to $include-owned
 *   bindings. Add the required channel-wide binding to the include, then retry.
 *
 * The advice in that message cannot be followed from here. The include is
 * re-rendered from the base on every boot, and there is no owner-config layer
 * to write into — `OPENCLAW_CONFIG_PATH` is the config. So the include is
 * resolved here and inlined: the base's own binding is read from the file it
 * rendered and carried over verbatim, and the channel-wide binding is
 * appended after it.
 *
 * Order matters. The base's binding matches one peer, `plow-owner`, and the
 * channel-wide binding matches everyone. A channel binding placed first would
 * swallow the owner and give them a per-peer session instead of `main`, so
 * the specific binding has to win, and specific-first is what the base
 * already produced.
 *
 * The base's binding is read rather than copied so that a base which changes
 * its own routing is followed instead of being pinned to a stale copy of it.
 */
const [configPath] = process.argv.slice(2);
if (!configPath) {
  throw new Error("usage: materialize-main-binding.mjs <openclaw-config-path>");
}

const CHANNEL_WIDE = {
  agentId: "main",
  match: { channel: "plow", accountId: "chat" },
  session: { dmScope: "per-account-channel-peer" },
};

const isChannelWide = (binding) => binding?.session?.dmScope === "per-account-channel-peer";

const config = JSON.parse(await readFile(configPath, "utf8"));

// Whatever the base rendered into its include, resolved and carried over.
const includePath = (config.bindings ?? []).find((binding) => binding?.$include)?.$include;
let carried = [];
if (includePath) {
  const rendered = JSON.parse(await readFile(includePath, "utf8"));
  carried = Array.isArray(rendered) ? rendered : [rendered];
}

// Drop two things: the `$include` reference, because carrying it alongside its
// own resolved content is what leaves the path include-owned and makes
// `config patch` reject the roster, and any channel-wide entry that is already
// here, because appending a second one would shadow the first.
const kept = [...carried, ...(config.bindings ?? [])].filter(
  (binding) => !binding?.$include && !isChannelWide(binding),
);

config.bindings = [...kept, CHANNEL_WIDE];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
