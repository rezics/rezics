import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { FeedbackRepository, FeedbackRow } from "./feedback.service";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("../job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const feedbackRow: FeedbackRow = {
  id: "feedback-1",
  userId: "user-1",
  targetKind: "UNIT",
  targetId: "unit-1",
  addressedUnitId: "unit-1",
  url: null,
  content: "Report body",
  type: "REPORT",
  resolved: false,
  resolvedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function freshRepository(): {
  calls: Array<{ method: string; input: unknown }>;
  repository: FeedbackRepository;
} {
  const calls: Array<{ method: string; input: unknown }> = [];
  return {
    calls,
    repository: {
      async create(input: unknown) {
        calls.push({ method: "create", input });
        return { ...feedbackRow, ...(input as Record<string, unknown>) };
      },
      async getById(id: string) {
        calls.push({ method: "getById", input: id });
        return feedbackRow;
      },
      async list(input: unknown) {
        calls.push({ method: "list", input });
        return { rows: [feedbackRow], total: 1 };
      },
      async setResolved(id: string, resolved: boolean) {
        calls.push({ method: "setResolved", input: { id, resolved } });
        return {
          ...feedbackRow,
          resolved,
          resolvedAt: resolved ? new Date("2026-01-02T00:00:00.000Z") : null,
        };
      },
    },
  };
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("FeedbackService search jobs", () => {
  test("create enqueues feedback sync", async () => {
    const { FeedbackService } = await import("./feedback.service");
    const { repository, calls } = freshRepository();
    const feedbackService = new FeedbackService(repository);

    await feedbackService.create({
      userId: "user-1",
      targetKind: "unit",
      targetId: "unit-1",
      content: "Report body",
    });

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "create",
        input: expect.objectContaining({
          userId: "user-1",
          targetKind: "UNIT",
          targetId: "unit-1",
          addressedUnitId: "unit-1",
          type: "REPORT",
          content: "Report body",
          url: null,
        }),
      }),
    );
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.feedback.sync",
        payload: { feedbackId: "feedback-1" },
        source: { type: "server", service: "feedback" },
      }),
    );
  });

  test("list filters by polymorphic target fields", async () => {
    const { FeedbackService } = await import("./feedback.service");
    const { repository, calls } = freshRepository();
    const feedbackService = new FeedbackService(repository);

    const query = {
      targetKind: "comment",
      targetId: "comment-1",
      addressedUnitId: "post-1",
      limit: 20,
    } as const;
    await feedbackService.list(query);

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: "list",
        input: expect.objectContaining({
          query,
          offset: 0,
          limit: 20,
        }),
      }),
    );
  });

  test("setResolved enqueues feedback resolution patch", async () => {
    const { FeedbackService } = await import("./feedback.service");
    const { repository, calls } = freshRepository();
    const feedbackService = new FeedbackService(repository);

    await feedbackService.setResolved("feedback-1", true);

    expect(calls).toContainEqual({
      method: "setResolved",
      input: { id: "feedback-1", resolved: true },
    });
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.feedback.patchResolution",
        payload: { feedbackId: "feedback-1" },
        source: { type: "server", service: "feedback" },
      }),
    );
  });
});
