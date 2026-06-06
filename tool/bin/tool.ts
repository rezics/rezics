import { runToolCli } from "../src/cli/root";

await runToolCli(Bun.argv.slice(2));
