import { runServiceCli } from "./cli";

console.warn(
  "service sequin aliases are deprecated. Prefer `bun run service ...` commands.",
);

await runServiceCli(Bun.argv.slice(2));
