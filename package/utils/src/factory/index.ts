import { readFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { SLUG_SCOPES } from "@rezics/contract";
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
  syncSeedManifestToMeili,
} from "@rezics/server/prisma/factory";
import * as v from "valibot";
import { getEnv } from "../lib/env";
import { createAuthPrisma, createServerPrisma } from "../lib/prisma-factory";
import {
  createFactorySyncDependencies,
  createSeedSearchClient,
} from "../lib/search";
import { printSeedCredentials, seedBaseline } from "../seed/index";
import { tweakPlan } from "./interactive";
import { getPreset, listPresetNames, PRESETS } from "./presets";

export interface RunFactoryOptions {
  presetName?: string;
  planFile?: string;
  noInteractive?: boolean;
  only?: "echokv";
  meiliMode?: string;
  scenarioNames?: string[];
  allScenarios?: boolean;
  noScenarios?: boolean;
  manifestFormat?: string;
}

type MeiliMode = "init-and-sync" | "skip";
type ManifestFormat = "human" | "json" | "both" | "none";

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
        hint: "initialize indexes, then targeted-sync manifest entries",
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
      "Reset auth and server databases, seed users/infrastructure, then run factory seed with this plan?",
    initialValue: true,
  });
  if (p.isCancel(ok) || !ok) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }
}

function resolveMeiliMode(value: string | undefined): MeiliMode {
  if (!value) return "skip";
  if (value === "init-and-sync" || value === "skip") return value;
  p.log.error('Unknown --meili value. Supported: "init-and-sync", "skip".');
  process.exit(2);
}

function resolveManifestFormat(value: string | undefined): ManifestFormat {
  if (!value) return "human";
  if (
    value === "human" ||
    value === "json" ||
    value === "both" ||
    value === "none"
  ) {
    return value;
  }
  p.log.error(
    'Unknown --manifest value. Supported: "human", "json", "both", "none".',
  );
  process.exit(2);
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

function printManifest(result: SeedResult, format: ManifestFormat): void {
  if (format === "none") return;

  if ((format === "human" || format === "both") && result.manifest.length > 0) {
    p.log.info(
      [
        "Special seed targets:",
        ...result.manifest.map((entry) => {
          const scenario = entry.scenario ? ` [${entry.scenario}]` : "";
          return `- ${entry.label}${scenario}: ${entry.unitType} ${entry.unitId}`;
        }),
      ].join("\n"),
    );
  }

  if (format === "json" || format === "both") {
    console.log(JSON.stringify({ manifest: result.manifest }, null, 2));
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
  const prisma = createServerPrisma(env.SERVER_DATABASE_URL);
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  const searchClient = createSeedSearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  const syncDeps = createFactorySyncDependencies(searchClient, prisma);
  try {
    if (meiliMode === "init-and-sync") {
      const { initMeiliSearch } = await import("@rezics/server/prisma/seed");
      await initMeiliSearch(searchClient, { clean: true });
    }
    const { credentials } = await seedBaseline(authPrisma, prisma);
    const slugScopeRows = await prisma.slugScope.findMany({
      select: { slug: true, unitId: true },
    });
    const scopeMap = new Map(
      slugScopeRows.map((r) => [r.slug, r.unitId] as const),
    );
    const slugScopes = {} as Record<string, string>;
    for (const name of SLUG_SCOPES) {
      const id = scopeMap.get(name);
      if (!id) {
        throw new Error(`Slug scope "${name}" is missing — seed first.`);
      }
      slugScopes[name] = id;
    }
    const ctx = makeSeedCtx(
      prisma,
      authPrisma,
      slugScopes as never,
      preset.mode,
    );
    const result = await runFactorySeed(ctx, plan);
    const scenarioResult = await runFactoryScenarios(ctx, scenarioNames);
    mergeSeedResults(result, scenarioResult);
    if (meiliMode === "init-and-sync") {
      const summary = await syncSeedManifestToMeili(
        ctx,
        result.manifest,
        syncDeps,
      );
      p.log.info(
        `Targeted Meili sync complete: ${summary.total} operation(s).`,
      );
    }
    printManifest(result, resolveManifestFormat(opts.manifestFormat));
    printSeedCredentials(credentials);
  } finally {
    await Promise.all([
      prisma.$disconnect().catch(() => {}),
      authPrisma.$disconnect().catch(() => {}),
    ]);
  }
}
