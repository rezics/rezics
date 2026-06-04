import { define } from "gunshi";
import { runRepoScript } from "../../cli/command-runner";
import { repeatedCsv } from "../../cli/values";
import { ensureLocalDatabases } from "./ensure";

function dbPackageArgs(value: string[] | undefined): string[] {
  return repeatedCsv(value).map((pkg) => `--package=${pkg}`);
}

export const dbCommand = define({
  name: "db",
  description: "Manage repo databases.",
  subCommands: {
    ensure: define({
      name: "ensure",
      description:
        "Create managed local databases idempotently from tool config.",
      run: () => ensureLocalDatabases(),
    }),
    generate: define({
      name: "generate",
      description: "Generate Drizzle migrations for schema-owning packages.",
      args: {
        package: {
          type: "string",
          multiple: true,
          description:
            "Database package to generate. Repeat or comma-separate.",
        },
      },
      run: (ctx) =>
        runRepoScript([
          "tool/src/commands/db/generate.ts",
          ...dbPackageArgs(ctx.values.package as string[] | undefined),
        ]),
    }),
    migrate: define({
      name: "migrate",
      description: "Run local Drizzle migrations for schema-owning packages.",
      args: {
        package: {
          type: "string",
          multiple: true,
          description: "Database package to migrate. Repeat or comma-separate.",
        },
      },
      run: (ctx) =>
        runRepoScript([
          "tool/src/commands/db/migrate.ts",
          ...dbPackageArgs(ctx.values.package as string[] | undefined),
        ]),
    }),
    deploy: define({
      name: "deploy",
      description:
        "Run production-style Drizzle migrations for schema-owning packages.",
      args: {
        package: {
          type: "string",
          multiple: true,
          description: "Database package to deploy. Repeat or comma-separate.",
        },
      },
      run: (ctx) =>
        runRepoScript([
          "tool/src/commands/db/deploy.ts",
          ...dbPackageArgs(ctx.values.package as string[] | undefined),
        ]),
    }),
    reset: define({
      name: "reset",
      description:
        "Drop, recreate, and migrate selected local schema-owner databases.",
      args: {
        package: {
          type: "string",
          multiple: true,
          description: "Database package to reset. Repeat or comma-separate.",
        },
        yes: {
          type: "boolean",
          description: "Confirm the destructive local database reset.",
        },
        seed: {
          type: "boolean",
          description: "Run the baseline seed workflow after migrations.",
        },
        factory: {
          type: "boolean",
          description: "Run the factory workflow after migrations.",
        },
      },
      run: (ctx) =>
        runRepoScript([
          "tool/src/commands/db/reset.ts",
          ...dbPackageArgs(ctx.values.package as string[] | undefined),
          ...(ctx.values.yes ? ["--yes"] : []),
          ...(ctx.values.seed ? ["--seed"] : []),
          ...(ctx.values.factory ? ["--factory"] : []),
        ]),
    }),
    smoke: define({
      name: "smoke",
      description:
        "Assert representative migrated database objects after migrations.",
      args: {
        package: {
          type: "string",
          multiple: true,
          description:
            "Database package to smoke test. Repeat or comma-separate.",
        },
      },
      run: (ctx) =>
        runRepoScript([
          "tool/src/commands/db/smoke.ts",
          ...dbPackageArgs(ctx.values.package as string[] | undefined),
        ]),
    }),
  },
});
