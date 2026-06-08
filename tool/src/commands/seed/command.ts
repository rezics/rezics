import * as p from "@clack/prompts";
import { define } from "gunshi";

type SeedWorkflow =
  | "baseline"
  | "reset-root"
  | "database-reset"
  | "init-meili-search"
  | "exit";

function cancel(): never {
  p.cancel("Cancelled.");
  process.exit(0);
}

async function runBaselineSeed(options: { noInteractive?: boolean } = {}) {
  p.intro("Rezics Seed");
  const { runSeedCommand } = await import(
    "../../../../package/utils/src/seed/command"
  );
  await runSeedCommand({
    noInteractive: Boolean(options.noInteractive),
  });
  p.outro("Done!");
}

async function runResetRootSeed() {
  p.intro("Rezics Reset Root");
  const { runResetRoot } = await import(
    "../../../../package/utils/src/seed/index"
  );
  await runResetRoot();
  p.outro("Done!");
}

async function confirmDatabaseReset(options: { yes?: boolean } = {}) {
  if (options.yes) return;

  if (!process.stdin.isTTY) {
    throw new Error(
      "Database reset requires interactive confirmation. Run `task seed:database-reset` in a terminal, or pass `--yes` to confirm the destructive reset.",
    );
  }

  const ok = await p.confirm({
    message: "Delete all auth and server seed data?",
    initialValue: false,
  });

  if (p.isCancel(ok) || !ok) {
    p.cancel("Database reset cancelled.");
    process.exit(0);
  }
}

async function runDatabaseReset(options: { yes?: boolean } = {}) {
  await confirmDatabaseReset(options);
  const { runDbReset } = await import(
    "../../../../package/utils/src/db/command"
  );
  await runDbReset();
}

async function runInitMeiliSearch() {
  const { runInitMeili } = await import(
    "../../../../package/utils/src/db/command"
  );
  await runInitMeili();
}

async function pickSeedWorkflow(): Promise<SeedWorkflow> {
  const workflow = await p.select<SeedWorkflow>({
    message: "What seed workflow do you want to run?",
    initialValue: "baseline",
    options: [
      {
        value: "baseline",
        label: "Seed baseline users and infrastructure",
        hint: "does not reset databases",
      },
      {
        value: "reset-root",
        label: "Reset root user only",
        hint: "does not reset databases",
      },
      {
        value: "database-reset",
        label: "Reset auth and server databases only",
      },
      {
        value: "init-meili-search",
        label: "Initialize Meilisearch indexes",
      },
      { value: "exit", label: "Exit" },
    ],
  });
  if (p.isCancel(workflow)) {
    cancel();
  }
  return workflow;
}

async function runInteractiveSeedWorkflow() {
  const workflow = await pickSeedWorkflow();
  if (workflow === "exit") {
    p.outro("Done!");
    return;
  }
  if (workflow === "baseline") {
    await runBaselineSeed({ noInteractive: true });
    return;
  }
  if (workflow === "reset-root") {
    await runResetRootSeed();
    return;
  }
  if (workflow === "database-reset") {
    await runDatabaseReset();
    return;
  }
  await runInitMeiliSearch();
}

export const seedCommand = define({
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
    "reset-root": define({
      name: "reset-root",
      description: "Repair the root user and reset its password.",
      run: async () => {
        await runResetRootSeed();
      },
    }),
    "database-reset": define({
      name: "database-reset",
      description: "Reset auth and server seed databases.",
      args: {
        yes: {
          type: "boolean",
          description: "Confirm the destructive database reset.",
        },
      },
      run: async (ctx) => {
        await runDatabaseReset({ yes: Boolean(ctx.values.yes) });
      },
    }),
    "init-meili-search": define({
      name: "init-meili-search",
      description: "Initialize Meilisearch indexes for seed data.",
      run: async () => {
        await runInitMeiliSearch();
      },
    }),
  },
  run: async (ctx) => {
    if (!ctx.values.noInteractive && process.stdin.isTTY) {
      await runInteractiveSeedWorkflow();
      return;
    }

    if (!ctx.values.noInteractive) {
      throw new Error(
        "Interactive seed workflow requires a TTY. Run `task seed` in a terminal, or pass `--no-interactive` to run the baseline seed directly.",
      );
    }

    await runBaselineSeed({
      noInteractive: true,
    });
  },
});
