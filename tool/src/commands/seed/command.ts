import * as p from "@clack/prompts";
import { define } from "gunshi";

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
    resetRoot: define({
      name: "reset-root",
      description: "Repair the root user and reset its password.",
      run: async () => {
        p.intro("Rezics Reset Root");
        const { runResetRoot } = await import(
          "../../../../package/utils/src/seed/index"
        );
        await runResetRoot();
        p.outro("Done!");
      },
    }),
    databaseReset: define({
      name: "database-reset",
      description: "Reset auth and server seed databases.",
      run: async () => {
        const { runDbReset } = await import(
          "../../../../package/utils/src/db/command"
        );
        await runDbReset();
      },
    }),
    initMeiliSearch: define({
      name: "init-meili-search",
      description: "Initialize Meilisearch indexes for seed data.",
      run: async () => {
        const { runInitMeili } = await import(
          "../../../../package/utils/src/db/command"
        );
        await runInitMeili();
      },
    }),
  },
  run: async (ctx) => {
    p.intro("Rezics Seed");
    const { runSeedCommand } = await import(
      "../../../../package/utils/src/seed/command"
    );
    await runSeedCommand({
      noInteractive: Boolean(ctx.values.noInteractive),
    });
    p.outro("Done!");
  },
});
