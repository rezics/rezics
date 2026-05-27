import type { PostDTO } from "@rezics/contract";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { PostWithRelations } from "./types";

/**
 * Map a PostWithRelations (Prisma result) to the public PostDTO.
 */
export function mapPostToDTO(post: PostWithRelations): PostDTO {
  return {
    unitId: post.unitId,
    authorUserId: post.authorUserId,
    author: mapPublicUser(post.unit.user),
    targetUnitId: post.targetUnitId ?? null,
    workUnitIds: (post.unit.workMemberships ?? []).map((row) => row.workUnitId),
    workRoles: (post.unit.workMemberships ?? []).map((row) => row.role),
    content: post.content as PostDTO["content"],
    rootPostUnitId: post.rootPostUnitId ?? null,
    parentPostUnitId: post.parentPostUnitId ?? null,
    kind: post.kind ?? null,
    status: post.unit.status,
    visibility: post.unit.visibility,
    licenseSlug: resolveStoredLicenseSlug(post.unit.licenseSlug),
    isTombstone: post.unit.status === "DELETED",
    scoreEntryId: post.scoreEntryId ?? null,
    depth: post.depth,
    sortPath: post.sortPath ?? null,
    replyCount: post.replyCount,
    directReplyCount: post.directReplyCount,
    lastReplyAt: post.lastReplyAt?.toISOString() ?? null,
    isLocked: post.isLocked,
    extra: post.extra as Record<string, unknown> | null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}
