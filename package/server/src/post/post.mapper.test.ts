import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { mapPostToDTO } from "./post.mapper";

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
      sortPath: null,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      extra: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      unit: {
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
      sortPath: null,
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
});
