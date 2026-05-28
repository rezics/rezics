#!/usr/bin/env bun
/**
 * Entry point for the convention check. The rule implementations and
 * orchestration live in `./check-convention/` — this file exists so that
 * `bun run tool/scripts/check-convention.ts` still works and so test files
 * can import helpers via `./check-convention`.
 */
import { run } from "./check-convention/index";

export { scanI18nSourceForTest } from "./check-convention/rules";

if (import.meta.main) {
  run();
}
