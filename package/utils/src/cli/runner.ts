import * as p from "@clack/prompts";
import { runDbCommand } from "../db/command";
import { runFactoryCommand } from "../factory/command";
import { sweepStaleEditDirs } from "../lib/startup-sweep";
import { runSeedCommand } from "../seed/command";

type DefaultTarget = "seed" | "factory" | "reset-root";

export async function runCli(argv: string[]): Promise<void> {
  sweepStaleEditDirs();

  const [first, ...rest] = argv;

  if (first === "seed") {
    p.intro("Rezics Seed");
    await runSeedCommand(rest);
    p.outro("Done!");
    return;
  }

  if (first === "factory") {
    p.intro("Rezics Factory");
    await runFactoryCommand(rest);
    p.outro("Done!");
    return;
  }

  if (first === "reset-root") {
    p.intro("Rezics Reset Root");
    const { runResetRoot } = await import("../seed/index");
    await runResetRoot();
    p.outro("Done!");
    return;
  }

  if (first === "db") {
    await runDbCommand(rest);
    return;
  }

  // Default interactive flow for `bun run seed`.
  const flagPreset = argv.find((a) => a.startsWith("--preset="));
  const flagPlanFile = argv.find((a) => a.startsWith("--plan-file="));
  const flagOnly = argv.find((a) => a.startsWith("--only="));
  const flagNoInteractive = argv.includes("--no-interactive");

  if (flagPreset || flagPlanFile || flagOnly) {
    p.intro("Rezics Seed");
    await runFactoryCommand(argv);
    p.outro("Done!");
    return;
  }

  if (flagNoInteractive) {
    p.intro("Rezics Seed");
    const { runSeed } = await import("../seed/index");
    await runSeed();
    p.outro("Done!");
    return;
  }

  p.intro("Rezics Seed");

  const target = await p.select<DefaultTarget>({
    message: "What would you like to run?",
    options: [
      {
        value: "seed",
        label: "Seed",
        hint: "reset auth/server, then seed users and infrastructure",
      },
      {
        value: "factory",
        label: "Factory data",
        hint: "reset auth/server, seed baseline, then books/posts/shelves",
      },
      {
        value: "reset-root",
        label: "Reset root",
        hint: "repair root user and reset its password",
      },
    ],
  });

  if (p.isCancel(target)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }

  if (target === "seed") {
    const { runSeed } = await import("../seed/index");
    await runSeed();
  }

  if (target === "factory") {
    await runFactoryCommand([]);
  }

  if (target === "reset-root") {
    const { runResetRoot } = await import("../seed/index");
    await runResetRoot();
  }

  p.outro("Done!");
}
