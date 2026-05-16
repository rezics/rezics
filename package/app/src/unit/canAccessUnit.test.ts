import { describe, expect, test } from "bun:test";
import type { UnitDTO } from "@rezics/contract";
import { canAccessUnit } from "./canAccessUnit";

function unit(overrides: Partial<UnitDTO> = {}): UnitDTO {
  return {
    id: "u1",
    type: "BOOK",
    ...overrides,
  } as UnitDTO;
}

const owner = { unitId: "owner-user" };
const other = { unitId: "other-user" };

describe("canAccessUnit", () => {
  test("DELETED always denied", () => {
    const u = unit({
      status: "DELETED",
      user: { unitId: owner.unitId } as never,
    });
    expect(canAccessUnit(u, owner)).toBe(false);
    expect(canAccessUnit(u, other)).toBe(false);
  });

  test("DRAFT owner-only", () => {
    const u = unit({
      status: "DRAFT",
      user: { unitId: owner.unitId } as never,
    });
    expect(canAccessUnit(u, owner)).toBe(true);
    expect(canAccessUnit(u, other)).toBe(false);
    expect(canAccessUnit(u, null)).toBe(false);
  });

  test("PRIVATE visibility owner-only", () => {
    const u = unit({
      status: "PUBLISHED",
      visibility: "PRIVATE",
      user: { unitId: owner.unitId } as never,
    });
    expect(canAccessUnit(u, owner)).toBe(true);
    expect(canAccessUnit(u, other)).toBe(false);
  });

  test("UNLISTED visibility owner-only", () => {
    const u = unit({
      status: "PUBLISHED",
      visibility: "UNLISTED",
      user: { unitId: owner.unitId } as never,
    });
    expect(canAccessUnit(u, owner)).toBe(true);
    expect(canAccessUnit(u, other)).toBe(false);
  });

  test("PUBLISHED + PUBLIC open to all", () => {
    const u = unit({
      status: "PUBLISHED",
      visibility: "PUBLIC",
      user: { unitId: owner.unitId } as never,
    });
    expect(canAccessUnit(u, owner)).toBe(true);
    expect(canAccessUnit(u, other)).toBe(true);
    expect(canAccessUnit(u, null)).toBe(true);
  });
});
