import * as p from "@clack/prompts";
import type { PrismaPackage } from "./packages";
import { runPrisma, type StepResult } from "./prisma-runner";
import { askOnFailure, pickPackages } from "./prompts";

async function processPackage(
  pkg: PrismaPackage,
  regenerate: boolean,
): Promise<StepResult> {
  // Loop allows the "retry" choice to re-run without recursion.
  while (true) {
    p.log.step(`@rezics/${pkg} — prisma migrate dev`);
    const migrate = await runPrisma(pkg, ["migrate", "dev"]);

    if (migrate === "ok" && regenerate) {
      p.log.step(`@rezics/${pkg} — prisma generate`);
      const gen = await runPrisma(pkg, ["generate"]);
      if (gen === "fail") {
        const choice = await askOnFailure(
          pkg,
          "Prisma generate",
          "re-run migrate and generate for this package",
        );
        if (choice === "retry") continue;
        return choice === "continue" ? "ok" : "fail";
      }
    }

    if (migrate === "fail") {
      const choice = await askOnFailure(
        pkg,
        "Migration",
        "re-run migrate for this package",
      );
      if (choice === "retry") continue;
      return choice === "continue" ? "ok" : "fail";
    }

    return "ok";
  }
}

async function main() {
  p.intro("Rezics Prisma Migrate");

  const selected = await pickPackages("Which packages to migrate?");

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
