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
      message: "Seed users and infrastructure without resetting databases?",
      initialValue: true,
    });

    if (p.isCancel(ok) || !ok) {
      p.cancel("Seed cancelled.");
      process.exit(0);
    }
  }

  await runSeed();
}
