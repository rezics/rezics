import { runServiceCli } from "./cli";

function normalizeLegacyArgs(args: string[]) {
  const [command, ...rest] = args;
  if (command === "source:verify") {
    return ["service", "source", "verify", ...rest];
  }
  if (command === "source:repair") {
    return ["service", "source", "repair", ...rest];
  }
  if (command === "config") {
    return ["service", "config", ...rest];
  }
  return ["service", ...(command ? [command] : []), ...rest];
}

await runServiceCli(normalizeLegacyArgs(Bun.argv.slice(2)));
