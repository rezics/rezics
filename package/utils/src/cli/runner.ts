import { runRepoToolCli } from "../../../../tool/cli";

export async function runCli(argv: string[]): Promise<void> {
  await runRepoToolCli(argv);
}
