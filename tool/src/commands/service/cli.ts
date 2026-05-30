import { cli, define } from "gunshi";
import { assertKnownCliInput } from "../../cli/validation";
import { serviceSubCommands } from "./command";

const standaloneServiceCommand = define({
  name: "service",
  description:
    "Start, stop, inspect, and repair repo-managed development services.",
});

export async function runServiceCli(argv: string[]): Promise<void> {
  await cli(argv, standaloneServiceCommand, {
    name: "service",
    description:
      "Start, stop, inspect, and repair repo-managed development services.",
    subCommands: serviceSubCommands,
    usageOptionType: true,
    onBeforeCommand: assertKnownCliInput,
  });
}
