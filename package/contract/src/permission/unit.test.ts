/**
 * Behavior tests for hasPermissionToUpdateUnit / hasPermissionToDeleteUnit.
 * These pass a UnitWithRelations-shaped object (matching the server internal
 * type) directly — no `as any` — confirming the structural widening works and
 * all ownership semantics are preserved.
 *
 * hasPermissionToUpdateUnit / hasPermissionToDeleteUnit 的行为测试。
 * 直接传入 UnitWithRelations 形状的对象（无 `as any`），验证结构扩展生效且
 * 所有所有权语义不变。
 */

import { describe, expect, test } from "bun:test";
import { hasPermissionToDeleteUnit, hasPermissionToUpdateUnit } from "./unit";

// Minimal UnitWithRelations-shaped input — only the fields the functions read.
// 最小 UnitWithRelations 形状输入——只包含函数实际读取的字段。
const makeUnit = (ownerUnitId: string) => ({
  id: "unit-123",
  type: "BOOK",
  user: { unitId: ownerUnitId, name: "Alice", avatar: null },
  translations: [],
  supportLanguages: [],
});

const MEMBER = { role: "MEMBER" as const };
const BLOCKED = { role: "BLOCKED" as const };
const ADMIN = { role: "ADMIN" as const };

describe("hasPermissionToUpdateUnit", () => {
  test("owner (MEMBER) can update own unit", () => {
    const unit = makeUnit("user-1");
    expect(hasPermissionToUpdateUnit(MEMBER, "user-1", unit)).toBe(true);
  });

  test("non-owner (MEMBER) cannot update another user's unit", () => {
    const unit = makeUnit("user-1");
    expect(hasPermissionToUpdateUnit(MEMBER, "user-2", unit)).toBe(false);
  });

  test("admin can update any unit regardless of ownership", () => {
    const unit = makeUnit("user-1");
    expect(hasPermissionToUpdateUnit(ADMIN, "user-99", unit)).toBe(true);
  });

  test("blocked actor cannot update even own unit", () => {
    const unit = makeUnit("user-1");
    expect(hasPermissionToUpdateUnit(BLOCKED, "user-1", unit)).toBe(false);
  });

  test("null unit: non-admin is denied", () => {
    expect(hasPermissionToUpdateUnit(MEMBER, "user-1", null)).toBe(false);
  });

  test("null unit: admin is still granted", () => {
    expect(hasPermissionToUpdateUnit(ADMIN, "user-1", null)).toBe(true);
  });

  test("undefined unit: non-admin is denied", () => {
    expect(hasPermissionToUpdateUnit(MEMBER, "user-1", undefined)).toBe(false);
  });

  test("unit with null user: non-admin is denied", () => {
    const unit = { ...makeUnit("x"), user: null };
    expect(hasPermissionToUpdateUnit(MEMBER, "user-1", unit)).toBe(false);
  });
});

describe("hasPermissionToDeleteUnit", () => {
  test("delegates to hasPermissionToUpdateUnit — owner allowed", () => {
    const unit = makeUnit("user-1");
    expect(hasPermissionToDeleteUnit(MEMBER, "user-1", unit)).toBe(true);
  });

  test("delegates to hasPermissionToUpdateUnit — non-owner denied", () => {
    const unit = makeUnit("user-1");
    expect(hasPermissionToDeleteUnit(MEMBER, "user-2", unit)).toBe(false);
  });
});
