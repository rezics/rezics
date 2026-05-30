import { runServiceCli } from "../src/commands/service/cli";

await runServiceCli(Bun.argv.slice(2));
