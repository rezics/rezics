import type { CommentDTO, PostDTO } from "@rezics/contract";

export function mapCommentToPost(comment: CommentDTO): PostDTO {
  return {
    unitId: comment.unitId,
    authorUserId: comment.authorUserId,
    author: comment.author,
    targetUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId,
    content: comment.content,
    kind: null,
    status: undefined,
    visibility: undefined,
    depth: comment.depth,
    path: comment.path,
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt,
    isLocked: comment.isLocked,
    state: comment.state,
    pinKind: comment.pinKind,
    pinPosition: comment.pinPosition,
    extra: null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
