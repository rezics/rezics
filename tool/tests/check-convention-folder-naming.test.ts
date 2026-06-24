import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { REPO_ROOT } from "../src/commands/convention/core/paths";
import { scanFolderNamingForTest } from "../src/commands/convention/rules";

function abs(relPath: string): string {
  return join(REPO_ROOT, relPath);
}

describe("folder naming convention checks", () => {
  test("allows file-router segment folders under app routes", () => {
    expect(
      scanFolderNamingForTest([
        abs("packages/app/src/routes/_mainLayout/z/$slug/page"),
      ]),
    ).toEqual([]);
  });

  test("still rejects singular container names outside routes", () => {
    expect(
      scanFolderNamingForTest([abs("packages/app/src/zone/page")]).map(
        (violation) => violation.rule,
      ),
    ).toContain("R3");
  });
});
