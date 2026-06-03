import type { CommentDTO } from "@rezics/contract";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { CommentWithRelations } from "./comment.types";

export function mapCommentToDTO(comment: CommentWithRelations): CommentDTO {
  const isTombstone = comment.visibilityState === "TOMBSTONED";
  return {
    id: comment.id,
    unitId: comment.id,
    rootUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId ?? null,
    parentCommentId: comment.parentCommentId ?? null,
    authorUserId: comment.authorUserId,
    author: mapPublicUser(comment.author),
    content: isTombstone ? null : (comment.content as CommentDTO["content"]),
    depth: comment.depth,
    path: comment.path ?? null,
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt?.toISOString() ?? null,
    isLocked: comment.isLocked,
    state: comment.state ?? null,
    isTombstone,
    pinKind: (comment.pinKind ?? null) as CommentDTO["pinKind"],
    pinPosition: comment.pinPosition ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}
