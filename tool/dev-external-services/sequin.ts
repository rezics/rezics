import { runRepoToolCli } from "../cli";

console.warn(
  "service:sequin:* is a compatibility alias. Prefer the unified service:* commands.",
);

await runRepoToolCli(["service", ...Bun.argv.slice(2)]);
