import type { CommentDTO } from "@rezics/contract";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { CommentWithRelations } from "./types";

function moderationState(comment: CommentWithRelations) {
  return comment.unit.contentModerationState?.state ?? null;
}

function contentHiddenByGlobalModeration(comment: CommentWithRelations) {
  return ["HIDDEN", "TOMBSTONED", "ARCHIVED"].includes(
    moderationState(comment) ?? "",
  );
}

export function mapCommentToDTO(comment: CommentWithRelations): CommentDTO {
  const contentHidden = contentHiddenByGlobalModeration(comment);
  return {
    unitId: comment.unitId,
    rootUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId,
    parentCommentUnitId: comment.parentCommentUnitId ?? null,
    authorUserId: comment.authorUserId,
    author: mapPublicUser(comment.unit.user),
    content: contentHidden ? null : (comment.content as CommentDTO["content"]),
    depth: comment.depth,
    path: comment.path ?? null,
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt?.toISOString() ?? null,
    isLocked: comment.isLocked,
    state: comment.state ?? null,
    isTombstone: comment.unit.status === "DELETED" || contentHidden,
    pinKind: comment.pinKind ?? null,
    pinPosition: comment.pinPosition ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
