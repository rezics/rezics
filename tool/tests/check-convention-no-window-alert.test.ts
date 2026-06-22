import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

// Recursively collect TS/TSX files, skipping node_modules and generated files.
// 递归收集 TS/TSX 文件，跳过 node_modules 和生成文件。
function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".gen.") continue;
    if (statSync(full).isDirectory()) {
      collectTsFiles(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.includes(".gen.")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("WindowAlert legacy system fully removed", () => {
  const appDir = join(import.meta.dir, "../../package/app/src");
  const adminDir = join(import.meta.dir, "../../package/admin/src");

  const allFiles = [...collectTsFiles(appDir), ...collectTsFiles(adminDir)];

  test("no source file imports useAlertStore or WindowAlert", () => {
    const violations: string[] = [];
    for (const file of allFiles) {
      const content = readFileSync(file, "utf-8");
      if (
        content.includes("useAlertStore") ||
        content.includes("windowAlertStore") ||
        content.includes("WindowAlert")
      ) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  test("windowAlertStore.ts files do not exist", () => {
    const storeFiles = allFiles.filter((f) =>
      f.includes("windowAlertStore"),
    );
    expect(storeFiles).toEqual([]);
  });

  test("WindowAlert.tsx files do not exist", () => {
    const componentFiles = allFiles.filter((f) =>
      f.includes("WindowAlert.tsx"),
    );
    expect(componentFiles).toEqual([]);
  });
});
