#!/usr/bin/env bun
/**
 * Convention check for API routes, folders, and architectural invariants.
 *
 * Rules enforced (see openspec/specs/ for normative source):
 * - R1  api-route-convention    — Elysia route prefixes must be singular
 * - R2  api-route-convention    — list/collection endpoints use /list suffix
 * - R3  folder-naming-convention — domain/feature folders are singular
 * - R4  folder-naming-convention — container folders are plural from allowlist
 * - R5  outbound-link-protection — no raw <a href> outside SafeLink
 * - R6  tanstack-query-keys      — no inline `queryKey: [` outside per-domain factories
 * - R9  ui-component-foundation  — ban `var(--rezics-…)` and hand-written tokens.css
 * - R11 i18n-toolchain           — no dynamic access to generated Paraglide messages
 * - R12 i18n-toolchain           — no i18nKey fields / legacy translation APIs
 * - R13 ui-package-autonomy      — core @rezics/ui cannot import host runtime deps
 * - R14 i18n-toolchain           — contract / Paraglide / catalogs share the same
 *                                  locale set with exact key parity
 *
 * Usage:
 *   bun run check:convention               # full scan
 *   bun run check:convention -- --staged   # only staged files
 *   bun run check:convention -- --snapshot # write expected-violations.json
 */

import { collectContext } from "./core/collect";
import { buildSnapshot, loadSnapshot, saveSnapshot } from "./core/snapshot";
import { ALL_RULES } from "./rules";

function formatByRule(byRule: Record<string, number>): string {
  const entries = Object.entries(byRule).sort(
    ([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)),
  );
  return entries.length === 0
    ? "none"
    : entries.map(([rule, count]) => `${rule}=${count}`).join("  ");
}

export function run(): void {
  const flags = new Set(process.argv.slice(2));
  const staged = flags.has("--staged");
  const updateSnapshot = flags.has("--snapshot");

  const ctx = collectContext({ staged });
  const violations = ALL_RULES.flatMap((rule) => rule.scan(ctx));
  const snapshot = buildSnapshot(violations);

  if (updateSnapshot) {
    saveSnapshot(snapshot);
    console.log(
      `Snapshot updated: ${snapshot.total} violations (${formatByRule(snapshot.byRule)})`,
    );
    process.exit(0);
  }

  if (violations.length === 0) {
    console.log("check:convention — 0 violations.");
    process.exit(0);
  }

  const baseline = loadSnapshot();
  const baselineKeys = new Set(baseline?.keys ?? []);
  const newViolations = violations.filter(
    (v) => !baselineKeys.has(`${v.rule}  ${v.path}`),
  );

  console.log(
    `check:convention — ${violations.length} violation(s) (baseline ${baseline?.total ?? 0}):`,
  );
  console.log(`  ${formatByRule(snapshot.byRule)}`);

  if (newViolations.length > 0) {
    console.log(
      `\n${newViolations.length} NEW violation(s) beyond baseline:\n`,
    );
    for (const v of newViolations) {
      console.log(`  [${v.rule}] ${v.path}`);
      console.log(`        ${v.message}`);
      console.log(`        see ${v.spec}`);
    }
    console.log(
      "\nFix new violations or update the baseline with: bun run check:convention -- --snapshot",
    );
    process.exit(1);
  }

  if (!staged) {
    console.log(
      "\nAll violations are in the baseline snapshot. Migration change will drive this to zero.",
    );
  }
  process.exit(0);
}

if (import.meta.main) {
  run();
}
