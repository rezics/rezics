import { describe, expect, mock, test } from "bun:test";
import { ContentStructureAnchor, ContentStructureNode } from "../schema";
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
    const nodeRows = [
      {
        id: "node-1",
        parentId: null,
        position: "h",
        contentUnitId: "chapter-1",
        title: "Chapter 1",
      },
    ];
    const selectWhere = mock(async () => nodeRows);
    const selectFrom = mock(() => ({ where: selectWhere }));
    const select = mock(() => ({ from: selectFrom }));
    const deleteWhere = mock(async () => undefined);
    const deleteFrom = mock(() => ({ where: deleteWhere }));
    const insertValues = mock(async () => undefined);
    const insertInto = mock(() => ({ values: insertValues }));

    await rebuildFactoryContentStructureAnchors(
      {
        select,
        delete: deleteFrom,
        insert: insertInto,
      } as never,
      "book-1",
    );

    expect(select).toHaveBeenCalledWith({
      id: ContentStructureNode.id,
      parentId: ContentStructureNode.parentId,
      position: ContentStructureNode.position,
      contentUnitId: ContentStructureNode.contentUnitId,
      title: ContentStructureNode.title,
    });
    expect(selectFrom).toHaveBeenCalledWith(ContentStructureNode);
    expect(selectWhere).toHaveBeenCalledTimes(1);
    expect(deleteFrom).toHaveBeenCalledWith(ContentStructureAnchor);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertInto).toHaveBeenCalledWith(ContentStructureAnchor);
    expect(insertValues).toHaveBeenCalledWith([
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
    ]);
  });

  test("deletes anchors without inserting when no materialized nodes exist", async () => {
    const selectWhere = mock(async () => [
      {
        id: "node-1",
        parentId: null,
        position: "h",
        contentUnitId: null,
        title: "Chapter 1",
      },
    ]);
    const selectFrom = mock(() => ({ where: selectWhere }));
    const select = mock(() => ({ from: selectFrom }));
    const deleteWhere = mock(async () => undefined);
    const deleteFrom = mock(() => ({ where: deleteWhere }));
    const insertValues = mock(async () => undefined);
    const insertInto = mock(() => ({ values: insertValues }));

    await rebuildFactoryContentStructureAnchors(
      {
        select,
        delete: deleteFrom,
        insert: insertInto,
      } as never,
      "book-1",
    );

    expect(deleteFrom).toHaveBeenCalledWith(ContentStructureAnchor);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(insertInto).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });
});
