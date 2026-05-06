import { describe, expect, test } from "bun:test";
import type { Permission, UnitDTO } from "@rezics/contract";
import { computeCanEdit } from "./useCanEdit";

const ownedUnit: UnitDTO = {
  id: "unit-1",
  type: "book",
  userId: "user-owner",
  user: {
    unitId: "owner-user-id",
    slug: "owner",
    name: "Owner",
  } as UnitDTO["user"],
};

const permission = (role: Permission["role"]): Permission => ({ role });

describe("computeCanEdit", () => {
  test("null permission → false", () => {
    expect(computeCanEdit(null, "owner-user-id", "book", ownedUnit)).toBe(
      false,
    );
  });

  test("null actorUserId → false", () => {
    expect(computeCanEdit(permission("USER"), null, "book", ownedUnit)).toBe(
      false,
    );
  });

  test("BLOCKED role → false even for own content", () => {
    expect(
      computeCanEdit(permission("BLOCKED"), "owner-user-id", "book", ownedUnit),
    ).toBe(false);
  });

  test("ADMIN role → true regardless of owner", () => {
    expect(
      computeCanEdit(permission("ADMIN"), "other-user", "book", ownedUnit),
    ).toBe(true);
  });

  test("ROOT role → true regardless of owner", () => {
    expect(
      computeCanEdit(permission("ROOT"), "other-user", "shelf", ownedUnit),
    ).toBe(true);
  });

  test("USER owning the content by actor userId → true", () => {
    expect(
      computeCanEdit(permission("USER"), "owner-user-id", "chapter", ownedUnit),
    ).toBe(true);
  });

  test("USER not owning the content → false", () => {
    expect(
      computeCanEdit(permission("USER"), "someone-else", "post", ownedUnit),
    ).toBe(false);
  });

  test("missing ownerUnit → false (for strict resources)", () => {
    expect(
      computeCanEdit(permission("USER"), "owner-user-id", "book", undefined),
    ).toBe(false);
  });

  test("missing ownerUnit.user → false", () => {
    const unitNoUser: UnitDTO = { id: "x", type: "book" };
    expect(
      computeCanEdit(permission("USER"), "owner-user-id", "shelf", unitNoUser),
    ).toBe(false);
  });

  test("unit resource: owner match → true", () => {
    expect(
      computeCanEdit(permission("USER"), "owner-user-id", "unit", ownedUnit),
    ).toBe(true);
  });
});
