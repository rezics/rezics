import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const appSrc = join(import.meta.dir, "../../package/app/src");

// Scan all .ts/.tsx files under app/src recursively.
// 递归扫描 app/src 下所有 .ts/.tsx 文件。
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

describe("date format convergence", () => {
  test("no private formatDate / formatTimestamp / formatAddedAt / formatUpdatedAt / formatAt functions", () => {
    const forbidden =
      /function\s+(formatDate|formatTimestamp|formatAddedAt|formatUpdatedAt|formatAt)\s*\(/;
    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      const match = forbidden.exec(src);
      if (match) {
        const rel = file.replace(appSrc, "app/src");
        throw new Error(
          `${rel} contains private '${match[1]}' — use formatDate/formatDateTime from @rezics/ui`,
        );
      }
    }
  });

  test("@rezics/ui exports formatDate and formatDateTime", () => {
    const src = readFileSync(
      join(
        import.meta.dir,
        "../../package/ui/src/primitive/datetime/formatDate.ts",
      ),
      "utf-8",
    );
    expect(src).toContain("export function formatDate(");
    expect(src).toContain("export function formatDateTime(");
  });
});
