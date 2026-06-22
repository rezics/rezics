import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const engagementDir = join(
  import.meta.dir,
  "../../package/app/src/engagement/components",
);

const componentFiles = readdirSync(engagementDir).filter((f) =>
  f.endsWith(".tsx"),
);

describe("engagement icon size convergence", () => {
  test("no private sizeToIconPx functions remain in engagement components", () => {
    for (const file of componentFiles) {
      const src = readFileSync(join(engagementDir, file), "utf-8");
      expect(src).not.toContain("function sizeToIconPx");
    }
  });

  test("types.ts exports ENGAGEMENT_ICON_PX", () => {
    const src = readFileSync(
      join(engagementDir, "../types.ts"),
      "utf-8",
    );
    expect(src).toContain("export const ENGAGEMENT_ICON_PX");
  });
});
