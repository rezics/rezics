import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

mock.module("@/unit/publication-policy", () => ({
  resolveStoredLicenseSlug: mock((slug: string | null) => slug),
}));

mock.module("@/utils/sanitizeUser", () => ({
  mapPublicUser: mock((user: unknown) => user),
}));

const { mapPostToDTO } = await import("./post.mapper");

describe("mapPostToDTO", () => {
  test("serializes a known author USER slug", () => {
    const dto = mapPostToDTO({
      unitId: "post-1",
      authorUserId: "user-1",
      targetUnitId: "book-1",
      content: markdownContentDoc("A thoughtful review"),
      rootPostUnitId: "post-1",
      parentPostUnitId: null,
      kind: "REVIEW",
      scoreEntryId: null,
      depth: 0,
      path: null,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      extra: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      unit: {
        inRealms: [{ realmUnitId: "realm-1" }],
        user: {
          unitId: "user-1",
          slug: "alice",
          name: "Alice",
          avatar: null,
        },
      },
    } as any);

    expect(dto.author).toMatchObject({
      unitId: "user-1",
      slug: "alice",
      name: "Alice",
      avatar: null,
    });
    expect(dto.realmUnitId).toBe("realm-1");
  });

  test("maps ContentDoc author descriptions for post list responses", () => {
    const dto = mapPostToDTO({
      unitId: "post-1",
      authorUserId: "user-1",
      targetUnitId: null,
      content: markdownContentDoc("A short post"),
      rootPostUnitId: "post-1",
      parentPostUnitId: null,
      kind: "POST",
      scoreEntryId: null,
      depth: 0,
      path: null,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      extra: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      unit: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        licenseSlug: null,
        user: {
          unitId: "user-1",
          slug: "alice",
          name: "Alice",
          avatar: null,
          description: markdownContentDoc("Generated profile"),
        },
      },
    } as any);

    expect(dto.author?.description).toEqual(
      markdownContentDoc("Generated profile"),
    );
    expect(typeof dto.author?.description).toBe("object");
    expect(dto.author?.description).not.toBe("Generated profile");
  });

  test("nulls globally hidden content while preserving the node", () => {
    const dto = mapPostToDTO({
      unitId: "reply-1",
      authorUserId: "user-1",
      targetUnitId: null,
      content: markdownContentDoc("Hidden reply"),
      rootPostUnitId: "post-1",
      parentPostUnitId: "post-1",
      kind: "POST",
      scoreEntryId: null,
      depth: 1,
      path: "0001",
      replyCount: 1,
      directReplyCount: 1,
      lastReplyAt: null,
      isLocked: false,
      extra: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      unit: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        licenseSlug: null,
        contentModerationState: {
          state: "TOMBSTONED",
        },
        user: {
          unitId: "user-1",
          slug: "alice",
          name: "Alice",
          avatar: null,
        },
      },
    } as any);

    expect(dto.content).toBeNull();
    expect(dto.globalModerationState).toBe("tombstoned");
    expect(dto.isTombstone).toBe(true);
    expect(dto.replyCount).toBe(1);
  });
});
