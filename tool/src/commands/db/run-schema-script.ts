import { repeatedCsv } from "../../cli/values";
import { resolveDbSchemaPackages, type DbSchemaPackage } from "./packages";
import { runDbPreflight } from "./preflight";
import { runDbPackageScript, type DbScript } from "./runner";

interface DbCliFlags {
  packages: string[];
}

function parseArgs(argv: string[]): DbCliFlags {
  const packages: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith("--package=")) {
      packages.push(...repeatedCsv(arg.slice("--package=".length)));
    }
  }

  return { packages };
}

function actionName(script: DbScript): string {
  return script.replace("db:", "");
}

async function runForPackage(
  pkg: DbSchemaPackage,
  script: DbScript,
): Promise<boolean> {
  console.log(`-> @rezics/${pkg} ${script}`);
  if (script === "db:migrate" || script === "db:deploy") {
    await runDbPreflight(pkg, "beforeMigration");
  }
  const result = await runDbPackageScript(pkg, script);
  if (result === "ok") return true;
  console.error(`x @rezics/${pkg} ${actionName(script)} failed`);
  return false;
}

export async function runSchemaDbScript(
  script: DbScript,
  argv = Bun.argv.slice(2),
): Promise<void> {
  const flags = parseArgs(argv);
  const selection = resolveDbSchemaPackages(flags.packages);

  if (selection.unknown.length > 0) {
    throw new Error(
      `Unknown database package(s): ${selection.unknown.join(", ")}`,
    );
  }
  if (selection.ensureOnly.length > 0) {
    throw new Error(
      `Package(s) are ensure-only and do not own Drizzle schemas: ${selection.ensureOnly.join(", ")}`,
    );
  }

  for (const pkg of selection.packages) {
    const ok = await runForPackage(pkg, script);
    if (!ok) process.exit(1);
    if (script === "db:migrate" || script === "db:deploy") {
      await runDbPreflight(pkg, "afterMigration");
    }
  }
}
