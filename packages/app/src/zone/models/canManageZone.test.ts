import { describe, expect, test } from "bun:test";
import { canManageZone } from "./canManageZone";

describe("canManageZone", () => {
  test("allows staff and owner-realm manager roles", () => {
    expect(canManageZone({ permission: { role: "ADMIN" } })).toBe(true);
    expect(canManageZone({ permission: { role: "ROOT" } })).toBe(true);
    expect(canManageZone({ ownerRealmMemberRoleKey: "owner" })).toBe(true);
    expect(canManageZone({ ownerRealmMemberRoleKey: "admin" })).toBe(true);
    expect(canManageZone({ ownerRealmMemberRoleKey: "moderator" })).toBe(true);
  });

  test("denies regular owner-realm members and anonymous viewers", () => {
    expect(canManageZone({ ownerRealmMemberRoleKey: "member" })).toBe(false);
    expect(canManageZone({})).toBe(false);
  });
});
