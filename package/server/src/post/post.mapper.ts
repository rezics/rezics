import type {
  CommentPromotionDTO,
  PostDTO,
  SupportLanguageLike,
  VariantContextSummary,
} from "@rezics/contract";
import { resolveReadLanguage } from "@rezics/contract";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { variantContextForRow } from "@/unit/variant-context";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { CommentPromotion } from "../db/schema";
import type { PostWithRelations } from "./types";

type CommentPromotionRow = typeof CommentPromotion.$inferSelect;

function moderationStatus(post: PostWithRelations) {
  return post.unit.moderationStatus.toLowerCase() as
    | PostDTO["moderationStatus"]
    | undefined;
}

function contentHiddenByGlobalModeration(post: PostWithRelations) {
  return post.unit.moderationStatus === "REMOVED";
}

function resolvedPostLanguage(
  post: PostWithRelations,
  languages: readonly string[] = [],
): string | null {
  return resolveReadLanguage({
    languages,
    supportLanguages: post.unit.supportLanguages as SupportLanguageLike[],
  });
}

function resolvePostTitle(
  post: PostWithRelations,
  language: string | null,
): string | null {
  if (!language) return null;
  const title = post.unit.translations.find(
    (translation) => translation.language === language,
  )?.title;
  return title ?? null;
}

function resolvePostContent(
  post: PostWithRelations,
  language: string | null,
): PostDTO["content"] {
  if (!language) return null;
  const content = post.unit.contentTranslations.find(
    (translation) => translation.language === language,
  )?.content;
  return (content as PostDTO["content"] | undefined) ?? null;
}

function previewLanguage(
  post: PostWithRelations,
  languages: readonly string[] = [],
): PostDTO["resolvedLanguage"] {
  return resolvedPostLanguage(post, languages) as PostDTO["resolvedLanguage"];
}

function previewTitle(
  post: PostWithRelations,
  language: PostDTO["resolvedLanguage"],
): string | null {
  return resolvePostTitle(post, language ?? null);
}

function previewContent(
  post: PostWithRelations,
  language: PostDTO["resolvedLanguage"],
): PostDTO["content"] {
  return resolvePostContent(post, language ?? null);
}

/**
 * Map a hydrated post row to the public PostDTO.
 */
export function mapPostToDTO(
  post: PostWithRelations,
  variantContexts?: ReadonlyMap<string, VariantContextSummary>,
  languages: readonly string[] = [],
): PostDTO {
  const unitModerationStatus = moderationStatus(post);
  const contentHidden = contentHiddenByGlobalModeration(post);
  const resolvedLanguage = previewLanguage(post, languages);

  return {
    unitId: post.unitId,
    authorUserId: post.authorUserId,
    author: mapPublicUser(post.unit.user),
    targetUnitId: post.unit.targetUnitId ?? null,
    variantUnitId: post.variantUnitId ?? null,
    variantContext: variantContextForRow(post, variantContexts),
    realmUnitId: post.unit.inRealms?.[0]?.realmUnitId ?? null,
    resolvedLanguage,
    title: contentHidden ? null : previewTitle(post, resolvedLanguage),
    content: contentHidden ? null : previewContent(post, resolvedLanguage),
    kind: post.kind ?? null,
    status: post.unit.status,
    visibility: post.unit.visibility,
    licenseSlug: resolveStoredLicenseSlug(post.unit.licenseSlug),
    moderationStatus: unitModerationStatus,
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
  pin: CommentPromotionRow,
): CommentPromotionDTO {
  return {
    scopeUnitId: pin.scopeUnitId,
    commentId: pin.commentId,
    kind: pin.kind,
    position: pin.position,
    byUserId: pin.byUserId,
    createdAt: pin.createdAt.toISOString(),
  };
}
