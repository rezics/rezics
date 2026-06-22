/**
 * Convention: runtime arrays that mirror contract enums must import from
 * @rezics/contract, not hand-copy the members.
 * 约定：镜像契约 enum 的运行时数组必须从 @rezics/contract 导入，不得手抄成员。
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

function read(rel: string) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf-8");
}

describe("union hand-copy convention", () => {
  test("READ_STATUS_VALUES imports userUnitProgressStatusValues from contract", () => {
    const src = read("package/app/src/progress-status/models/status.ts");
    expect(src).toContain("userUnitProgressStatusValues");
    expect(src).not.toMatch(/READ_STATUS_VALUES\s*=\s*\[\s*"BACKLOG"/);
  });

  test("RELEASE_UNIT_TYPES replaced by CATALOG_UNIT_TYPES from contract", () => {
    const src = read("package/server/src/series-unit/series.service.ts");
    expect(src).toContain("CATALOG_UNIT_TYPES");
    expect(src).not.toMatch(/RELEASE_UNIT_TYPES\s*=\s*\[/);
  });

  test("EDITION_CATALOG_TYPES derives from CATALOG_UNIT_TYPES", () => {
    const src = read("package/server/src/meili/content/content.service.ts");
    expect(src).toContain("CATALOG_UNIT_TYPES");
    expect(src).not.toMatch(/new Set\(\["BOOK",\s*"GAME",\s*"MEDIA"\]\)/);
  });

  test("ROLE_OPTIONS uses realmMemberRoles from contract", () => {
    const src = read("package/app/src/realm/components/RealmMemberList.tsx");
    expect(src).toContain("realmMemberRoles");
    expect(src).not.toMatch(/ROLE_OPTIONS\s*=\s*\["owner"/);
  });

  test("MANAGE_ROLES is typed as RealmMemberRole[]", () => {
    const src = read("package/app/src/realm/models/canManageRealm.ts");
    expect(src).toContain("RealmMemberRole");
  });

  test("ZONE_OWNER_REALM_MANAGE_ROLES is typed as RealmMemberRole[]", () => {
    const src = read("package/app/src/zone/models/canManageZone.ts");
    expect(src).toContain("RealmMemberRole");
  });

  test("ACTIVITY_POST_KINDS satisfies PostKind[]", () => {
    const src = read("package/server/src/activity/activity.service.ts");
    expect(src).toMatch(/ACTIVITY_POST_KINDS.*satisfies.*PostKind/);
  });

  test("DRAFT_POST_KINDS satisfies PostKind[]", () => {
    const src = read("package/server/src/draft/draft.service.ts");
    expect(src).toMatch(/DRAFT_POST_KINDS.*satisfies.*PostKind/);
  });

  test("BOOK_CONTENT_TYPES derives from CATALOG_UNIT_TYPES", () => {
    const src = read("package/server/src/meili/search/filters.ts");
    expect(src).toContain("CATALOG_UNIT_TYPES");
    expect(src).not.toMatch(/BOOK_CONTENT_TYPES\s*=\s*\["BOOK",\s*"GAME"/);
  });
});
