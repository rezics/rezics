import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  chapterLastPositionSchema,
  contentStructurePathLastPositionSchema,
  progressExtraSchema,
  SYSTEM_SHELF_KIND_KEYS,
  unitLastPositionSchema,
  unitProgressListResponseSchema,
  unitProgressRowDTOSchema,
  unitProgressUpsertBodySchema,
  userUnitProgressStatusValues,
} from "./progress";

describe("progress contract schemas", () => {
  test("exposes status values and system shelf kind keys", () => {
    expect(userUnitProgressStatusValues).toEqual([
      "BACKLOG",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "DROPPED",
    ]);
    expect(SYSTEM_SHELF_KIND_KEYS).toEqual([
      "favorites",
      "backlog",
      "active",
      "completed",
    ]);
  });

  test("validates upsert input bounds", () => {
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        progress: 0.5,
        status: "ACTIVE",
        completedCount: 2,
        lastPosition: {
          kind: "contentStructurePath",
          bookUnitId: "book-1",
          path: [2, 4, 0],
          contentUnitId: "chapter-1",
          chapterUnitId: "chapter-1",
        },
        addTimeMs: 1000,
        extra: { paused: { reasonPostUnitIds: ["post-1"] } },
      }),
    ).toBe(true);
    expect(Value.Check(unitProgressUpsertBodySchema, { progress: 1.1 })).toBe(
      false,
    );
    expect(Value.Check(unitProgressUpsertBodySchema, { addTimeMs: -1 })).toBe(
      false,
    );
    expect(
      Value.Check(unitProgressUpsertBodySchema, { completedCount: -1 }),
    ).toBe(false);
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        lastPosition: "chapter-1#0.5",
      }),
    ).toBe(false);
  });

  test("validates typed last-position variants", () => {
    expect(
      Value.Check(contentStructurePathLastPositionSchema, {
        kind: "contentStructurePath",
        bookUnitId: "book-1",
        path: [0, 2],
        contentUnitId: "content-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(chapterLastPositionSchema, {
        kind: "chapter",
        chapterUnitId: "chapter-1",
        offset: 0.42,
      }),
    ).toBe(true);
    expect(
      Value.Check(unitLastPositionSchema, {
        kind: "contentStructurePath",
        bookUnitId: "book-1",
        path: [-1],
      }),
    ).toBe(false);
    expect(
      Value.Check(unitLastPositionSchema, {
        kind: "chapter",
        chapterUnitId: "chapter-1",
        offset: -0.1,
      }),
    ).toBe(false);
  });

  test("validates progress row and list response round trip shape", () => {
    const row = {
      userId: "user-1",
      unitId: "unit-1",
      progress: 1,
      status: "COMPLETED",
      isDeleted: false,
      completedCount: 1,
      totalTimeMs: 123,
      lastPosition: null,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-02T00:00:00.000Z",
      extra: null,
    };

    expect(Value.Check(unitProgressRowDTOSchema, row)).toBe(true);
    expect(
      Value.Check(unitProgressListResponseSchema, {
        rows: [row],
        nextCursor: null,
      }),
    ).toBe(true);
  });

  test("progressExtraSchema accepts narrow shapes and rejects unknown keys", () => {
    expect(Value.Check(progressExtraSchema, {})).toBe(true);
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1", "p-2"] },
      }),
    ).toBe(true);
    expect(
      Value.Check(progressExtraSchema, {
        dropped: { reasonPostUnitIds: [] },
      }),
    ).toBe(true);
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1"] },
        dropped: { reasonPostUnitIds: ["p-2"] },
      }),
    ).toBe(true);

    // Unknown top-level keys rejected
    expect(
      Value.Check(progressExtraSchema, {
        device: "web",
      }),
    ).toBe(false);
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1"] },
        unknownBucket: { foo: 1 },
      }),
    ).toBe(false);
    // Unknown sub-keys rejected
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: ["p-1"], extra: 1 },
      }),
    ).toBe(false);
    // Wrong types rejected
    expect(
      Value.Check(progressExtraSchema, {
        paused: { reasonPostUnitIds: [123] },
      }),
    ).toBe(false);
  });

  test("upsert body accepts null extra and empty extra", () => {
    expect(Value.Check(unitProgressUpsertBodySchema, { extra: null })).toBe(
      true,
    );
    expect(Value.Check(unitProgressUpsertBodySchema, { extra: {} })).toBe(true);
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        extra: { paused: { reasonPostUnitIds: [] } },
      }),
    ).toBe(true);
    expect(
      Value.Check(unitProgressUpsertBodySchema, {
        extra: { device: "web" },
      }),
    ).toBe(false);
  });
});
