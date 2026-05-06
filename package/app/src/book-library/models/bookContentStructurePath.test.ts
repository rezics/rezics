import { describe, expect, test } from "bun:test";
import {
  findBookContentStructureOccurrence,
  materializedOrPathId,
  withBookContentStructureOccurrences,
} from "./bookContentStructurePath";

describe("BookContentStructure occurrence helpers", () => {
  test("handles mixed groups, unmaterialized nodes, materialized nodes, and repeated chapterUnitId values", () => {
    const tree = withBookContentStructureOccurrences([
      {
        title: "Volume 1",
        children: [
          { title: "Empty Chapter" },
          { title: "Route A", chapterUnitId: "chapter-shared" },
        ],
      },
      { title: "Route B", chapterUnitId: "chapter-shared" },
    ]);

    const group = findBookContentStructureOccurrence(tree, [0]);
    const empty = findBookContentStructureOccurrence(tree, [0, 0]);
    const routeA = findBookContentStructureOccurrence(tree, [0, 1]);
    const routeB = findBookContentStructureOccurrence(tree, [1]);

    expect(group?.occurrenceId).toBe("path:0");
    expect(empty?.occurrenceId).toBe("path:0.0");
    expect(empty?.chapterUnitId).toBeUndefined();
    expect(routeA?.chapterUnitId).toBe("chapter-shared");
    expect(routeB?.chapterUnitId).toBe("chapter-shared");
    expect(materializedOrPathId(empty!)).toBe("path:0.0");
    expect(materializedOrPathId(routeA!)).toBe("chapter-shared");
    expect(materializedOrPathId(routeB!)).toBe("chapter-shared");
  });
});
