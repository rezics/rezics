import { readFileSync } from "node:fs";
import * as p from "@clack/prompts";
import {
  FACTORY_SCENARIO_NAMES,
  FACTORY_SCENARIOS,
  type FactoryScenarioName,
  makeSeedCtx,
  mergeSeedResults,
  runFactoryScenarios,
  runFactorySeed,
  type SeedPlan,
  SeedPlanSchema,
  type SeedPreset,
  type SeedResult,
} from "@rezics/server/db/seed-factory";
import * as v from "valibot";
import { getEnv } from "../lib/env";
import { createAuthPrisma, createServerPrisma } from "../lib/prisma-factory";
import { createSeedSearchClient } from "../lib/search";
import { printSeedCredentials, seedBaseline } from "../seed/index";
import {
  createSeedRuntime,
  type ManifestFormat,
  type MeiliMode,
} from "../seed/runtime";
import { tweakPlan } from "./interactive";
import { getPreset, listPresetNames, PRESETS } from "./presets";

export interface RunFactoryOptions {
  presetName?: string;
  planFile?: string;
  noInteractive?: boolean;
  only?: "echokv";
  meiliMode?: MeiliMode;
  scenarioNames?: string[];
  allScenarios?: boolean;
  noScenarios?: boolean;
  manifestFormat?: ManifestFormat;
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

async function selectMeiliModeInteractively(): Promise<MeiliMode> {
  const choice = await p.select<MeiliMode>({
    message: "Pick Meili mode.",
    options: [
      {
        value: "init-and-sync",
        label: "init-and-sync",
        hint: "initialize indexes, then sync seeded Units through hooks",
      },
      { value: "skip", label: "skip", hint: "do not touch Meilisearch" },
    ],
  });
  if (p.isCancel(choice)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
  return choice;
}

async function selectScenariosInteractively(): Promise<FactoryScenarioName[]> {
  const selected = await p.multiselect<FactoryScenarioName>({
    message: "Pick special factory scenarios.",
    options: FACTORY_SCENARIO_NAMES.map((name) => ({
      value: name,
      label: name,
      hint: FACTORY_SCENARIOS[name].description,
    })),
    initialValues: FACTORY_SCENARIO_NAMES.filter(
      (name) => FACTORY_SCENARIOS[name].defaultSelected,
    ),
  });
  if (p.isCancel(selected)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
  return [...selected];
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

async function confirmRun(
  plan: SeedPlan,
  mode: string,
  meiliMode: MeiliMode,
  scenarios: FactoryScenarioName[],
): Promise<void> {
  p.log.info(
    `Mode: ${mode}\nMeili: ${meiliMode}\nScenarios: ${
      scenarios.length > 0 ? scenarios.join(", ") : "none"
    }\n  ${summarizePlan(plan)}`,
  );
  const ok = await p.confirm({
    message:
      "Seed users/infrastructure without resetting databases, then run factory seed with this plan?",
    initialValue: true,
  });
  if (p.isCancel(ok) || !ok) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
}

function resolveMeiliMode(value: MeiliMode | undefined): MeiliMode {
  if (!value) return "skip";
  return value;
}

function resolveManifestFormat(
  value: ManifestFormat | undefined,
): ManifestFormat {
  if (!value) return "human";
  return value;
}

function resolveScenarioNames(
  opts: Pick<
    RunFactoryOptions,
    "scenarioNames" | "allScenarios" | "noScenarios" | "noInteractive"
  >,
): FactoryScenarioName[] {
  if (opts.allScenarios && opts.noScenarios) {
    p.log.error("--all-scenarios and --no-scenarios cannot be combined.");
    process.exit(2);
  }

  if (opts.noScenarios) return [];
  if (opts.allScenarios) return [...FACTORY_SCENARIO_NAMES];

  const names = opts.scenarioNames ?? [];
  const invalid = names.filter(
    (name): name is string =>
      !FACTORY_SCENARIO_NAMES.includes(name as FactoryScenarioName),
  );
  if (invalid.length > 0) {
    p.log.error(
      `Unknown scenario(s): ${invalid.join(", ")}. Available: ${FACTORY_SCENARIO_NAMES.join(", ")}.`,
    );
    process.exit(2);
  }

  return [...new Set(names as FactoryScenarioName[])];
}

function printSpecialTargets(result: SeedResult, format: ManifestFormat): void {
  if (format === "none") return;

  if (
    (format === "human" || format === "both") &&
    result.specialTargets.length > 0
  ) {
    p.log.info(
      [
        "Special seed targets:",
        ...result.specialTargets.map(
          (entry) =>
            `- ${entry.label} [${entry.scenario}]: ${entry.unitType} ${entry.unitId}`,
        ),
      ].join("\n"),
    );
  }

  if (format === "json" || format === "both") {
    console.log(
      JSON.stringify({ specialTargets: result.specialTargets }, null, 2),
    );
  }
}

function loadPlanFromFile(planFile: string): SeedPlan {
  const raw = readFileSync(planFile, "utf8");
  const parsed = JSON.parse(raw);
  return v.parse(SeedPlanSchema, parsed);
}

async function runEchoKvOnly(): Promise<void> {
  const env = getEnv();
  const { createServerDb } = await import("@rezics/server/db/factory");
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);
  try {
    const { seedEchoKVWithDb } = await import(
      "@rezics/server/db/seed-factory/echokv"
    );
    await seedEchoKVWithDb(serverDb.db);
  } finally {
    await serverDb.disconnect();
  }
}

export async function runFactory(opts: RunFactoryOptions): Promise<void> {
  if (opts.only === "echokv") {
    await runEchoKvOnly();
    return;
  }

  let presetName: string;
  let preset: SeedPreset;
  let meiliMode = resolveMeiliMode(opts.meiliMode);
  let scenarioNames = resolveScenarioNames(opts);

  if (opts.presetName) {
    presetName = opts.presetName;
    preset = resolvePresetByName(presetName);
  } else if (opts.noInteractive) {
    presetName = "realistic";
    preset = PRESETS.realistic!;
  } else {
    meiliMode = await selectMeiliModeInteractively();
    const picked = await selectPresetInteractively();
    presetName = picked.name;
    preset = picked.preset;
    scenarioNames = await selectScenariosInteractively();
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
    await confirmRun(plan, preset.mode, meiliMode, scenarioNames);
  }

  const env = getEnv();
  const { createServerDb } = await import("@rezics/server/db/factory");
  const prisma = createServerPrisma(env.SERVER_DATABASE_URL);
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  const searchClient = createSeedSearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  const runtime = createSeedRuntime({
    config: {
      meiliMode,
      manifestFormat: resolveManifestFormat(opts.manifestFormat),
      scenarioNames,
    },
    authPrisma,
    serverPrisma: prisma,
    searchClient,
  });
  try {
    if (meiliMode === "init-and-sync") {
      const { initMeiliSearch } = await import("@rezics/server/db/seed");
      await initMeiliSearch(searchClient, { clean: true });
    }
    const { credentials, slugScopes } = await seedBaseline(authPrisma, {
      serverSeedDb: serverDb.db,
    });
    const ctx = makeSeedCtx(
      prisma,
      authPrisma,
      slugScopes as never,
      preset.mode,
      runtime.sync,
    );
    for (const credential of credentials) {
      await runtime.sync.user(credential.result.userId);
    }
    const result = await runFactorySeed(ctx, plan);
    const scenarioResult = await runFactoryScenarios(ctx, scenarioNames);
    mergeSeedResults(result, scenarioResult);
    if (meiliMode === "init-and-sync") {
      p.log.info(
        `Targeted Meili sync complete: ${runtime.state.syncSummary.total} operation(s).`,
      );
    }
    printSpecialTargets(result, runtime.config.manifestFormat);
    printSeedCredentials(credentials);
  } finally {
    await Promise.all([
      runtime.dispose(),
      serverDb.disconnect().catch(() => {}),
    ]);
  }
}
