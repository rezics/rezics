import { describe, expect, mock, test } from "bun:test";
import {
  buildFactoryContentStructureAnchorRows,
  rebuildFactoryContentStructureAnchors,
} from "./content-structure";

describe("buildFactoryContentStructureAnchorRows", () => {
  test("projects materialized nodes with path and title ancestry", () => {
    const anchors = buildFactoryContentStructureAnchorRows("book-1", [
      {
        id: "node-root",
        parentId: null,
        sortKey: "h",
        contentUnitId: null,
        title: "Root",
      },
      {
        id: "node-b",
        parentId: "node-root",
        sortKey: "q",
        contentUnitId: "chapter-b",
        title: "Chapter B",
      },
      {
        id: "node-a",
        parentId: "node-root",
        sortKey: "c",
        contentUnitId: "chapter-a",
        title: "Chapter A",
      },
    ]);

    expect(anchors).toEqual([
      {
        nodeId: "node-a",
        ownerUnitId: "book-1",
        contentUnitId: "chapter-a",
        parentNodeId: "node-root",
        ancestorNodeIds: ["node-root"],
        path: ["node-root", "node-a"],
        depth: 1,
        sortKey: "c",
        sortPath: "h.c",
        titlePath: ["Root", "Chapter A"],
      },
      {
        nodeId: "node-b",
        ownerUnitId: "book-1",
        contentUnitId: "chapter-b",
        parentNodeId: "node-root",
        ancestorNodeIds: ["node-root"],
        path: ["node-root", "node-b"],
        depth: 1,
        sortKey: "q",
        sortPath: "h.q",
        titlePath: ["Root", "Chapter B"],
      },
    ]);
  });
});

describe("rebuildFactoryContentStructureAnchors", () => {
  test("replaces existing anchors for the owner unit", async () => {
    const deleteMany = mock(async () => ({ count: 0 }));
    const createMany = mock(async () => ({ count: 1 }));
    const findMany = mock(async () => [
      {
        id: "node-1",
        parentId: null,
        sortKey: "h",
        contentUnitId: "chapter-1",
        title: "Chapter 1",
      },
    ]);

    await rebuildFactoryContentStructureAnchors(
      {
        contentStructureNode: { findMany },
        contentStructureAnchor: { deleteMany, createMany },
      } as never,
      "book-1",
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { ownerUnitId: "book-1", isDeleted: false },
      select: {
        id: true,
        parentId: true,
        sortKey: true,
        contentUnitId: true,
        title: true,
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { ownerUnitId: "book-1" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          nodeId: "node-1",
          ownerUnitId: "book-1",
          contentUnitId: "chapter-1",
          parentNodeId: null,
          ancestorNodeIds: [],
          path: ["node-1"],
          depth: 0,
          sortKey: "h",
          sortPath: "h",
          titlePath: ["Chapter 1"],
        },
      ],
    });
  });
});
