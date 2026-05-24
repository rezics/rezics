import * as p from "@clack/prompts";
import {
  isPrismaPackage,
  PRISMA_PACKAGES,
  type PrismaPackage,
} from "./packages";
import { runPrisma, type StepResult } from "./prisma-runner";
import { askOnFailure, pickPackages as promptPackages } from "./prompts";

interface CliFlags {
  yes: boolean;
  packages: PrismaPackage[];
  unknown: string[];
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    yes: false,
    packages: [],
    unknown: [],
  };

  for (const arg of argv) {
    if (arg === "--yes" || arg === "-y") {
      flags.yes = true;
    } else if (arg.startsWith("--package=")) {
      const value = arg.slice("--package=".length);
      const packages = value.split(",").filter(Boolean);
      for (const pkg of packages) {
        if (isPrismaPackage(pkg)) {
          flags.packages.push(pkg);
        } else {
          flags.unknown.push(`--package=${pkg}`);
        }
      }
    } else if (arg.startsWith("-")) {
      flags.unknown.push(arg);
    }
  }

  return {
    ...flags,
    packages: Array.from(new Set(flags.packages)),
  };
}

async function runPrismaReset(pkg: PrismaPackage): Promise<StepResult> {
  return runPrisma(pkg, ["migrate", "reset", "--force"]);
}

async function processPackage(
  pkg: PrismaPackage,
  interactive: boolean,
): Promise<StepResult> {
  while (true) {
    p.log.step(`@rezics/${pkg} — prisma migrate reset --force`);
    const reset = await runPrismaReset(pkg);
    if (reset === "ok") return "ok";

    if (!interactive) return "fail";

    const choice = await askOnFailure(
      pkg,
      "Reset",
      "re-run reset for this package",
    );
    if (choice === "retry") continue;
    return choice === "continue" ? "ok" : "fail";
  }
}

async function pickPackages(flags: CliFlags): Promise<PrismaPackage[]> {
  if (flags.packages.length > 0) return flags.packages;
  if (flags.yes) return [...PRISMA_PACKAGES];

  return promptPackages("Which packages should be reset?");
}

async function confirmReset(
  selected: readonly PrismaPackage[],
  flags: CliFlags,
): Promise<void> {
  if (flags.yes) return;

  p.log.warn(
    `This will delete all data in: ${selected
      .map((pkg) => `@rezics/${pkg}`)
      .join(", ")}.`,
  );
  p.log.info("Prisma migrations will be re-applied.");

  const confirmed = await p.confirm({
    message: "Reset selected databases?",
    initialValue: false,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
}

async function main() {
  const flags = parseArgs(Bun.argv.slice(2));

  p.intro("Rezics Prisma Reset DB");

  if (flags.unknown.length > 0) {
    p.log.warn(`Ignoring unknown flag(s): ${flags.unknown.join(", ")}`);
  }

  const selected = await pickPackages(flags);
  await confirmReset(selected, flags);

  for (const pkg of selected) {
    const result = await processPackage(pkg, !flags.yes);
    if (result === "fail") {
      p.outro("Stopped.");
      process.exit(1);
    }
  }

  p.outro("Done!");
}

main().catch((err) => {
  p.log.error(String(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
