import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry.includes(".gen.")) continue;
    if (statSync(full).isDirectory()) {
      collectTsxFiles(full, acc);
    } else if (
      full.endsWith(".tsx") &&
      !entry.includes(".test.") &&
      !entry.includes(".stories.")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

// Route-level boundaries are set at the router level via default*Component.
// Individual routes should not redundantly spread routeBoundaries().
// 路由级边界已在 router 层通过 default*Component 统一设置。
// 各路由不应冗余地展开 routeBoundaries()。
describe("route boundaries convergence", () => {
  const routerFile = join(import.meta.dir, "../../package/app/src/router.tsx");

  test("router.tsx sets all three default boundary components", () => {
    const content = readFileSync(routerFile, "utf-8");
    expect(content).toContain("defaultErrorComponent");
    expect(content).toContain("defaultPendingComponent");
    expect(content).toContain("defaultNotFoundComponent");
  });

  test("no route file redundantly spreads routeBoundaries()", () => {
    const routesDir = join(import.meta.dir, "../../package/app/src/routes");
    const routeFiles = collectTsxFiles(routesDir);
    const violations: string[] = [];
    for (const file of routeFiles) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("routeBoundaries")) {
        violations.push(file.replace(routesDir, ""));
      }
    }
    expect(violations).toEqual([]);
  });
});
