import "dotenv/config";
import * as p from "@clack/prompts";
import { runCli } from "../src/cli/runner";
import { EnvValidationError } from "../src/lib/env";

function renderEnvError(err: EnvValidationError): void {
  p.log.error(`Missing environment variables: ${err.missing.join(", ")}`);

  const lines: string[] = [];
  lines.push(
    "The seed CLI normally pulls these from each package's .env automatically:",
  );
  lines.push("  • packages/auth/.env   → DATABASE_URL → AUTH_DATABASE_URL");
  lines.push("  • packages/server/.env → DATABASE_URL → SERVER_DATABASE_URL");
  lines.push("  • packages/server/.env → MEILI_HOST / MEILI_MASTER_KEY");

  if (err.attempts.length > 0) {
    lines.push("");
    lines.push("Auto-load attempts:");
    for (const a of err.attempts) lines.push(`  • ${a}`);
  }

  lines.push("");
  lines.push("Fix one of:");
  lines.push("  1. Set up per-package envs (preferred):");
  lines.push("       cp packages/auth/.env.example   packages/auth/.env");
  lines.push("       cp packages/server/.env.example packages/server/.env");
  lines.push("");
  lines.push(
    "  2. Or set AUTH_DATABASE_URL, SERVER_DATABASE_URL, MEILI_HOST, and MEILI_MASTER_KEY in the project root .env.",
  );

  if (err.examplePath && err.exampleContents) {
    lines.push("");
    lines.push(`Template (${err.examplePath}):`);
    lines.push(err.exampleContents.trimEnd());
  }

  p.note(lines.join("\n"), "How to fix");
}

runCli(process.argv.slice(2)).catch((err) => {
  if (err instanceof EnvValidationError) {
    renderEnvError(err);
    process.exit(1);
  }
  p.log.error(String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
