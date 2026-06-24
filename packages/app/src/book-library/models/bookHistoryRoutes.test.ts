import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routeTreePath = join(import.meta.dir, "../../routeTree.gen.ts");

describe("book history route metadata", () => {
  test("keeps edit history detail and compare under the edit history parent", () => {
    const routeTree = readFileSync(routeTreePath, "utf8");

    expect(routeTree).toContain("BookBookIdEditHistoryRouteChildren");
    expect(routeTree).toContain("BookBookIdEditHistoryIndexRoute");
    expect(routeTree).toContain("BookBookIdEditHistorySequenceRoute");
    expect(routeTree).toContain(
      "BookBookIdEditHistoryCompareTargetSequenceRoute",
    );
  });

  test("does not expose legacy non-edit book history routes", () => {
    const routeTree = readFileSync(routeTreePath, "utf8");

    expect(routeTree).not.toContain("/book/$bookId/history");
    expect(routeTree).not.toContain("_mainLayout/book/$bookId/history");
  });
});
