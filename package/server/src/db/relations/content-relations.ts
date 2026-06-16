import type { ServerRelationsBuilder } from "./types";

export function contentRelations(r: ServerRelationsBuilder) {
  return {
    Comment: {
      User: r.one.User({
        from: r.Comment.authorUserId,
        to: r.User.unitId,
      }),
      Comment: r.one.Comment({
        from: r.Comment.parentCommentId,
        to: r.Comment.id,
        alias: "Comment_parentCommentId_Comment_id",
      }),
      Comments: r.many.Comment({
        alias: "Comment_parentCommentId_Comment_id",
      }),
      Unit_realmUnitId: r.one.Unit({
        from: r.Comment.realmUnitId,
        to: r.Unit.id,
        alias: "Comment_realmUnitId_Unit_id",
      }),
      Unit_rootUnitId: r.one.Unit({
        from: r.Comment.rootUnitId,
        to: r.Unit.id,
        alias: "Comment_rootUnitId_Unit_id",
      }),
      Units: r.many.Unit({
        from: r.Comment.id.through(r.CommentPromotion.commentId),
        to: r.Unit.id.through(r.CommentPromotion.scopeUnitId),
        alias: "Comment_id_Unit_id_via_CommentPromotion",
      }),
    },
    ContentStructure: {
      Unit: r.one.Unit({
        from: r.ContentStructure.ownerUnitId,
        to: r.Unit.id,
      }),
      ContentStructureAnchors: r.many.ContentStructureAnchor(),
      ContentStructureNodes: r.many.ContentStructureNode(),
    },
    ContentStructureAnchor: {
      Unit: r.one.Unit({
        from: r.ContentStructureAnchor.contentUnitId,
        to: r.Unit.id,
      }),
      ContentStructureNode: r.one.ContentStructureNode({
        from: r.ContentStructureAnchor.nodeId,
        to: r.ContentStructureNode.id,
      }),
      ContentStructure: r.one.ContentStructure({
        from: r.ContentStructureAnchor.ownerUnitId,
        to: r.ContentStructure.ownerUnitId,
      }),
    },
    ContentStructureNode: {
      ContentStructureAnchors: r.many.ContentStructureAnchor(),
      Unit: r.one.Unit({
        from: r.ContentStructureNode.contentUnitId,
        to: r.Unit.id,
      }),
      ContentStructure: r.one.ContentStructure({
        from: r.ContentStructureNode.ownerUnitId,
        to: r.ContentStructure.ownerUnitId,
      }),
      ContentStructureNode: r.one.ContentStructureNode({
        from: r.ContentStructureNode.parentId,
        to: r.ContentStructureNode.id,
        alias: "ContentStructureNode_parentId_ContentStructureNode_id",
      }),
      ContentStructureNodes: r.many.ContentStructureNode({
        alias: "ContentStructureNode_parentId_ContentStructureNode_id",
      }),
      SeriesContentIndices: r.one.SeriesContentIndex(),
      Users: r.many.User({
        from: r.ContentStructureNode.id.through(
          r.UserContentNodeProgress.nodeId,
        ),
        to: r.User.unitId.through(r.UserContentNodeProgress.userId),
      }),
      UserUnitProgresses: r.many.UserUnitProgress(),
    },
    ContentTranslation: {
      Unit: r.one.Unit({
        from: r.ContentTranslation.unitId,
        to: r.Unit.id,
      }),
    },
    UserUnitProgress: {
      ContentStructureNode: r.one.ContentStructureNode({
        from: r.UserUnitProgress.lastReadNodeId,
        to: r.ContentStructureNode.id,
      }),
      UserUnitProgressPosts: r.many.UserUnitProgressPost(),
      Unit: r.one.Unit({
        from: r.UserUnitProgress.unitId,
        to: r.Unit.id,
      }),
      User: r.one.User({
        from: r.UserUnitProgress.userId,
        to: r.User.unitId,
      }),
    },
    UserUnitProgressPost: {
      UserUnitProgress: r.one.UserUnitProgress({
        from: r.UserUnitProgressPost.progressId,
        to: r.UserUnitProgress.id,
      }),
      Post: r.one.Post({
        from: r.UserUnitProgressPost.postUnitId,
        to: r.Post.unitId,
      }),
    },
  };
}
