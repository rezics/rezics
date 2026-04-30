import "dotenv/config";
import * as p from "@clack/prompts";
import { runCli } from "../src/cli/runner";

runCli(process.argv.slice(2)).catch((err) => {
  p.log.error(String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
