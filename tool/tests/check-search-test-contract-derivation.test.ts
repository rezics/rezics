import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const appSrc = join(import.meta.dir, "../../package/app/src");

describe("search test contract derivation", () => {
  test("SearchCategoryNav.test derives categories from contract, not hand-copy", () => {
    const src = readFileSync(
      join(appSrc, "search/components/SearchCategoryNav.test.ts"),
      "utf-8",
    );
    expect(src).toContain('from "@rezics/contract"');
    expect(src).toContain("SEARCH_CATEGORIES");
  });

  test("FederatedSearchPage.test.ts redundant hand-copy is deleted", () => {
    expect(
      existsSync(join(appSrc, "search/pages/FederatedSearchPage.test.ts")),
    ).toBe(false);
  });

  test("unit.service.ts uses getTableColumns for dynamic sort, not as unknown as", () => {
    const src = readFileSync(
      join(import.meta.dir, "../../package/server/src/unit/unit.service.ts"),
      "utf-8",
    );
    expect(src).toContain("getTableColumns");
    expect(src).not.toContain("as unknown as");
  });
});
