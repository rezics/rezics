import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const FORBIDDEN_IMPORTS = [
  "@rezics/server",
  "@rezics/preview",
  "elysia",
  "drizzle-orm",
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

describe("edge import boundary", () => {
  test("does not import backend-only packages", () => {
    const offenders = sourceFiles(import.meta.dir).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      return FORBIDDEN_IMPORTS.filter((name) => source.includes(`"${name}`))
        .concat(FORBIDDEN_IMPORTS.filter((name) => source.includes(`'${name}`)))
        .map((name) => ({ path, name }));
    });

    expect(offenders).toEqual([]);
  });
});
