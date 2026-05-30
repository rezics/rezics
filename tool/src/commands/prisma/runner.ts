import type { PrismaPackage } from "./packages";
import { getPackageDir } from "./paths";

export type StepResult = "ok" | "fail";

interface RunPrismaOptions {
  stdin?: "inherit" | "ignore";
}

export async function runPrisma(
  pkg: PrismaPackage,
  args: string[],
  options: RunPrismaOptions = {},
): Promise<StepResult> {
  const proc = Bun.spawn(["bunx", "prisma", ...args], {
    cwd: getPackageDir(pkg),
    stdout: "inherit",
    stderr: "inherit",
    stdin: options.stdin ?? "inherit",
  });
  const exitCode = await proc.exited;
  return exitCode === 0 ? "ok" : "fail";
}
