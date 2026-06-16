import type { DbSchemaPackage } from "./packages";
import { getPackageDir } from "./paths";

export type DbStepResult = "ok" | "fail";
export type DbScript = "db:generate" | "db:migrate" | "db:deploy";

export async function runDbPackageScript(
  pkg: DbSchemaPackage,
  script: DbScript,
): Promise<DbStepResult> {
  // `db:generate` / `db:migrate` / `db:deploy` are go-task tasks defined in each
  // package's Taskfile (via the shared tool/taskfiles/drizzle.yml include), not
  // package.json scripts — so drive them through `task`, run in the package dir.
  const proc = Bun.spawn(["task", script], {
    cwd: getPackageDir(pkg),
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  const exitCode = await proc.exited;
  return exitCode === 0 ? "ok" : "fail";
}
