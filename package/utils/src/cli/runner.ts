import { runToolCli } from "../../../../tool/src/cli/root";

export async function runCli(argv: string[]): Promise<void> {
  await runToolCli(argv);
}
