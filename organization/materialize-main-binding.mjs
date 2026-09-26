import { readFile, writeFile } from "node:fs/promises";

const [configPath] = process.argv.slice(2);
if (!configPath) {
  throw new Error("usage: materialize-main-binding.mjs <openclaw-config-path>");
}

const config = JSON.parse(await readFile(configPath, "utf8"));
config.bindings = [
  {
    agentId: "main",
    match: {
      channel: "plow",
      accountId: "chat"
    },
    session: {
      dmScope: "per-account-channel-peer"
    }
  }
];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
