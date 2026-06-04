import type { CommentDTO } from "@rezics/contract";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { CommentWithRelations } from "./comment.types";

export function mapCommentToDTO(comment: CommentWithRelations): CommentDTO {
  const isDeleted = Boolean(comment.deletedAt);
  const isRemoved = comment.moderationStatus === "REMOVED";
  const isRedacted = isDeleted || isRemoved;
  const base = {
    id: comment.id,
    unitId: comment.id,
    rootUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId ?? null,
    parentCommentId: comment.parentCommentId ?? null,
    moderationStatus:
      comment.moderationStatus.toLowerCase() as CommentDTO["moderationStatus"],
    removedReason: isRemoved ? "content_removed_by_moderator" : null,
    removedByAuthority: (isRemoved
      ? "platform"
      : null) as CommentDTO["removedByAuthority"],
    isRedacted,
    redactionKind: (isRemoved
      ? "moderator_removed"
      : isDeleted
        ? "author_deleted"
        : null) as CommentDTO["redactionKind"],
    depth: comment.depth,
    path: comment.path ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };

  if (isRedacted) {
    return {
      ...base,
      authorUserId: null,
      content: null,
    };
  }

  return {
    ...base,
    authorUserId: comment.authorUserId,
    author: mapPublicUser(comment.author),
    content: comment.content as CommentDTO["content"],
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt?.toISOString() ?? null,
    isLocked: comment.isLocked,
    state: comment.state ?? null,
    pinKind: (comment.pinKind ?? null) as CommentDTO["pinKind"],
    pinPosition: comment.pinPosition ?? null,
  };
}
