import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  SYSTEM_SHELF_KIND_KEYS,
  unitProgressListResponseSchema,
  unitProgressRowDTOSchema,
  unitProgressUpsertBodySchema,
  userExtraSchema,
  userUnitProgressStatusValues,
} from "./progress";

describe("progress contract schemas", () => {
  test("exposes status values and system shelf kind keys", () => {
    expect(userUnitProgressStatusValues).toEqual([
      "BACKLOG",
      "ACTIVE",
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
        lastPosition: "chapter-1#0.5",
        addTimeMs: 1000,
        extra: { device: "web" },
      }),
    ).toBe(true);
    expect(
      Value.Check(unitProgressUpsertBodySchema, { progress: 1.1 }),
    ).toBe(false);
    expect(
      Value.Check(unitProgressUpsertBodySchema, { addTimeMs: -1 }),
    ).toBe(false);
  });

  test("validates progress row and list response round trip shape", () => {
    const row = {
      userId: "user-1",
      unitId: "unit-1",
      progress: 1,
      status: "COMPLETED",
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

  test("validates user extra shelves map", () => {
    expect(
      Value.Check(userExtraSchema, {
        shelves: {
          favorites: "fav-id",
          backlog: "backlog-id",
          active: "active-id",
          completed: "completed-id",
          future: "future-id",
        },
      }),
    ).toBe(true);
    expect(
      Value.Check(userExtraSchema, {
        shelves: { favorites: 123 },
      }),
    ).toBe(false);
  });
});
