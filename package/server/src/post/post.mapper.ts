import type {
  CommentPromotionDTO,
  PostDTO,
  VariantContextSummary,
} from "@rezics/contract";
import type { CommentPromotion } from "#/prisma/client";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { variantContextForRow } from "@/unit/variant-context";
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

function postLanguageOrder(post: PostWithRelations): string[] {
  const order = [
    post.unit.defaultLanguage,
    post.unit.supportLanguages.find((language) => language.isPrimary)?.language,
    ...post.unit.supportLanguages
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((language) => language.language),
    ...post.unit.translations.map((translation) => translation.language),
    ...post.unit.contentTranslations.map((translation) => translation.language),
  ];
  return [
    ...new Set(order.filter((language): language is string => !!language)),
  ];
}

function resolvePostTitle(post: PostWithRelations): string | null {
  const byLanguage = new Map(
    post.unit.translations.map((translation) => [
      translation.language,
      translation.title,
    ]),
  );
  for (const language of postLanguageOrder(post)) {
    const title = byLanguage.get(language);
    if (title && title.trim().length > 0) return title;
  }
  return null;
}

function resolvePostContent(post: PostWithRelations): PostDTO["content"] {
  const byLanguage = new Map(
    post.unit.contentTranslations.map((translation) => [
      translation.language,
      translation.content,
    ]),
  );
  for (const language of postLanguageOrder(post)) {
    const content = byLanguage.get(language);
    if (content !== undefined && content !== null) {
      return content as PostDTO["content"];
    }
  }
  return null;
}

/**
 * Map a PostWithRelations (Prisma result) to the public PostDTO.
 */
export function mapPostToDTO(
  post: PostWithRelations,
  variantContexts?: ReadonlyMap<string, VariantContextSummary>,
): PostDTO {
  const globalModerationState = moderationState(post);
  const contentHidden = contentHiddenByGlobalModeration(post);

  return {
    unitId: post.unitId,
    authorUserId: post.authorUserId,
    author: mapPublicUser(post.unit.user),
    targetUnitId: post.unit.targetUnitId ?? null,
    variantUnitId: post.variantUnitId ?? null,
    variantContext: variantContextForRow(post, variantContexts),
    realmUnitId: post.unit.inRealms?.[0]?.realmUnitId ?? null,
    title: contentHidden ? null : resolvePostTitle(post),
    content: contentHidden ? null : resolvePostContent(post),
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
