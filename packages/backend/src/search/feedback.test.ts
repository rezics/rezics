import { describe, expect, test } from "bun:test";
import {
  buildFeedbackSearchDocument,
  patchFeedbackResolutionFromDb,
  setSearchDb,
  syncFeedbackSegment,
  syncSingleFeedback,
} from "./sync";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

const feedbackRow = {
  id: "feedback-1",
  userId: "user-1",
  targetKind: "COMMENT",
  targetId: "comment-1",
  addressedUnitId: "post-1",
  url: null,
  content: "Report body",
  type: "REPORT",
  resolved: false,
  resolvedAt: null,
  createdAt: new Date("2026-06-03T00:00:00.000Z"),
  updatedAt: new Date("2026-06-03T00:00:00.000Z"),
};

describe("feedback search sync", () => {
  test("buildFeedbackSearchDocument projects polymorphic targets", () => {
    const doc = buildFeedbackSearchDocument(feedbackRow);

    expect(doc).toEqual({
      id: "feedback-1",
      userId: "user-1",
      targetKind: "comment",
      targetId: "comment-1",
      addressedUnitId: "post-1",
      url: null,
      content: "Report body",
      type: "REPORT",
      resolved: false,
      resolvedAt: null,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
    });
    expect("unitId" in doc).toBe(false);
  });

  test("syncSingleFeedback reads from Drizzle db", async () => {
    const documents: unknown[] = [];
    setSearchDb(createDb([[feedbackRow]]) as never);

    await syncSingleFeedback(
      {
        addOrUpdateFeedbacks: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      "feedback-1",
    );

    expect(documents).toEqual([buildFeedbackSearchDocument(feedbackRow)]);
  });

  test("syncSingleFeedback deletes stale documents when db row is missing", async () => {
    const deleted: string[] = [];
    setSearchDb(createDb([[]]) as never);

    await syncSingleFeedback(
      {
        deleteFeedbacks: async (ids: string[]) => {
          deleted.push(...ids);
        },
      } as never,
      "feedback-missing",
    );

    expect(deleted).toEqual(["feedback-missing"]);
  });

  test("syncFeedbackSegment returns cursor from Drizzle rows", async () => {
    const documents: unknown[] = [];
    setSearchDb(
      createDb([
        [
          feedbackRow,
          {
            ...feedbackRow,
            id: "feedback-2",
            content: "Another report",
          },
        ],
      ]) as never,
    );

    const result = await syncFeedbackSegment(
      {
        addOrUpdateFeedbacks: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      { limit: 1 },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "feedback-1" });
    expect(documents).toEqual([buildFeedbackSearchDocument(feedbackRow)]);
  });

  test("patchFeedbackResolutionFromDb reads the current Drizzle row", async () => {
    const patched: unknown[] = [];
    setSearchDb(
      createDb([
        [
          {
            ...feedbackRow,
            resolved: true,
            resolvedAt: new Date("2026-06-04T00:00:00.000Z"),
          },
        ],
      ]) as never,
    );

    await patchFeedbackResolutionFromDb(
      {
        patchFeedbacks: async (input: unknown[]) => {
          patched.push(...input);
        },
      } as never,
      "feedback-1",
    );

    expect(patched).toEqual([
      {
        id: "feedback-1",
        resolved: true,
        resolvedAt: "2026-06-04T00:00:00.000Z",
      },
    ]);
  });
});
