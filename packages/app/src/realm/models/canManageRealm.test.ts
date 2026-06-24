import { describe, expect, test } from "bun:test";
import { canManageRealm } from "./canManageRealm";

describe("canManageRealm", () => {
  test("allows staff and moderator roles", () => {
    expect(canManageRealm({ permission: { role: "ADMIN" } })).toBe(true);
    expect(canManageRealm({ permission: { role: "ROOT" } })).toBe(true);
    expect(canManageRealm({ memberRoleKey: "owner" })).toBe(true);
    expect(canManageRealm({ memberRoleKey: "admin" })).toBe(true);
    expect(canManageRealm({ memberRoleKey: "moderator" })).toBe(true);
  });

  test("denies regular members and anonymous viewers", () => {
    expect(canManageRealm({ memberRoleKey: "member" })).toBe(false);
    expect(canManageRealm({})).toBe(false);
  });
});
