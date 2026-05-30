import { type Command, cli, define } from "gunshi";
import { dbCommand } from "../commands/db/command";
import { factoryCommand } from "../commands/factory/command";
import { i18nCommand } from "../commands/i18n/command";
import { prismaCommand } from "../commands/prisma/command";
import { seedCommand } from "../commands/seed/command";
import { serviceCommand } from "../commands/service/command";
import { assertKnownCliInput } from "./validation";

export const toolSubCommands = {
  service: serviceCommand,
  db: dbCommand,
  prisma: prismaCommand,
  seed: seedCommand,
  factory: factoryCommand,
  i18n: i18nCommand,
} satisfies Record<string, Command>;

export const toolCommand = define({
  name: "tool",
  description: "Rezics repository maintenance CLI.",
}) satisfies Command;

export async function runToolCli(argv: string[]): Promise<void> {
  await cli(argv, toolCommand, {
    name: "tool",
    description: "Rezics repository maintenance CLI.",
    subCommands: toolSubCommands,
    usageOptionType: true,
    onBeforeCommand: assertKnownCliInput,
  });
}
