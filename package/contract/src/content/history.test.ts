import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  contentStructureBatchEventPayloadSchema,
  contentStructureBatchPayloadSchema,
  editorialPatchSchema,
  editorialPatchSubmissionSchema,
  editorialRevisionPayloadSchema,
  historyActorResolutionSchema,
  historyDisplayResolutionStatusSchema,
  historyRestoreSourceSchema,
  historyUnitReferenceResolutionSchema,
  unitRevisionSchema,
  unitRevisionTimelineItemSchema,
} from "./history";

describe("content history contracts", () => {
  test("accepts typed ContentStructure batch operations", () => {
    const payload = {
      operations: [
        {
          op: "node.create",
          node: { nodeId: "node-1", title: "Chapter 1" },
          placement: { parentId: null, sortKey: "a0" },
        },
        {
          op: "node.update",
          nodeId: "node-1",
          before: { title: "Chapter 1" },
          after: { title: "Chapter One" },
        },
        {
          op: "node.move",
          nodeId: "node-1",
          before: { parentId: null, sortKey: "a0" },
          after: { parentId: "node-parent", sortKey: "b0" },
        },
        {
          op: "node.delete",
          node: {
            nodeId: "node-2",
            title: "Deleted",
            contentUnitId: "chapter-2",
            noContent: false,
            rating: null,
          },
          placement: { parentId: null, sortKey: "c0" },
          descendantCount: 2,
        },
        {
          op: "node.link",
          nodeId: "node-3",
          beforeContentUnitId: null,
          afterContentUnitId: "chapter-3",
        },
        {
          op: "node.unlink",
          nodeId: "node-3",
          beforeContentUnitId: "chapter-3",
        },
        {
          op: "bulk.replace",
          beforeNodeCount: 1,
          afterNodeCount: 3,
          reason: "import",
        },
      ],
    };

    expect(Value.Check(contentStructureBatchPayloadSchema, payload)).toBe(true);
    expect(
      Value.Check(contentStructureBatchEventPayloadSchema, {
        unitId: "book-1",
        sequence: 7,
        actorUserId: "user-1",
        eventType: "contentStructure.content.batch",
        changedFieldKeys: ["contentStructure"],
        payload,
        message: "Restructure",
      }),
    ).toBe(true);
  });

  test("rejects unknown structure batch operations", () => {
    expect(
      Value.Check(contentStructureBatchPayloadSchema, {
        operations: [{ op: "node.rename", nodeId: "node-1" }],
      }),
    ).toBe(false);
  });

  test("timeline revision metadata does not require raw content", () => {
    const timelineItem = {
      id: "revision-1",
      unitId: "unit-1",
      sequence: 1,
      contentHash: "hash-1",
      actorUserId: "user-1",
      changedFieldKeys: ["identity.title"],
      message: null,
      createdAt: "2026-05-20T00:00:00.000Z",
      ingestedAt: "2026-05-20T00:00:01.000Z",
    };

    expect(Value.Check(unitRevisionTimelineItemSchema, timelineItem)).toBe(
      true,
    );
    expect(Value.Check(unitRevisionSchema, timelineItem)).toBe(true);
  });

  test("editorial patch submissions carry sparse patch trees", () => {
    expect(
      Value.Check(editorialPatchSchema, {
        translations: { en: { description: "new" } },
        credits: { authors: [{ targetUnitId: "unit-2" }] },
        $unset: ["extension.publicationDate"],
      }),
    ).toBe(true);

    expect(
      Value.Check(editorialPatchSubmissionSchema, {
        patch: {
          translations: { en: { summary: null } },
        },
        message: "Clear summary",
      }),
    ).toBe(true);
  });

  test("restore source metadata records source revision sequence", () => {
    const restoreSource = {
      kind: "revision",
      unitId: "unit-1",
      sequence: 12,
      paths: ["translations.en.title"],
    };

    expect(Value.Check(historyRestoreSourceSchema, restoreSource)).toBe(true);
    expect(
      Value.Check(editorialRevisionPayloadSchema, {
        unitId: "unit-1",
        sequence: 13,
        actorUserId: "admin-1",
        patch: { translations: { en: { title: "Restored" } } },
        message: "Restored from #12",
        restoreSource,
      }),
    ).toBe(true);
  });

  test("history display resolution statuses cover actor and Unit fallbacks", () => {
    for (const status of ["OK", "DELETED", "GONE", "RESTRICTED"]) {
      expect(Value.Check(historyDisplayResolutionStatusSchema, status)).toBe(
        true,
      );
    }

    expect(
      Value.Check(historyActorResolutionSchema, {
        actorUserId: "user-1",
        status: "DELETED",
      }),
    ).toBe(true);
    expect(
      Value.Check(historyUnitReferenceResolutionSchema, {
        unitId: "unit-1",
        status: "RESTRICTED",
      }),
    ).toBe(true);
  });
});
