import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import * as v from "valibot";
import {
  SeedPlanSchema,
  type SeedPlan,
  type SeedPreset,
} from "../../../package/server/prisma/seed/mocks/types";
import { SEED_CACHE_DIR } from "./cache-dir";
import { resolveEditorCommand, spawnEditor } from "./editor";

function ensureCacheDir(): void {
  mkdirSync(SEED_CACHE_DIR, { recursive: true });
}

function makeEditDir(): string {
  ensureCacheDir();
  return mkdtempSync(join(SEED_CACHE_DIR, "edit-"));
}

function formatIssue(issue: v.BaseIssue<unknown>): string {
  const path =
    issue.path?.map((segment) => String(segment.key)).join(".") ?? "(root)";
  return `  ${path}: ${issue.message}`;
}

export async function tweakPlan(preset: SeedPreset): Promise<SeedPlan> {
  const editDir = makeEditDir();
  const planPath = join(editDir, "plan.json");
  const editor = resolveEditorCommand();

  const cleanup = () => {
    try {
      rmSync(editDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };

  const onSignal = () => {
    cleanup();
    process.exit(130);
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    writeFileSync(planPath, `${JSON.stringify(preset.plan, null, 2)}\n`, "utf8");

    while (true) {
      await spawnEditor(editor, planPath);

      const raw = readFileSync(planPath, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        p.log.error(
          `JSON parse failed at ${planPath}:\n  ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        const retry = await p.confirm({
          message: "Edit again?",
          initialValue: true,
        });
        if (p.isCancel(retry) || !retry) {
          throw new Error("Plan edit aborted.");
        }
        continue;
      }

      if (
        parsed !== null &&
        typeof parsed === "object" &&
        "mode" in (parsed as Record<string, unknown>)
      ) {
        p.log.error(
          "Top-level `mode` cannot be changed via the plan editor — it is fixed by the preset. Remove the `mode` key.",
        );
        const retry = await p.confirm({
          message: "Edit again?",
          initialValue: true,
        });
        if (p.isCancel(retry) || !retry) {
          throw new Error("Plan edit aborted.");
        }
        continue;
      }

      const result = v.safeParse(SeedPlanSchema, parsed);
      if (!result.success) {
        p.log.error(
          `Plan validation failed at ${planPath}:\n${result.issues
            .map(formatIssue)
            .join("\n")}`,
        );
        const retry = await p.confirm({
          message: "Edit again?",
          initialValue: true,
        });
        if (p.isCancel(retry) || !retry) {
          throw new Error("Plan edit aborted.");
        }
        continue;
      }

      return result.output;
    }
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    cleanup();
  }
}
