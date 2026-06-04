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
        position: "h",
        contentUnitId: null,
        title: "Root",
      },
      {
        id: "node-b",
        parentId: "node-root",
        position: "q",
        contentUnitId: "chapter-b",
        title: "Chapter B",
      },
      {
        id: "node-a",
        parentId: "node-root",
        position: "c",
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
        position: "c",
        positionPath: "h.c",
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
        position: "q",
        positionPath: "h.q",
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
        position: "h",
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
        position: true,
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
          position: "h",
          positionPath: "h",
          titlePath: ["Chapter 1"],
        },
      ],
    });
  });
});
