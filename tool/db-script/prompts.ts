import * as p from "@clack/prompts";
import { PRISMA_PACKAGES, type PrismaPackage } from "./packages";

export type FailureChoice = "quit" | "continue" | "retry";

export async function askOnFailure(
  pkg: PrismaPackage,
  action: string,
  retryHint: string,
): Promise<FailureChoice> {
  const choice = await p.select<FailureChoice>({
    message: `${action} for @rezics/${pkg} failed. What now?`,
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
        hint: retryHint,
      },
    ],
  });
  if (p.isCancel(choice)) return "quit";
  return choice;
}

export async function pickPackages(message: string): Promise<PrismaPackage[]> {
  type Pick = PrismaPackage | "all";
  const picks = await p.multiselect<Pick>({
    message,
    required: true,
    options: [
      { value: "all", label: "All", hint: PRISMA_PACKAGES.join(", ") },
      ...PRISMA_PACKAGES.map((pkg) => ({
        value: pkg,
        label: `@rezics/${pkg}`,
      })),
    ],
  });
  if (p.isCancel(picks)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  if (picks.includes("all")) return [...PRISMA_PACKAGES];
  return picks.filter((pick): pick is PrismaPackage => pick !== "all");
}
