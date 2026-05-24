import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const feedbackRow = {
  id: "feedback-1",
  userId: "user-1",
  unitId: "unit-1",
  url: null,
  content: "Report body",
  type: "REPORT",
  resolved: false,
  resolvedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  enqueueMock.mockClear();
  Object.assign(prismaMock, {
    feedback: {
      create: mock(async () => feedbackRow),
      update: mock(async () => ({
        ...feedbackRow,
        resolved: true,
        resolvedAt: new Date("2026-01-02T00:00:00.000Z"),
      })),
      findUniqueOrThrow: mock(async () => feedbackRow),
      findMany: mock(async () => [feedbackRow]),
      count: mock(async () => 1),
    },
  });
});

describe("FeedbackService search jobs", () => {
  test("create enqueues feedback sync", async () => {
    const { feedbackService } = await import("./feedback.service");

    await feedbackService.create({
      userId: "user-1",
      unitId: "unit-1",
      content: "Report body",
    });

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.feedback.sync",
        payload: { feedbackId: "feedback-1" },
        source: { type: "server", service: "feedback" },
      }),
    );
  });

  test("setResolved enqueues feedback resolution patch", async () => {
    const { feedbackService } = await import("./feedback.service");

    await feedbackService.setResolved("feedback-1", true);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.feedback.patchResolution",
        payload: { feedbackId: "feedback-1" },
        source: { type: "server", service: "feedback" },
      }),
    );
  });
});
