import type { DbSchemaPackage } from "./packages";
import { getPackageDir } from "./paths";

export type DbStepResult = "ok" | "fail";
export type DbScript = "db:generate" | "db:migrate" | "db:deploy";

export async function runDbPackageScript(
  pkg: DbSchemaPackage,
  script: DbScript,
): Promise<DbStepResult> {
  const proc = Bun.spawn(["bun", "run", script], {
    cwd: getPackageDir(pkg),
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  const exitCode = await proc.exited;
  return exitCode === 0 ? "ok" : "fail";
}
