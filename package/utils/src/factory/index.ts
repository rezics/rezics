import { readFileSync } from "node:fs";
import * as p from "@clack/prompts";
import {
  makeSeedCtx,
  runFactorySeed,
  type SeedPlan,
  SeedPlanSchema,
  type SeedPreset,
} from "@rezics/server/prisma/factory";
import * as v from "valibot";
import { getEnv } from "../lib/env";
import { createAuthPrisma, createServerPrisma } from "../lib/prisma-factory";
import { seedBaseline } from "../seed/index";
import { tweakPlan } from "./interactive";
import { getPreset, listPresetNames, PRESETS } from "./presets";

export interface RunFactoryOptions {
  presetName?: string;
  planFile?: string;
  noInteractive?: boolean;
  only?: "echokv";
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
    message: "Pick a factory seed preset.",
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
  noInteractive: boolean,
): Promise<SeedPlan | null> {
  if (noInteractive) return null;
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

async function confirmRun(plan: SeedPlan, mode: string): Promise<void> {
  p.log.info(`Mode: ${mode}\n  ${summarizePlan(plan)}`);
  const ok = await p.confirm({
    message:
      "Reset auth and server databases, seed users/infrastructure, then run factory seed with this plan?",
    initialValue: true,
  });
  if (p.isCancel(ok) || !ok) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
}

function loadPlanFromFile(planFile: string): SeedPlan {
  const raw = readFileSync(planFile, "utf8");
  const parsed = JSON.parse(raw);
  return v.parse(SeedPlanSchema, parsed);
}

async function runEchoKvOnly(): Promise<void> {
  const env = getEnv();
  const prisma = createServerPrisma(env.SERVER_DATABASE_URL);
  try {
    const { seedEchoKV } = await import("@rezics/server/prisma/factory/echokv");
    await seedEchoKV(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function runFactory(opts: RunFactoryOptions): Promise<void> {
  if (opts.only === "echokv") {
    await runEchoKvOnly();
    return;
  }

  let presetName: string;
  let preset: SeedPreset;

  if (opts.presetName) {
    presetName = opts.presetName;
    preset = resolvePresetByName(presetName);
  } else if (opts.noInteractive) {
    presetName = "realistic";
    preset = PRESETS.realistic!;
  } else {
    const picked = await selectPresetInteractively();
    presetName = picked.name;
    preset = picked.preset;
  }
  void presetName;

  let plan: SeedPlan;
  if (opts.planFile) {
    plan = loadPlanFromFile(opts.planFile);
  } else {
    const tweaked = await maybeTweak(preset, !!opts.noInteractive);
    plan = tweaked ?? preset.plan;
  }

  if (!opts.noInteractive && !opts.planFile) {
    await confirmRun(plan, preset.mode);
  }

  const env = getEnv();
  const prisma = createServerPrisma(env.SERVER_DATABASE_URL);
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  try {
    await seedBaseline(authPrisma, prisma);
    const ctx = makeSeedCtx(prisma, authPrisma, preset.mode);
    await runFactorySeed(ctx, plan);
  } finally {
    await Promise.all([
      prisma.$disconnect().catch(() => {}),
      authPrisma.$disconnect().catch(() => {}),
    ]);
  }
}
