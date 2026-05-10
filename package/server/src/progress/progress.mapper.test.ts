import { describe, expect, test } from "bun:test";
import type { UserUnitProgress } from "#/prisma/client";
import { UserUnitProgressStatus } from "#/prisma/client";
import { mapProgressToDTO } from "./progress.mapper";

const baseRow = {
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: UserUnitProgressStatus.BACKLOG,
  completedCount: 0,
  totalTimeMs: 0n,
  lastPosition: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  extra: null,
} satisfies UserUnitProgress;

describe("mapProgressToDTO", () => {
  test("returns null extra when stored extra is null", () => {
    expect(mapProgressToDTO({ ...baseRow }).extra).toBeNull();
  });

  test("strips unknown top-level keys from legacy extra", () => {
    const row: UserUnitProgress = {
      ...baseRow,
      extra: {
        legacy: 1,
        device: "web",
        paused: { reasonPostUnitIds: ["post-1", "post-2"] },
      } as unknown as UserUnitProgress["extra"],
    };

    const dto = mapProgressToDTO(row);

    expect(dto.extra).toEqual({
      paused: { reasonPostUnitIds: ["post-1", "post-2"] },
    });
  });

  test("returns empty object when stored extra is unrecognized", () => {
    const row: UserUnitProgress = {
      ...baseRow,
      extra: { totallyUnknown: { foo: 1 } } as unknown as UserUnitProgress["extra"],
    };

    expect(mapProgressToDTO(row).extra).toEqual({});
  });

  test("preserves dropped reason posts", () => {
    const row: UserUnitProgress = {
      ...baseRow,
      extra: {
        dropped: { reasonPostUnitIds: ["post-x"] },
      } as unknown as UserUnitProgress["extra"],
    };

    expect(mapProgressToDTO(row).extra).toEqual({
      dropped: { reasonPostUnitIds: ["post-x"] },
    });
  });
});
