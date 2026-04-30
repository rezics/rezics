import path from "node:path";
import * as p from "@clack/prompts";

const SCRIPT_DIR = path.dirname(Bun.main);
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");

const PACKAGES = ["server", "auth", "notify", "reaction"] as const;
type Package = (typeof PACKAGES)[number];

type StepResult = "ok" | "fail";

async function runPrisma(pkg: Package, args: string[]): Promise<StepResult> {
  const cwd = path.join(ROOT_DIR, "package", pkg);
  const proc = Bun.spawn(["bunx", "prisma", ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const exitCode = await proc.exited;
  return exitCode === 0 ? "ok" : "fail";
}

type FailureChoice = "quit" | "continue" | "retry";

async function askOnFailure(pkg: Package): Promise<FailureChoice> {
  const choice = await p.select<FailureChoice>({
    message: `Migration for @rezics/${pkg} failed. What now?`,
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
        hint: "re-run migrate for this package",
      },
    ],
  });
  if (p.isCancel(choice)) return "quit";
  return choice;
}

async function processPackage(pkg: Package, regenerate: boolean): Promise<StepResult> {
  // Loop allows the "retry" choice to re-run without recursion.
  while (true) {
    p.log.step(`@rezics/${pkg} — prisma migrate dev`);
    const migrate = await runPrisma(pkg, ["migrate", "dev"]);

    if (migrate === "ok" && regenerate) {
      p.log.step(`@rezics/${pkg} — prisma generate`);
      const gen = await runPrisma(pkg, ["generate"]);
      if (gen === "fail") {
        const choice = await askOnFailure(pkg);
        if (choice === "retry") continue;
        return choice === "continue" ? "ok" : "fail";
      }
    }

    if (migrate === "fail") {
      const choice = await askOnFailure(pkg);
      if (choice === "retry") continue;
      return choice === "continue" ? "ok" : "fail";
    }

    return "ok";
  }
}

async function pickPackages(): Promise<Package[]> {
  type Pick = Package | "all";
  const picks = await p.multiselect<Pick>({
    message: "Which packages to migrate?",
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

async function main() {
  p.intro("Rezics Prisma Migrate");

  const selected = await pickPackages();

  const regenerate = await p.confirm({
    message: "Run `prisma generate` after each successful migrate?",
    initialValue: true,
  });
  if (p.isCancel(regenerate)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  for (const pkg of selected) {
    const result = await processPackage(pkg, regenerate);
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
