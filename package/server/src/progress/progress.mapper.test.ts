import { describe, expect, test } from "bun:test";
import {
  mapProgressPostLinkToDTO,
  mapProgressToDTO,
  type ProgressStorageRow,
} from "./progress.mapper";

const baseRow = {
  id: "progress-1",
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: "BACKLOG",
  isDeleted: false,
  completedCount: 0,
  totalTimeMs: 0n,
  lastReadNodeId: null,
  lastReadAnchor: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies ProgressStorageRow;

describe("mapProgressToDTO", () => {
  test("maps core progress fields without extra payload", () => {
    expect(mapProgressToDTO({ ...baseRow })).toEqual({
      userId: "user-1",
      unitId: "unit-1",
      progress: 0,
      status: "BACKLOG",
      isDeleted: false,
      completedCount: 0,
      totalTimeMs: 0,
      lastReadNodeId: null,
      lastReadAnchor: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("propagates lastReadNodeId and sanitized lastReadAnchor", () => {
    const dto = mapProgressToDTO({
      ...baseRow,
      lastReadNodeId: "node-1",
      lastReadAnchor: {
        text: "Resume",
      },
    });
    expect(dto.lastReadNodeId).toBe("node-1");
    expect(dto.lastReadAnchor).toEqual({ text: "Resume" });
  });

  test("rejects malformed lastReadAnchor (empty / too long / no text)", () => {
    const empty = mapProgressToDTO({
      ...baseRow,
      lastReadAnchor: {
        text: "",
      },
    });
    expect(empty.lastReadAnchor).toBeNull();
    const tooLong = mapProgressToDTO({
      ...baseRow,
      lastReadAnchor: {
        text: "x".repeat(201),
      },
    });
    expect(tooLong.lastReadAnchor).toBeNull();
    const wrongShape = mapProgressToDTO({
      ...baseRow,
      lastReadAnchor: {
        foo: "bar",
      },
    });
    expect(wrongShape.lastReadAnchor).toBeNull();
  });
});

describe("mapProgressPostLinkToDTO", () => {
  test("maps link rows with the progress status snapshot", () => {
    expect(
      mapProgressPostLinkToDTO({
        progressId: "progress-1",
        postUnitId: "post-1",
        status: "PAUSED",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
    ).toEqual({
      progressId: "progress-1",
      postUnitId: "post-1",
      status: "PAUSED",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
  });
});
