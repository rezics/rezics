import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Command, type CommandContext, cli, define } from "gunshi";
import { ensureLocalDatabases } from "./db-script/ensure";
import { runServiceCommand } from "./dev-external-services/commands";
import { runCommand } from "./dev-external-services/compose-runtime";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, "..");

function runRepoScript(args: string[]) {
  runCommand(["bun", "run", ...args], { cwd: REPO_ROOT });
}

function repeatedCsv(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((item) =>
    item
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function maybeArg(name: string, value: string | undefined) {
  return value ? [`--${name}=${value}`] : [];
}

// @clack/prompts remains in downstream interactive flows; Gunshi owns command and flag parsing here.
function kebab(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function assertKnownCliInput(ctx: Readonly<CommandContext>) {
  const args = Object.entries(ctx.args ?? {});
  const knownOptions = new Set(["help", "h", "version", "v"]);
  for (const [name, schema] of args) {
    if (schema.type === "positional") {
      continue;
    }
    knownOptions.add(name);
    knownOptions.add(kebab(name));
    if (schema.short) {
      knownOptions.add(schema.short);
    }
    if (schema.type === "boolean") {
      knownOptions.add(`no-${name}`);
      knownOptions.add(`no-${kebab(name)}`);
    }
  }

  for (const token of ctx.tokens) {
    if (token.kind === "option" && !knownOptions.has(token.name ?? "")) {
      throw new Error(`Unknown option: ${token.rawName}`);
    }
  }

  const positionalArgs = args.filter(
    ([, schema]) => schema.type === "positional",
  );
  const allowsManyPositionals = positionalArgs.some(
    ([, schema]) => schema.multiple,
  );
  const allowedPositionals = allowsManyPositionals
    ? Number.POSITIVE_INFINITY
    : positionalArgs.length;
  const extraPositionals =
    ctx.tokens.filter((token) => token.kind === "positional").length -
    ctx.commandPath.length;

  if (extraPositionals > allowedPositionals) {
    const unknown = ctx.positionals[ctx.commandPath.length];
    throw new Error(`Unknown command or argument: ${unknown}`);
  }
}

const serviceCommand = define({
  name: "service",
  description:
    "Start, stop, inspect, and repair repo-managed development services.",
  subCommands: {
    up: define({
      name: "up",
      description: "Start repo-managed external services.",
      run: () => runServiceCommand({ kind: "up" }),
    }),
    down: define({
      name: "down",
      description: "Stop repo-managed external services.",
      run: () => runServiceCommand({ kind: "down" }),
    }),
    logs: define({
      name: "logs",
      description: "Follow managed service logs.",
      args: {
        service: {
          type: "positional",
          multiple: true,
          description: "Optional Compose service names.",
        },
      },
      run: (ctx) =>
        runServiceCommand({
          kind: "logs",
          services: (ctx.values.service ?? []) as string[],
        }),
    }),
    ps: define({
      name: "ps",
      description: "Show managed service containers.",
      run: () => runServiceCommand({ kind: "ps" }),
    }),
    health: define({
      name: "health",
      description: "Check managed service health.",
      run: () => runServiceCommand({ kind: "health" }),
    }),
    config: define({
      name: "config",
      description: "Inspect or apply managed service configuration.",
      subCommands: {
        plan: define({
          name: "plan",
          description: "Render the Docker Compose plan.",
          run: () => runServiceCommand({ kind: "config-plan" }),
        }),
        apply: define({
          name: "apply",
          description: "Recreate Sequin so its config file is applied.",
          run: () => runServiceCommand({ kind: "config-apply" }),
        }),
      },
    }),
    source: define({
      name: "source",
      description: "Verify or repair the source Postgres CDC setup.",
      subCommands: {
        verify: define({
          name: "verify",
          description: "Verify source Postgres CDC readiness.",
          args: {
            url: {
              type: "string",
              description: "Override source Postgres connection URL.",
            },
          },
          run: (ctx) =>
            runServiceCommand({
              kind: "source-verify",
              args: [...maybeArg("url", ctx.values.url as string | undefined)],
            }),
        }),
        repair: define({
          name: "repair",
          description:
            "Repair local source Postgres CDC readiness with apply/dev-reset.",
          args: {
            url: {
              type: "string",
              description: "Override source Postgres connection URL.",
            },
            forceActiveSlot: {
              type: "boolean",
              toKebab: true,
              description: "Drop an active local replication slot.",
            },
          },
          toKebab: true,
          run: (ctx) =>
            runServiceCommand({
              kind: "source-repair",
              args: [
                ...maybeArg("url", ctx.values.url as string | undefined),
                ...(ctx.values.forceActiveSlot ? ["--force-active-slot"] : []),
              ],
            }),
        }),
      },
    }),
  },
});

// Service commands own Docker Compose lifecycle only; Prisma commands own schema lifecycle.
const prismaCommand = define({
  name: "prisma",
  description: "Run repo Prisma workflows.",
  subCommands: {
    migrate: define({
      name: "migrate",
      description: "Run interactive Prisma migrations.",
      run: () => runRepoScript(["tool/db-script/prisma-migrate.ts"]),
    }),
    generate: define({
      name: "generate",
      description: "Regenerate Prisma clients.",
      run: () => runRepoScript(["tool/db-script/prisma-regenerate.ts"]),
    }),
    reset: define({
      name: "reset",
      description: "Reset selected Prisma databases.",
      args: {
        yes: {
          type: "boolean",
          short: "y",
          description: "Reset all packages without prompting.",
        },
        package: {
          type: "string",
          multiple: true,
          description: "Prisma package to reset. Repeat or comma-separate.",
        },
      },
      run: (ctx) =>
        runRepoScript([
          "tool/db-script/prisma-reset-db.ts",
          ...(ctx.values.yes ? ["--yes"] : []),
          ...repeatedCsv(ctx.values.package as string[] | undefined).map(
            (pkg) => `--package=${pkg}`,
          ),
        ]),
    }),
  },
});

const dbCommand = define({
  name: "db",
  description: "Manage local repo databases.",
  subCommands: {
    ensure: define({
      name: "ensure",
      description:
        "Create managed local databases idempotently from the repo registry.",
      run: () => ensureLocalDatabases(),
    }),
  },
});

const seedCommand = define({
  name: "seed",
  description: "Run baseline seed workflows.",
  args: {
    noInteractive: {
      type: "boolean",
      description: "Skip interactive confirmation.",
    },
  },
  toKebab: true,
  subCommands: {
    resetRoot: define({
      name: "reset-root",
      description: "Repair the root user and reset its password.",
      run: () => runRepoScript(["package/utils/bin/cli.ts", "reset-root"]),
    }),
    databaseReset: define({
      name: "database-reset",
      description: "Reset auth and server seed databases.",
      run: () => runRepoScript(["package/utils/bin/cli.ts", "db", "reset"]),
    }),
    initMeiliSearch: define({
      name: "init-meili-search",
      description: "Initialize Meilisearch indexes for seed data.",
      run: () =>
        runRepoScript(["package/utils/bin/cli.ts", "db", "init-meili"]),
    }),
  },
  run: (ctx) =>
    runRepoScript([
      "package/utils/bin/cli.ts",
      "seed",
      ...(ctx.values.noInteractive ? ["--no-interactive"] : []),
    ]),
});

const factoryCommand = define({
  name: "factory",
  description: "Run factory seed data workflows.",
  args: {
    preset: { type: "string", description: "Factory preset name." },
    planFile: {
      type: "string",
      description: "Path to a factory seed plan file.",
    },
    only: {
      type: "enum",
      choices: ["echokv"],
      description: "Run one supported special factory target.",
    },
    meili: {
      type: "enum",
      choices: ["init-and-sync", "skip"],
      description: "Meilisearch handling mode.",
    },
    scenario: {
      type: "string",
      multiple: true,
      description: "Scenario name. Repeat or comma-separate.",
    },
    allScenarios: {
      type: "boolean",
      description: "Run all factory scenarios.",
      conflicts: "noScenarios",
    },
    noScenarios: {
      type: "boolean",
      description: "Skip factory scenarios.",
      conflicts: "allScenarios",
    },
    manifest: {
      type: "enum",
      choices: ["human", "json", "both", "none"],
      description: "Special target manifest output format.",
    },
    noInteractive: {
      type: "boolean",
      description: "Skip interactive selection and confirmation.",
    },
  },
  toKebab: true,
  run: (ctx) =>
    runRepoScript([
      "package/utils/bin/cli.ts",
      "factory",
      ...maybeArg("preset", ctx.values.preset as string | undefined),
      ...maybeArg("plan-file", ctx.values.planFile as string | undefined),
      ...maybeArg("only", ctx.values.only as string | undefined),
      ...maybeArg("meili", ctx.values.meili as string | undefined),
      ...repeatedCsv(ctx.values.scenario as string[] | undefined).map(
        (scenario) => `--scenario=${scenario}`,
      ),
      ...(ctx.values.allScenarios ? ["--all-scenarios"] : []),
      ...(ctx.values.noScenarios ? ["--no-scenarios"] : []),
      ...maybeArg("manifest", ctx.values.manifest as string | undefined),
      ...(ctx.values.noInteractive ? ["--no-interactive"] : []),
    ]),
});

// Convention checks stay under tool/scripts/check-convention because they are repo rules, not i18n maintenance.
const i18nCommand = define({
  name: "i18n",
  description: "Run i18n maintenance commands.",
  subCommands: {
    check: define({
      name: "check",
      description: "Validate frontend i18n catalog usage.",
      run: () => runRepoScript(["tool/scripts/i18n/check-i18n.ts"]),
    }),
    missing: define({
      name: "missing",
      description: "Report missing i18n keys.",
      run: () => runRepoScript(["tool/scripts/i18n-missing.ts"]),
    }),
    dedup: define({
      name: "dedup",
      description: "Deduplicate i18n catalog entries.",
      run: () => runRepoScript(["tool/scripts/i18n-dedup.ts"]),
    }),
    analyzeDuplicates: define({
      name: "analyze-duplicates",
      description: "Analyze duplicate i18n message values.",
      run: () => runRepoScript(["tool/scripts/i18n/analyze-duplicates.ts"]),
    }),
  },
});

export const repoToolSubCommands = {
  service: serviceCommand,
  db: dbCommand,
  prisma: prismaCommand,
  seed: seedCommand,
  factory: factoryCommand,
  i18n: i18nCommand,
} satisfies Record<string, Command>;

export const repoToolCommand = define({
  name: "tool",
  description: "Rezics repository maintenance CLI.",
}) satisfies Command;

export async function runRepoToolCli(argv: string[]) {
  await cli(argv, repoToolCommand, {
    name: "tool",
    description: "Rezics repository maintenance CLI.",
    subCommands: repoToolSubCommands,
    usageOptionType: true,
    onBeforeCommand: assertKnownCliInput,
  });
}

if (import.meta.main) {
  await runRepoToolCli(Bun.argv.slice(2));
}
