import * as p from "@clack/prompts";
import { runSeed } from "./index";

export interface SeedCommandOptions {
  noInteractive?: boolean;
}

export async function runSeedCommand(
  options: SeedCommandOptions = {},
): Promise<void> {
  if (!options.noInteractive) {
    const ok = await p.confirm({
      message:
        "Reset auth and server databases, then seed users and infrastructure?",
      initialValue: true,
    });

    if (p.isCancel(ok) || !ok) {
      p.cancel("Seed cancelled.");
      process.exit(0);
    }
  }

  await runSeed();
}
