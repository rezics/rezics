import { describe, expect, test } from "bun:test";
import type { Permission, UnitDTO } from "@rezics/contract";
import { computeEditorEntryDecision } from "./useEditorEntry";

const ownedUnit: UnitDTO = {
  id: "unit-1",
  type: "post",
  userId: "user-owner",
  user: {
    unitId: "owner-user-id",
    slug: "owner",
    name: "Owner",
  } as UnitDTO["user"],
};

const permission = (role: Permission["role"]): Permission => ({ role });

describe("computeEditorEntryDecision", () => {
  test("anonymous viewer cannot enter a collaborative editor", () => {
    expect(
      computeEditorEntryDecision({
        permission: null,
        actorUserId: null,
        surface: "book",
        capabilities: ["tag"],
      }),
    ).toEqual({ canEnter: false, reason: "anonymous" });
  });

  test("blocked viewer cannot enter even when they own content", () => {
    expect(
      computeEditorEntryDecision({
        permission: permission("BLOCKED"),
        actorUserId: "owner-user-id",
        surface: "review",
        ownerUnit: ownedUnit,
      }),
    ).toEqual({ canEnter: false, reason: "blocked" });
  });

  test("owner can enter ordinary author-owned post surfaces", () => {
    expect(
      computeEditorEntryDecision({
        permission: permission("USER"),
        actorUserId: "owner-user-id",
        surface: "remark",
        ownerUnit: ownedUnit,
      }),
    ).toEqual({ canEnter: true, reason: "owner" });
  });

  test("admin can enter ordinary author-owned surfaces without owner hydration", () => {
    expect(
      computeEditorEntryDecision({
        permission: permission("ADMIN"),
        actorUserId: "admin-user-id",
        surface: "shelf",
        ownerUnit: undefined,
      }),
    ).toEqual({ canEnter: true, reason: "admin" });
  });

  test("ordinary non-owner cannot enter ordinary author-owned surfaces", () => {
    expect(
      computeEditorEntryDecision({
        permission: permission("USER"),
        actorUserId: "other-user-id",
        surface: "review",
        ownerUnit: ownedUnit,
      }),
    ).toEqual({ canEnter: false, reason: "no-capability" });
  });

  test("authenticated non-blocked viewer can enter collaborative editor with tag capability", () => {
    expect(
      computeEditorEntryDecision({
        permission: permission("USER"),
        actorUserId: "other-user-id",
        surface: "book",
        ownerUnit: ownedUnit,
        capabilities: ["tag"],
      }),
    ).toEqual({ canEnter: true, reason: "taggable" });
  });

  test("collaborative editor stays hidden when no capability is available", () => {
    expect(
      computeEditorEntryDecision({
        permission: permission("USER"),
        actorUserId: "other-user-id",
        surface: "wikiPost",
        ownerUnit: ownedUnit,
        capabilities: [],
      }),
    ).toEqual({ canEnter: false, reason: "no-capability" });
  });
});
