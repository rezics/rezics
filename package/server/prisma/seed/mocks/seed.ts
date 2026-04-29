import "dotenv/config";
import { readFileSync } from "node:fs";
import * as v from "valibot";
import { prisma } from "#/prisma/client";
import { realistic } from "../../../../../tool/seed/presets/realistic";
import { fast } from "../../../../../tool/seed/presets/fast";
import { minimal } from "../../../../../tool/seed/presets/minimal";
import { postTreeFocus } from "../../../../../tool/seed/presets/post-tree-focus";
import { runMockSeed } from "./orchestrator.js";
import { makeSeedCtx } from "./strategy.js";
import {
  SeedPlanSchema,
  type SeedPlan,
  type SeedPreset,
} from "./types.js";

process.on("unhandledRejection", (reason) => {
  console.error("[Error] Unhandled rejection:", reason);
  if (reason instanceof Error && reason.stack) console.error(reason.stack);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[Error] Uncaught exception:", err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});

const PRESETS: Record<string, SeedPreset> = {
  realistic,
  fast,
  minimal,
  "post-tree-focus": postTreeFocus,
};

function parseArgs(): { preset: string; planFile?: string } {
  let preset = "realistic";
  let planFile: string | undefined;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--preset=")) preset = arg.slice("--preset=".length);
    else if (arg.startsWith("--plan-file="))
      planFile = arg.slice("--plan-file=".length);
  }
  return { preset, planFile };
}

function resolvePlan(preset: SeedPreset, planFile?: string): SeedPlan {
  if (!planFile) return preset.plan;
  const raw = readFileSync(planFile, "utf8");
  const parsed = JSON.parse(raw);
  return v.parse(SeedPlanSchema, parsed);
}

async function main() {
  const { preset: presetName, planFile } = parseArgs();
  const preset = PRESETS[presetName];
  if (!preset) {
    console.error(
      `[Seed] Unknown preset "${presetName}". Available: ${Object.keys(PRESETS).join(", ")}.`,
    );
    process.exit(2);
  }

  const plan = resolvePlan(preset, planFile);
  const ctx = makeSeedCtx(prisma, preset.mode);
  await runMockSeed(ctx, plan);
}

main()
  .catch((err) => {
    console.error("[Error] Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
