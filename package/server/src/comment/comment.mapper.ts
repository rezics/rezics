import type { CommentDTO } from "@rezics/contract";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { CommentWithRelations } from "./comment.types";

export function mapCommentToDTO(comment: CommentWithRelations): CommentDTO {
  const isDeleted = Boolean(comment.deletedAt);
  const isRemoved = comment.moderationStatus === "REMOVED";
  const isRedacted = isDeleted || isRemoved;
  return {
    id: comment.id,
    unitId: comment.id,
    rootUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId ?? null,
    parentCommentId: comment.parentCommentId ?? null,
    authorUserId: isRedacted ? null : comment.authorUserId,
    author: isRedacted ? undefined : mapPublicUser(comment.author),
    content: isRedacted ? null : (comment.content as CommentDTO["content"]),
    moderationStatus:
      comment.moderationStatus.toLowerCase() as CommentDTO["moderationStatus"],
    removedReason: isRemoved ? "content_removed_by_moderator" : null,
    removedByAuthority: isRemoved ? "platform" : null,
    isRedacted,
    redactionKind: isRemoved
      ? "moderator_removed"
      : isDeleted
        ? "author_deleted"
        : null,
    depth: comment.depth,
    path: comment.path ?? null,
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt?.toISOString() ?? null,
    isLocked: comment.isLocked,
    state: comment.state ?? null,
    pinKind: (comment.pinKind ?? null) as CommentDTO["pinKind"],
    pinPosition: comment.pinPosition ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
