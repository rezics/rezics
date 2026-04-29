import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { seedInfra } from "../../package/server/prisma/seed/infra";
import type {
  SeedPlan,
  SeedPreset,
} from "../../package/server/prisma/seed/mocks/types";
import { getEnv } from "./env";
import { SEED_CACHE_DIR, getRepoRoot } from "./lib/cache-dir";
import { createAuthPrisma, createServerPrisma } from "./lib/create-prisma";
import { tweakPlan } from "./lib/interactive-plan";
import { resolveRootUserId, seedAllUsers } from "./lib/seed-users";
import { sweepStaleEditDirs } from "./lib/startup-sweep";
import { getPreset, listPresetNames, PRESETS } from "./presets";

type SeedTarget = "users" | "infra" | "mock";

interface CliFlags {
  preset?: string;
  noInteractive: boolean;
  unknown: string[];
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = { noInteractive: false, unknown: [] };
  for (const arg of argv) {
    if (arg === "--no-interactive") {
      flags.noInteractive = true;
    } else if (arg.startsWith("--preset=")) {
      flags.preset = arg.slice("--preset=".length);
    } else if (arg.startsWith("-")) {
      flags.unknown.push(arg);
    }
  }
  return flags;
}

function summarizePlan(plan: SeedPlan): string {
  return [
    `users:                ${plan.users.target ?? plan.users.max}`,
    `tags:                 ${plan.tags.target ?? plan.tags.max}`,
    `books/games/media:    ${plan.books.target ?? plan.books.max} / ${
      plan.games.target ?? plan.games.max
    } / ${plan.media.target ?? plan.media.max}`,
    `shelves:              ${plan.shelves.target ?? plan.shelves.max}`,
    `realms / zones:       ${plan.realms.target ?? plan.realms.max} / ${
      plan.zones.target ?? plan.zones.max
    }`,
    `person / org ents:    ${plan.personEntities.target ?? plan.personEntities.max} / ${
      plan.organizationEntities.target ?? plan.organizationEntities.max
    }`,
    `posts/work (max):     review=${plan.postsPerWork.review.max} excerpt=${plan.postsPerWork.excerpt.max} remark=${plan.postsPerWork.remark.max} tree=${plan.postsPerWork.tree.max}`,
    `chapter count range:  ${plan.chapter.count.min ?? 0}–${plan.chapter.count.max} (unitProb=${plan.chapter.unitProbability})`,
  ].join("\n  ");
}

function resolvePresetByName(name: string): SeedPreset {
  const preset = getPreset(name);
  if (!preset) {
    p.log.error(
      `Unknown preset "${name}". Available: ${listPresetNames().join(", ")}.`,
    );
    process.exit(2);
  }
  return preset;
}

