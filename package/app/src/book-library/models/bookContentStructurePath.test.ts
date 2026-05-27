import { describe, expect, test } from "bun:test";
import {
  contentUnitIdForNode,
  findBookContentStructureOccurrence,
  materializedOrPathId,
  withBookContentStructureOccurrences,
} from "./bookContentStructurePath";

describe("BookContentStructure occurrence helpers", () => {
  test("handles mixed groups, unmaterialized nodes, materialized nodes, and repeated contentUnitId values", () => {
    const tree = withBookContentStructureOccurrences([
      {
        title: "Volume 1",
        children: [
          { title: "Empty Chapter" },
          { title: "Route A", contentUnitId: "chapter-shared" },
        ],
      },
      { title: "Route B", contentUnitId: "chapter-shared" },
    ]);

    const group = findBookContentStructureOccurrence(tree, [0]);
    const empty = findBookContentStructureOccurrence(tree, [0, 0]);
    const routeA = findBookContentStructureOccurrence(tree, [0, 1]);
    const routeB = findBookContentStructureOccurrence(tree, [1]);

    expect(group?.occurrenceId).toBe("path:0");
    expect(empty?.occurrenceId).toBe("path:0.0");
    expect(contentUnitIdForNode(empty!)).toBeUndefined();
    expect(contentUnitIdForNode(routeA!)).toBe("chapter-shared");
    expect(contentUnitIdForNode(routeB!)).toBe("chapter-shared");
    expect(materializedOrPathId(empty!)).toBe("path:0.0");
    expect(materializedOrPathId(routeA!)).toBe("chapter-shared");
    expect(materializedOrPathId(routeB!)).toBe("chapter-shared");
  });

  test("uses contentUnitId as the only materialized node identity", () => {
    const tree = withBookContentStructureOccurrences([
      { title: "Canonical", contentUnitId: "chapter-content" },
    ]);

    expect(contentUnitIdForNode(tree[0]!)).toBe("chapter-content");
    expect(materializedOrPathId(tree[0]!)).toBe("chapter-content");
  });
});
