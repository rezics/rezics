import {
  markdownContentDoc,
  type PostDTO,
  type PostSearchDocument,
} from "@rezics/contract";

type PostExtraRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PostExtraRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapExtra(doc: PostSearchDocument): PostDTO["extra"] {
  const targetTitle = doc.targetTitles?.find(Boolean);
  if (!targetTitle || !doc.targetUnitId) {
    return doc.extra as PostDTO["extra"];
  }

  const extra = isRecord(doc.extra) ? { ...doc.extra } : {};
  extra.book = {
    id: doc.targetUnitId,
    title: targetTitle,
  };
  return extra as PostDTO["extra"];
}

export function mapPostSearchDocToPostDTO(doc: PostSearchDocument): PostDTO {
  return {
    unitId: doc.id,
    authorUserId: doc.authorUserId,
    author: {
      unitId: doc.authorUserId,
      name: doc.authorName ?? "",
      slug: doc.authorSlug ?? undefined,
      avatar: doc.authorAvatar ?? undefined,
    },
    targetUnitId: doc.targetUnitId,
    realmUnitId:
      (doc as PostSearchDocument & { realmUnitId?: string | null })
        .realmUnitId ?? undefined,
    title: doc.titleText ?? undefined,
    content: markdownContentDoc(doc.contentText ?? ""),
    kind: doc.kind as PostDTO["kind"],
    replyCount: doc.replyCount,
    directReplyCount: doc.directReplyCount,
    lastReplyAt: doc.lastReplyAt,
    isLocked: doc.isLocked,
    scoreEntryId: doc.scoreEntryId,
    extra: mapExtra(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