async function selectPresetInteractively(): Promise<{
  name: string;
  preset: SeedPreset;
}> {
  const choice = await p.select<string>({
    message: "Pick a mock seed preset.",
    options: listPresetNames().map((name) => {
      const preset = PRESETS[name]!;
      return {
        value: name,
        label: name,
        hint: `mode=${preset.mode}`,
      };
    }),
  });
  if (p.isCancel(choice)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
  return { name: choice, preset: PRESETS[choice]! };
}

async function maybeTweak(
  preset: SeedPreset,
  flags: CliFlags,
): Promise<SeedPlan | null> {
  if (flags.noInteractive) return null;
  const wantTweak = await p.confirm({
    message: "Tweak plan in $EDITOR before running?",
    initialValue: false,
  });
  if (p.isCancel(wantTweak)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
  if (!wantTweak) return null;
  return tweakPlan(preset);
}

async function confirmRun(plan: SeedPlan, mode: string): Promise<void> {
  p.log.info(`Mode: ${mode}\n  ${summarizePlan(plan)}`);
  const ok = await p.confirm({
    message: "Reset DB and run mock seed with this plan?",
    initialValue: true,
  });
  if (p.isCancel(ok) || !ok) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
}

function writePlanFile(plan: SeedPlan): string {
  mkdirSync(SEED_CACHE_DIR, { recursive: true });
  const dir = mkdtempSync(join(SEED_CACHE_DIR, "plan-"));
  const file = join(dir, "plan.json");
  writeFileSync(file, JSON.stringify(plan, null, 2), "utf8");
  return file;
}

function spawnMockSeed(presetName: string, planFile?: string): Promise<void> {
  const repoRoot = getRepoRoot();
  const cwd = resolve(repoRoot, "package", "server");
  const args = [
    "run",
    "prisma/seed/mocks/seed.ts",
    `--preset=${presetName}`,
  ];
  if (planFile) args.push(`--plan-file=${planFile}`);

  return new Promise<void>((resolveSpawn, rejectSpawn) => {
    const child = spawn("bun", args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.once("error", rejectSpawn);
    child.once("exit", (code) => {
      if (code === 0) resolveSpawn();
      else rejectSpawn(new Error(`Mock seed exited with code ${code}.`));
    });
  });
}

async function runMockTarget(flags: CliFlags): Promise<void> {
  let presetName: string;
  let preset: SeedPreset;
  if (flags.preset) {
    presetName = flags.preset;
    preset = resolvePresetByName(presetName);
  } else if (flags.noInteractive) {
    presetName = "realistic";
    preset = PRESETS.realistic!;
  } else {
    const picked = await selectPresetInteractively();
    presetName = picked.name;
    preset = picked.preset;
  }

  const tweaked = await maybeTweak(preset, flags);
  const finalPlan = tweaked ?? preset.plan;

  if (!flags.noInteractive) {
    await confirmRun(finalPlan, preset.mode);
  }

  let planFile: string | undefined;
  if (tweaked) planFile = writePlanFile(tweaked);

  try {
    await spawnMockSeed(presetName, planFile);
  } finally {
    if (planFile) {
      try {
        rmSync(planFile, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

async function main() {
  sweepStaleEditDirs();
  const flags = parseArgs(process.argv.slice(2));

  if (flags.unknown.length > 0) {
    p.log.warn(`Ignoring unknown flag(s): ${flags.unknown.join(", ")}`);
  }

  if (flags.preset || flags.noInteractive) {
    p.intro("Rezics Seed");
    await runMockTarget(flags);
    p.outro("Done!");
    return;
  }

  p.intro("Rezics Seed");

  const targets = await p.multiselect<SeedTarget>({
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

  const shouldSeedUsers = targets.includes("users");
  const shouldSeedInfra = targets.includes("infra");
  const shouldSeedMock = targets.includes("mock");

  let overwrite = false;
  if (shouldSeedUsers) {
    const confirmOverwrite = await p.confirm({
      message:
        "Overwrite existing seed users? This will delete and re-create all 4 seed users.",
      initialValue: false,
    });

    if (p.isCancel(confirmOverwrite)) {
      p.cancel("Seed cancelled.");
      process.exit(0);
    }

    overwrite = confirmOverwrite;
  }

  const env = getEnv();
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma = createServerPrisma(env.SERVER_DATABASE_URL);

  try {
    let rootUserId: string | undefined;

    if (shouldSeedUsers) {
      const s = p.spinner();
      s.start(overwrite ? "Seeding users (overwrite)..." : "Seeding users...");

      const { rootUserId: id, results } = await seedAllUsers(
        authPrisma,
        serverPrisma,
        overwrite,
      );
      rootUserId = id;

      s.stop("Users seeded.");

      for (const { result, serverRole } of results) {
        p.log.info(
          [
            `${result.name} <${result.email}>`,
            `  Role: ${result.role} (auth) / ${serverRole} (server)`,
            `  Slug: ${result.slug}`,
            `  ID:   ${result.userId}`,
            `  Pass: ${result.password}`,
          ].join("\n"),
        );
      }

      p.log.warn("Store these passwords securely.");
    }

    if (shouldSeedInfra) {
      if (!rootUserId) {
        const s = p.spinner();
        s.start("Resolving root user...");
        rootUserId =
          (await resolveRootUserId(authPrisma, serverPrisma)) ?? undefined;
        s.stop(rootUserId ? "Root user found." : "Root user not found.");
      }

      if (!rootUserId) {
        p.log.error(
          "Root user (root@rezics.com) not found.\nPlease seed Users first, or select both.",
        );
        p.cancel("Cannot seed infrastructure without a root user.");
        process.exit(1);
      }

      const s = p.spinner();
      s.start("Seeding infrastructure...");

      await seedInfra(serverPrisma, rootUserId);

      s.stop("Infrastructure seeded.");
    }

    await Promise.all([authPrisma.$disconnect(), serverPrisma.$disconnect()]);

    if (shouldSeedMock) {
      await runMockTarget(flags);
    }

    p.outro("Done!");
  } catch (err) {
    await Promise.all([
      authPrisma.$disconnect().catch(() => {}),
      serverPrisma.$disconnect().catch(() => {}),
    ]);
    throw err;
  }
}

main().catch((err) => {
  p.log.error(String(err));
  process.exit(1);
});
