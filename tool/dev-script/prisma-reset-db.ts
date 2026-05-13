import path from "node:path";
import * as p from "@clack/prompts";

const SCRIPT_DIR = path.dirname(Bun.main);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");

const PACKAGES = ["server", "auth", "notify", "reaction"] as const;
type Package = (typeof PACKAGES)[number];

type StepResult = "ok" | "fail";

interface CliFlags {
  yes: boolean;
  packages: Package[];
  unknown: string[];
}

function isPackage(value: string): value is Package {
  return PACKAGES.includes(value as Package);
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
        if (isPackage(pkg)) {
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

async function runPrismaReset(pkg: Package): Promise<StepResult> {
  const cwd = path.join(ROOT_DIR, "package", pkg);
  const proc = Bun.spawn(
    ["bunx", "prisma", "migrate", "reset", "--force", "--skip-seed"],
    {
      cwd,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    },
  );
  const exitCode = await proc.exited;
  return exitCode === 0 ? "ok" : "fail";
}

type FailureChoice = "quit" | "continue" | "retry";

async function askOnFailure(pkg: Package): Promise<FailureChoice> {
  const choice = await p.select<FailureChoice>({
    message: `Reset for @rezics/${pkg} failed. What now?`,
    initialValue: "quit",
    options: [
      { value: "quit", label: "Quit", hint: "stop here" },
      {
        value: "continue",
        label: "Continue",
        hint: "skip this package, run the rest",
      },
      {
        value: "retry",
        label: "Retry",
        hint: "re-run reset for this package",
      },
    ],
  });
  if (p.isCancel(choice)) return "quit";
  return choice;
}

async function processPackage(
  pkg: Package,
  interactive: boolean,
): Promise<StepResult> {
  while (true) {
    p.log.step(`@rezics/${pkg} — prisma migrate reset --force --skip-seed`);
    const reset = await runPrismaReset(pkg);
    if (reset === "ok") return "ok";

    if (!interactive) return "fail";

    const choice = await askOnFailure(pkg);
    if (choice === "retry") continue;
    return choice === "continue" ? "ok" : "fail";
  }
}

async function pickPackages(flags: CliFlags): Promise<Package[]> {
  if (flags.packages.length > 0) return flags.packages;
  if (flags.yes) return [...PACKAGES];

  type Pick = Package | "all";
  const picks = await p.multiselect<Pick>({
    message: "Which packages should be reset?",
    required: true,
    options: [
      { value: "all", label: "All", hint: PACKAGES.join(", ") },
      ...PACKAGES.map((pkg) => ({ value: pkg, label: `@rezics/${pkg}` })),
    ],
  });
  if (p.isCancel(picks)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  if (picks.includes("all")) return [...PACKAGES];
  return picks.filter((pick): pick is Package => pick !== "all");
}

async function confirmReset(
  selected: readonly Package[],
  flags: CliFlags,
): Promise<void> {
  if (flags.yes) return;

  p.log.warn(
    `This will delete all data in: ${selected
      .map((pkg) => `@rezics/${pkg}`)
      .join(", ")}.`,
  );
  p.log.info("Prisma migrations will be re-applied and seeds will be skipped.");

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
