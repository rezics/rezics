import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const appSrc = join(import.meta.dir, "../../package/app/src");

function walk(dir: string): string[] {
  const entries: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, d.name);
    if (d.isDirectory()) entries.push(...walk(full));
    else if (/\.(tsx?)$/.test(d.name)) entries.push(full);
  }
  return entries;
}

const files = walk(appSrc).filter(
  (f) =>
    !f.includes(".gen.") && !f.includes(".test.") && !f.includes("/shadcn/"),
);

describe("unit href convergence", () => {
  test("no private SLUG_TARGET_PREFIX maps duplicating unitHref prefix tables", () => {
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      if (/\bSLUG_TARGET_PREFIX\b/.test(src)) {
        const rel = file.replace(appSrc, "app/src");
        throw new Error(
          `${rel} contains SLUG_TARGET_PREFIX — use unitHref() from @rezics/ui`,
        );
      }
    }
  });

  test("@rezics/ui unitHref covers ID_ONLY_PREFIX for BOOK, POST, QUOTE, POLL, SHELF", () => {
    const src = readFileSync(
      join(import.meta.dir, "../../package/ui/src/primitive/link/unitHref.ts"),
      "utf-8",
    );
    for (const type of ["BOOK", "POST", "QUOTE", "POLL", "SHELF"]) {
      expect(src).toContain(`${type}:`);
    }
    expect(src).toContain("ID_ONLY_PREFIX");
  });
});
