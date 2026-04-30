import * as p from "@clack/prompts";
import { runSeed } from "./index";

export interface SeedCliFlags {
  target?: "auth" | "server" | "all";
  overwriteUsers: boolean;
  noInteractive: boolean;
  unknown: string[];
}

export function parseSeedArgs(argv: string[]): SeedCliFlags {
  const flags: SeedCliFlags = {
    overwriteUsers: false,
    noInteractive: false,
    unknown: [],
  };
  for (const arg of argv) {
    if (arg === "--no-interactive") {
      flags.noInteractive = true;
    } else if (arg === "--overwrite-users") {
      flags.overwriteUsers = true;
    } else if (arg.startsWith("--target=")) {
      const v = arg.slice("--target=".length);
      if (v === "auth" || v === "server" || v === "all") {
        flags.target = v;
      } else {
        flags.unknown.push(arg);
      }
    } else if (arg.startsWith("-")) {
      flags.unknown.push(arg);
    }
  }
  return flags;
}

export async function runSeedCommand(argv: string[]): Promise<void> {
  const flags = parseSeedArgs(argv);

  if (flags.unknown.length > 0) {
    console.warn(`Ignoring unknown flag(s): ${flags.unknown.join(", ")}`);
  }

  const target = flags.target ?? "all";
  let seedUsers = target === "auth" || target === "all";
  let seedInfra = target === "server" || target === "all";
  let overwriteUsers = flags.overwriteUsers;

  if (!flags.noInteractive && !flags.target) {
    const targets = await p.multiselect<"users" | "infra">({
      message: "What would you like to seed?",
      options: [
        { value: "users", label: "Users", hint: "root, admin, user, blocked" },
        {
          value: "infra",
          label: "Infrastructure",
          hint: "seed tags, default realm",
        },
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

    seedUsers = targets.includes("users");
    seedInfra = targets.includes("infra");

    if (seedUsers && !flags.overwriteUsers) {
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
  }

  await runSeed({ seedUsers, seedInfra, overwriteUsers });
}
