import * as p from "@clack/prompts";
import { runDbCommand } from "../db/command";
import { runMockCommand } from "../mock/command";
import { runSeedCommand } from "../seed/command";
import { sweepStaleEditDirs } from "../lib/startup-sweep";

type DefaultTarget = "users" | "infra" | "mock";

export async function runCli(argv: string[]): Promise<void> {
  sweepStaleEditDirs();

  const [first, ...rest] = argv;

  if (first === "seed") {
    p.intro("Rezics Seed");
    await runSeedCommand(rest);
    p.outro("Done!");
    return;
  }

  if (first === "mock") {
    p.intro("Rezics Mock");
    await runMockCommand(rest);
    p.outro("Done!");
    return;
  }

  if (first === "db") {
    await runDbCommand(rest);
    return;
  }

  // Default interactive flow — multiselect across users / infra / mock.
  // Preserves the original `bun run seed` behavior.
  const flagPreset = argv.find((a) => a.startsWith("--preset="));
  const flagNoInteractive = argv.includes("--no-interactive");

  if (flagPreset || flagNoInteractive) {
    p.intro("Rezics Seed");
    await runMockCommand(argv);
    p.outro("Done!");
    return;
  }

  p.intro("Rezics Seed");

  const targets = await p.multiselect<DefaultTarget>({
    message: "What would you like to seed?",
    options: [
      { value: "users", label: "Users", hint: "root, admin, user, blocked" },
      {
        value: "infra",
        label: "Infrastructure",
        hint: "seed tags, default realm",
      },
      { value: "mock", label: "Mock data", hint: "books, posts, shelves, …" },
    ],
  });

  if (p.isCancel(targets)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
  if (targets.length === 0) {
    p.cancel("Nothing selected.");
    process.exit(0);
  }

  const wantUsers = targets.includes("users");
  const wantInfra = targets.includes("infra");
  const wantMock = targets.includes("mock");

  let overwriteUsers = false;
  if (wantUsers) {
    const confirmOverwrite = await p.confirm({
      message:
        "Overwrite existing seed users? This will delete and re-create all 4 seed users.",
      initialValue: false,
    });
    if (p.isCancel(confirmOverwrite)) {
      p.cancel("Seed cancelled.");
      process.exit(0);
    }
    overwriteUsers = confirmOverwrite;
  }

  if (wantUsers || wantInfra) {
    const { runSeed } = await import("../seed/index");
    await runSeed({
      seedUsers: wantUsers,
      seedInfra: wantInfra,
      overwriteUsers,
    });
  }

  if (wantMock) {
    await runMockCommand([]);
  }

  p.outro("Done!");
}
