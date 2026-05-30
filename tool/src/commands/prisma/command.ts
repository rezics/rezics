import { define } from "gunshi";
import { repeatedCsv } from "../../cli/values";
import { runRepoScript } from "../../cli/command-runner";

export const prismaCommand = define({
  name: "prisma",
  description: "Run repo Prisma workflows.",
  subCommands: {
    migrate: define({
      name: "migrate",
      description: "Run interactive Prisma migrations.",
      run: () => runRepoScript(["tool/src/commands/prisma/migrate.ts"]),
    }),
    generate: define({
      name: "generate",
      description: "Regenerate Prisma clients.",
      run: () => runRepoScript(["tool/src/commands/prisma/generate.ts"]),
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
          "tool/src/commands/prisma/reset.ts",
          ...(ctx.values.yes ? ["--yes"] : []),
          ...repeatedCsv(ctx.values.package as string[] | undefined).map(
            (pkg) => `--package=${pkg}`,
          ),
        ]),
    }),
  },
});
