import * as p from "@clack/prompts";
import { runSeed } from "./index";

export interface SeedCliFlags {
  noInteractive: boolean;
  unknown: string[];
}

export function parseSeedArgs(argv: string[]): SeedCliFlags {
  const flags: SeedCliFlags = {
    noInteractive: false,
    unknown: [],
  };
  for (const arg of argv) {
    if (arg === "--no-interactive") {
      flags.noInteractive = true;
    } else if (arg.startsWith("-")) {
      flags.unknown.push(arg);
    }
  }
  return flags;
}

export async function runSeedCommand(argv: string[]): Promise<void> {
  const flags = parseSeedArgs(argv);

  if (flags.unknown.length > 0) {
    console.warn(`Ignoring unknown flag(s): ${flags.unknown.join(", ")}`);
  }

  if (!flags.noInteractive) {
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
