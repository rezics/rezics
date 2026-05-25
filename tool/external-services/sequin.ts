import path from "node:path";
import { runCommand } from "./compose-runtime";

const SCRIPT_DIR = path.dirname(Bun.main);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const [, , command, subcommand, ...rest] = Bun.argv;

const mappedArgs =
  command === "config"
    ? ["config", subcommand, ...rest].filter(Boolean)
    : [command, ...([subcommand, ...rest].filter(Boolean) as string[])].filter(
        Boolean,
      );

if (!command) {
  console.error("Usage: bun run tool/external-services/sequin.ts <command>");
  process.exit(1);
}

console.warn(
  "service:sequin:* is a compatibility alias. Prefer the unified service:* commands.",
);

runCommand(
  ["bun", "run", "tool/external-services/services.ts", ...mappedArgs],
  {
    cwd: REPO_ROOT,
  },
);
