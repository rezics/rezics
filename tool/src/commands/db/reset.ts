import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repeatedCsv } from "../../cli/values";
import { createToolConfig } from "../../env";
import { renderResetDatabaseSql } from "../../env/repo-database-registry";
import { type DbSchemaPackage, resolveDbSchemaPackages } from "./packages";
import { runDbPreflight } from "./preflight";
import { runDbPackageScript } from "./runner";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

interface ResetCliFlags {
  packages: string[];
  yes: boolean;
  seed: boolean;
  factory: boolean;
}

function parseArgs(argv: string[]): ResetCliFlags {
  const packages: string[] = [];
  let yes = false;
  let seed = false;
  let factory = false;

  for (const arg of argv) {
    if (arg.startsWith("--package=")) {
      packages.push(...repeatedCsv(arg.slice("--package=".length)));
    } else if (arg === "--yes") {
      yes = true;
    } else if (arg === "--seed") {
      seed = true;
    } else if (arg === "--factory") {
      factory = true;
    }
  }

  return { packages, yes, seed, factory };
}

function schemaDatabaseName(
  pkg: DbSchemaPackage,
  names: Record<DbSchemaPackage, string>,
): string {
  return names[pkg];
}

function runPostgresReset(databaseNames: readonly string[]): void {
  const config = createToolConfig();
  const { host, port, user, password } = config.postgres;

  const result = spawnSync(
    "psql",
    [
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      host,
      "-p",
      port,
      "-U",
      user,
      "-d",
      "postgres",
    ],
    {
      env: { ...process.env, PGPASSWORD: password },
      input: renderResetDatabaseSql(databaseNames),
      stdio: ["pipe", "inherit", "inherit"],
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`psql failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function runRootWorkflow(args: readonly string[]): Promise<void> {
  const proc = Bun.spawn(["bun", "run", "tool/bin/tool.ts", ...args], {
    cwd: path.resolve(TOOL_DIR, ".."),
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      `Command failed with exit code ${exitCode}: bun run tool/bin/tool.ts ${args.join(" ")}`,
    );
  }
}

export async function resetLocalDatabases(
  argv = Bun.argv.slice(2),
): Promise<void> {
  const flags = parseArgs(argv);
  if (!flags.yes) {
    throw new Error(
      "Database reset is destructive. Pass `--yes` to drop and recreate selected local databases.",
    );
  }

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

  const config = createToolConfig();
  const databaseNames = selection.packages.map((pkg) =>
    schemaDatabaseName(pkg, config.schemaDatabaseNames),
  );

  console.log(`Resetting local database(s): ${databaseNames.join(", ")}`);
  runPostgresReset(databaseNames);

  for (const pkg of selection.packages) {
    console.log(`-> @rezics/${pkg} db:migrate`);
    await runDbPreflight(pkg, "beforeMigration");
    const result = await runDbPackageScript(pkg, "db:migrate");
    if (result !== "ok") {
      process.exit(1);
    }
    await runDbPreflight(pkg, "afterMigration");
  }

  if (flags.seed) {
    await runRootWorkflow(["seed", "--no-interactive"]);
  }
  if (flags.factory) {
    await runRootWorkflow(["factory", "--no-interactive"]);
  }
}

if (import.meta.main) {
  await resetLocalDatabases();
}
