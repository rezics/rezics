import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { mapCommentToDTO } from "./comment.mapper";
import type { CommentWithRelations } from "./comment.types";

const baseComment = {
  id: "comment-1",
  rootUnitId: "root-1",
  realmUnitId: "realm-1",
  parentCommentId: null,
  authorUserId: "user-1",
  content: markdownContentDoc("body"),
  moderationStatus: "APPROVED",
  deletedAt: null,
  depth: 1,
  replyCount: 2,
  directReplyCount: 1,
  lastReplyAt: new Date("2026-01-02T00:00:00.000Z"),
  isLocked: true,
  state: "OPEN",
  pinKind: "PINNED",
  pinPosition: "a0",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  author: {
    unitId: "user-1",
    name: "Author",
    avatar: null,
    bio: null,
    description: null,
    followersCount: 0,
    followingsCount: 0,
  },
} as const satisfies Partial<CommentWithRelations>;

describe("mapCommentToDTO", () => {
  test("redacts moderator-removed comments into inert public stubs", () => {
    const dto = mapCommentToDTO({
      ...baseComment,
      moderationStatus: "REMOVED",
    } as CommentWithRelations);

    expect(dto).toMatchObject({
      id: "comment-1",
      rootUnitId: "root-1",
      moderationStatus: "removed",
      authorUserId: null,
      content: null,
      isRedacted: true,
      redactionKind: "moderator_removed",
      removedReason: "content_removed_by_moderator",
      removedByAuthority: "platform",
    });
    expect(dto).not.toHaveProperty("author");
    expect(dto).not.toHaveProperty("replyCount");
    expect(dto).not.toHaveProperty("directReplyCount");
    expect(dto).not.toHaveProperty("lastReplyAt");
    expect(dto).not.toHaveProperty("isLocked");
    expect(dto).not.toHaveProperty("state");
    expect(dto).not.toHaveProperty("pinKind");
    expect(dto).not.toHaveProperty("pinPosition");
  });

  test("redacts author-deleted comments with a distinct label", () => {
    const dto = mapCommentToDTO({
      ...baseComment,
      deletedAt: new Date("2026-01-03T00:00:00.000Z"),
    } as CommentWithRelations);

    expect(dto).toMatchObject({
      moderationStatus: "approved",
      authorUserId: null,
      content: null,
      isRedacted: true,
      redactionKind: "author_deleted",
      removedReason: null,
      removedByAuthority: null,
    });
    expect(dto).not.toHaveProperty("author");
    expect(dto).not.toHaveProperty("pinKind");
  });
});
