import type { PostDTO, PostPinDTO } from "@rezics/contract";
import type { PostPin } from "#/prisma/client";
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
    targetUnitId: post.targetUnitId ?? null,
    workUnitIds: (post.unit.workMemberships ?? []).map((row) => row.workUnitId),
    workRoles: (post.unit.workMemberships ?? []).map((row) => row.role),
    content: contentHidden ? null : (post.content as PostDTO["content"]),
    rootPostUnitId: post.rootPostUnitId ?? null,
    parentPostUnitId: post.parentPostUnitId ?? null,
    kind: post.kind ?? null,
    status: post.unit.status,
    visibility: post.unit.visibility,
    licenseSlug: resolveStoredLicenseSlug(post.unit.licenseSlug),
    globalModerationState,
    isTombstone: post.unit.status === "DELETED" || contentHidden,
    scoreEntryId: post.scoreEntryId ?? null,
    depth: post.depth,
    path: post.path ?? null,
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

/** Map a PostPin row to its public DTO. */
export function mapPostPinToDTO(pin: PostPin): PostPinDTO {
  return {
    scopeUnitId: pin.scopeUnitId,
    postUnitId: pin.postUnitId,
    kind: pin.kind,
    position: pin.position,
    byUserId: pin.byUserId,
    createdAt: pin.createdAt.toISOString(),
  };
}
