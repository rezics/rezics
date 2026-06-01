import type { PostDTO, CommentPromotionDTO } from "@rezics/contract";
import type { CommentPromotion } from "#/prisma/client";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { PostWithRelations } from "./types";

function moderationState(post: PostWithRelations) {
  return post.unit.contentModerationState?.state.toLowerCase() as
    | PostDTO["globalModerationState"]
    | undefined;
}

function contentHiddenByGlobalModeration(post: PostWithRelations) {
  return ["HIDDEN", "TOMBSTONED", "ARCHIVED"].includes(
    post.unit.contentModerationState?.state ?? "",
  );
}

/**
 * Map a PostWithRelations (Prisma result) to the public PostDTO.
 */
export function mapPostToDTO(post: PostWithRelations): PostDTO {
  const globalModerationState = moderationState(post);
  const contentHidden = contentHiddenByGlobalModeration(post);

  return {
    unitId: post.unitId,
    authorUserId: post.authorUserId,
    author: mapPublicUser(post.unit.user),
    targetUnitId: post.unit.targetUnitId ?? null,
    variantUnitId: post.variantUnitId ?? null,
    realmUnitId: post.unit.inRealms?.[0]?.realmUnitId ?? null,
    content: contentHidden ? null : (post.content as PostDTO["content"]),
    kind: post.kind ?? null,
    status: post.unit.status,
    visibility: post.unit.visibility,
    licenseSlug: resolveStoredLicenseSlug(post.unit.licenseSlug),
    globalModerationState,
    isTombstone: post.unit.status === "DELETED" || contentHidden,
    scoreEntryId: post.scoreEntryId ?? null,
    replyCount: post.replyCount,
    directReplyCount: post.directReplyCount,
    lastReplyAt: post.lastReplyAt?.toISOString() ?? null,
    isLocked: post.isLocked,
    state: post.state ?? null,
    pinKind: post.pinKind ?? null,
    pinPosition: post.pinPosition ?? null,
    extra: post.extra as Record<string, unknown> | null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

/** Map the current promotion storage row to its public comment promotion DTO. */
export function mapCommentPromotionToDTO(
  pin: CommentPromotion,
): CommentPromotionDTO {
  return {
    scopeUnitId: pin.scopeUnitId,
    commentUnitId: pin.commentUnitId,
    kind: pin.kind,
    position: pin.position,
    byUserId: pin.byUserId,
    createdAt: pin.createdAt.toISOString(),
  };
}
