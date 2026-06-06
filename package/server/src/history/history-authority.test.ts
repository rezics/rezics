import { describe, expect, test } from "bun:test";
import {
  canCompareHistory,
  canRestoreHistoryRevision,
  canViewHistoryMetadata,
  canViewRawHistoryPayload,
} from "./history-authority";

const publicUnit = {
  id: "unit-1",
  userId: "owner-1",
  visibility: "PUBLIC",
  status: "PUBLISHED",
};

const privateUnit = {
  ...publicUnit,
  visibility: "PRIVATE",
};

const owner = {
  userId: "owner-1",
  permission: { role: "USER" },
} as never;

const admin = {
  userId: "admin-1",
  permission: { role: "ADMIN" },
} as never;

describe("history authority helpers", () => {
  test("public viewers can see public timeline metadata but not raw payloads", () => {
    expect(canViewHistoryMetadata(null, publicUnit)).toBe(true);
    expect(canCompareHistory(null, publicUnit)).toBe(true);
    expect(canViewRawHistoryPayload(null, publicUnit)).toBe(false);
    expect(canRestoreHistoryRevision(null, publicUnit)).toBe(false);
  });

  test("owners can inspect raw payloads and restore visible history", () => {
    expect(canViewHistoryMetadata(owner, privateUnit)).toBe(true);
    expect(canViewRawHistoryPayload(owner, privateUnit)).toBe(true);
    expect(canRestoreHistoryRevision(owner, privateUnit)).toBe(true);
  });

  test("admins can access private history and deleted Units stay hidden", () => {
    expect(canViewHistoryMetadata(admin, privateUnit)).toBe(true);
    expect(canViewRawHistoryPayload(admin, privateUnit)).toBe(true);
    expect(
      canViewHistoryMetadata(admin, { ...publicUnit, status: "DELETED" }),
    ).toBe(false);
  });
});
