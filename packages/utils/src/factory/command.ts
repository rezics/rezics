import type { RunFactoryOptions } from "./index";

export type FactoryCommandOptions = RunFactoryOptions;

export async function runFactoryCommand(
  options: FactoryCommandOptions = {},
): Promise<void> {
  const { runFactory } = await import("./index");
  await runFactory(options);
}
