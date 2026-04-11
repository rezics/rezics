import type { PostDTO } from "@rezics/contract";
import { sanitizeUser } from "@/utils/sanitizeUser";
import type { PostWithRelations } from "./types";

/**
 * Map a PostWithRelations (Prisma result) to the public PostDTO.
 */
export function mapPostToDTO(post: PostWithRelations): PostDTO {
  return {
    unitId: post.unitId,
    authorUserId: post.authorUserId,
    author: post.unit.user ? sanitizeUser(post.unit.user) : undefined,
    targetUnitId: post.targetUnitId ?? null,
    realmUnitId: post.realmUnitId ?? null,
    body: post.body ?? null,
    rootPostUnitId: post.rootPostUnitId ?? null,
    parentPostUnitId: post.parentPostUnitId ?? null,
    kind: post.kind ?? null,
    depth: post.depth,
    sortPath: post.sortPath ?? null,
    replyCount: post.replyCount,
    directReplyCount: post.directReplyCount,
    lastReplyAt: post.lastReplyAt?.toISOString() ?? null,
    isLocked: post.isLocked,
    extra: post.extra as Record<string, unknown> | null,
    reactionSummaries: post.unit.reactionSummaries,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}
