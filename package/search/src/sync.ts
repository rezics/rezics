import type {
  ContentSearchDocument,
  EntitySearchDocument,
  FeedbackSearchDocument,
  PostSearchDocument,
  RealmSearchDocument,
  UserSearchDocument,
} from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import { prisma, UnitType } from "@rezics/server";
import type { SearchClient } from "./client";
import {
  buildProgressDocument,
  progressDocumentId,
  type UserUnitProgressRow,
} from "./progress";

function pickCoverUrlFromTranslations(
  defaultLanguage: string | null | undefined,
  translations: readonly { language: string; extra: unknown }[] | undefined,
): string | null {
  const list = translations ?? [];
  if (list.length === 0) return null;
  const ordered = [
    defaultLanguage
      ? list.find((t) => t.language === defaultLanguage)
      : undefined,
    list.find((t) => t.language === "en"),
    ...list,
  ];
  for (const tr of ordered) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return null;
}

const BATCH_SIZE = 5000;
const PROGRESS_SYNC_ATTEMPTS = 3;
const PROGRESS_SYNC_RETRY_BASE_MS = 100;

const INDEXABLE_TYPES = [
  UnitType.BOOK,
  UnitType.GAME,
  UnitType.MEDIA,
  UnitType.SHELF,
  UnitType.LINK,
];

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runProgressSyncWithRetry(
  operation: () => Promise<unknown>,
  context: { action: "sync" | "remove"; userId: string; unitId: string },
): Promise<void> {
  for (let attempt = 1; attempt <= PROGRESS_SYNC_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (attempt === PROGRESS_SYNC_ATTEMPTS) {
        console.error("progress search sync exhausted", {
          ...context,
          attempts: PROGRESS_SYNC_ATTEMPTS,
          error: describeError(error),
        });
        return;
      }

      await delay(PROGRESS_SYNC_RETRY_BASE_MS * attempt);
    }
  }
}

const contentInclude = {
  translations: true,
  unitTags: {
    include: {
      tag: { include: { translations: true } },
    },
    orderBy: { score: "desc" as const },
  },
  inRealms: true,
  realmTagApplicationsAsTargetUnit: true,
  creditAttributions: {
    include: {
      entity: {
        include: { entity: true, translations: true },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  subjectAttributions: {
    include: {
      entity: {
        include: { entity: true, translations: true },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  book: true,
  game: { include: { platforms: true } },
  media: true,
  shelf: { include: { units: { select: { unitId: true } } } },
  link: true,
  post: true,
} as const;

/**
 * Build a ContentSearchDocument from a Prisma unit with all relations included.
 */
export function buildContentDocument(unit: any): ContentSearchDocument {
  const translations: any[] = unit.translations ?? [];
  const unitTags: any[] = unit.unitTags ?? [];
  const inRealms: any[] = unit.inRealms ?? [];
  const realmTagApplicationsAsTargetUnit: any[] =
    unit.realmTagApplicationsAsTargetUnit ?? [];
  const creditAttributions: any[] = unit.creditAttributions ?? [];
  const subjectAttributions: any[] = unit.subjectAttributions ?? [];

  // Flatten translations
  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const subtitles = translations.map((t: any) => t.subtitle).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);
  const descriptions = translations
    .map((t: any) => t.description)
    .filter(Boolean);
  const languages = translations.map((t: any) => t.language);

  // Tags
  const tagIds = unitTags.map((ut: any) => ut.tagUnitId);
  const tagScores: Record<string, number> = {};
  const tagLabels: string[] = [];
  for (const ut of unitTags) {
    tagScores[ut.tagUnitId] = ut.score;
    const labels: string[] = (ut.tag?.translations ?? [])
      .map((t: any) => t.title)
      .filter(Boolean);
    tagLabels.push(...labels);
  }

  // Realms
  const realmIds = inRealms.map((r: any) => r.realmUnitId);

  // Realm-tag compound keys
  const realmTagKeys = realmTagApplicationsAsTargetUnit.map(
    (rt: any) => `${rt.realmUnitId}:${rt.tagUnitId}`,
  );

  // Credit attribution
  const creditNames = creditAttributions
    .map((a: any) => {
      const translations = a.entity?.translations ?? [];
      return translations[0]?.title;
    })
    .filter(Boolean);

  const subjectEntityIds = subjectAttributions.map((a: any) => a.entityId);
  const subjectNames = subjectAttributions
    .flatMap((a: any) =>
      (a.entity?.translations ?? []).map(
        (translation: any) => translation.title,
      ),
    )
    .filter(Boolean);
  const subjectKinds = [
    ...new Set(
      subjectAttributions
        .map((a: any) => a.entity?.entity?.kind)
        .filter(Boolean),
    ),
  ];
  const subjectRoles = [
    ...new Set(subjectAttributions.map((a: any) => a.role).filter(Boolean)),
  ];

  // Type extension fields
  const ext = unit.book ?? unit.game ?? unit.media ?? null;
  const isLicensed = ext?.isLicensed ?? false;
  const coverUrl = pickCoverUrlFromTranslations(
    unit.defaultLanguage,
    translations,
  );

  // Link-specific fields
  const linkUrl = unit.link?.url ?? null;
  const linkSiteName = unit.link?.siteName ?? null;

  // Post kind + book textLength for search filters
  const postKind = unit.post?.kind ?? null;
  const textLength = unit.book?.textLength ?? null;

  // Shelf membership: list of unit ids contained in this shelf (SHELF type only)
  const containedUnitIds: string[] | undefined =
    unit.type === UnitType.SHELF
      ? ((unit.shelf?.units ?? []) as { unitId: string }[]).map((i) => i.unitId)
      : undefined;

  return {
    id: unit.id,
    type: unit.type,
    titles,
    subtitles,
    summaries,
    descriptions,
    creditNames,
    subjectNames,
    subjectEntityIds,
    subjectKinds,
    subjectRoles,
    tagLabels,
    tagIds,
    tagScores,
    realmIds,
    realmTagKeys,
    languages,
    rating: unit.rating ?? "GENERAL",
    visibility: unit.visibility ?? "PUBLIC",
    isLicensed,
    postKind,
    textLength,
    createdAt:
      unit.createdAt instanceof Date
        ? unit.createdAt.toISOString()
        : unit.createdAt,
    updatedAt:
      unit.updatedAt instanceof Date
        ? unit.updatedAt.toISOString()
        : unit.updatedAt,
    publishedAt: unit.publishedAt
      ? unit.publishedAt instanceof Date
        ? unit.publishedAt.toISOString()
        : unit.publishedAt
      : null,
    defaultLanguage: unit.defaultLanguage ?? null,
    coverUrl,
    userId: unit.userId ?? null,
    ...(containedUnitIds !== undefined ? { containedUnitIds } : {}),
    linkUrl,
    linkSiteName,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      subtitle: tr.subtitle ?? null,
      summary: tr.summary ?? null,
      description: tr.description ?? null,
    })),
  };
}

// ANCHOR: Full content reindex

export async function syncAllContent(client: SearchClient) {
  const deleteResult = await client.deleteAllContent();
  console.log("syncAllContent: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllContent: cursor", cursor, "total", total);

    const units: any[] = await prisma.unit.findMany({
      where: {
        workUnitId: null,
        type: { in: INDEXABLE_TYPES },
        status: "PUBLISHED",
        visibility: "PUBLIC",
      },
      include: contentInclude,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    if (units.length === 0) break;

    const docs = units.map(buildContentDocument);
    const addResult = await client.addOrUpdateContent(docs);
    console.log("syncAllContent: added batch", addResult);

    total += docs.length;
    cursor = units[units.length - 1]!.id;
  }

  return { message: "syncAllContent success", totalSynced: total };
}

// ANCHOR: Progress sync functions

export async function syncProgress(
  client: SearchClient,
  row: UserUnitProgressRow,
): Promise<void> {
  const doc = buildProgressDocument(row);
  await runProgressSyncWithRetry(() => client.addOrUpdateProgress([doc]), {
    action: "sync",
    userId: row.userId,
    unitId: row.unitId,
  });
}

export async function removeProgress(
  client: SearchClient,
  userId: string,
  unitId: string,
): Promise<void> {
  await runProgressSyncWithRetry(
    () => client.deleteProgress(progressDocumentId(userId, unitId)),
    { action: "remove", userId, unitId },
  );
}

// ANCHOR: Incremental single-unit sync

export async function syncSingleContent(client: SearchClient, unitId: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: contentInclude,
  });

  // If unit doesn't exist or doesn't qualify, remove from index
  if (
    !unit ||
    unit.workUnitId != null ||
    !INDEXABLE_TYPES.includes(unit.type as any) ||
    unit.status !== "PUBLISHED" ||
    unit.visibility !== "PUBLIC"
  ) {
    await client.deleteContent([unitId]);
    return;
  }

  const doc = buildContentDocument(unit);
  await client.addOrUpdateContent([doc]);
}

// ANCHOR: Content partial sync functions

export async function patchContentTags(client: SearchClient, unitId: string) {
  const unitTags = await prisma.unitTag.findMany({
    where: { unitId },
    include: { tag: { include: { translations: true } } },
    orderBy: { score: "desc" },
  });

  const tagIds = unitTags.map((ut: any) => ut.tagUnitId);
  const tagScores: Record<string, number> = {};
  const tagLabels: string[] = [];
  for (const ut of unitTags) {
    tagScores[ut.tagUnitId] = ut.score;
    const labels: string[] = ((ut as any).tag?.translations ?? [])
      .map((t: any) => t.title)
      .filter(Boolean);
    tagLabels.push(...labels);
  }

  await client.patchContent([{ id: unitId, tagIds, tagScores, tagLabels }]);
}

export async function patchContentCredits(
  client: SearchClient,
  unitId: string,
) {
  const creditAttributions = await prisma.creditAttribution.findMany({
    where: { unitId },
    include: {
      entity: {
        include: { translations: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const creditNames = creditAttributions
    .map((a: any) => {
      const translations = a.entity?.translations ?? [];
      return translations[0]?.title;
    })
    .filter(Boolean);

  await client.patchContent([{ id: unitId, creditNames }]);
}

export async function patchContentSubjects(
  client: SearchClient,
  unitId: string,
) {
  const subjectAttributions = await prisma.subjectAttribution.findMany({
    where: { unitId },
    include: {
      entity: {
        include: { entity: true, translations: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const subjectEntityIds = subjectAttributions.map((a: any) => a.entityId);
  const subjectNames = subjectAttributions
    .flatMap((a: any) =>
      (a.entity?.translations ?? []).map(
        (translation: any) => translation.title,
      ),
    )
    .filter(Boolean);
  const subjectKinds = [
    ...new Set(
      subjectAttributions
        .map((a: any) => a.entity?.entity?.kind)
        .filter(Boolean),
    ),
  ];
  const subjectRoles = [
    ...new Set(subjectAttributions.map((a: any) => a.role).filter(Boolean)),
  ];

  await client.patchContent([
    { id: unitId, subjectEntityIds, subjectNames, subjectKinds, subjectRoles },
  ]);
}

export async function patchContentTranslations(
  client: SearchClient,
  unitId: string,
) {
  const translations = await prisma.unitTranslation.findMany({
    where: { unitId },
  });

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const subtitles = translations.map((t: any) => t.subtitle).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);
  const descriptions = translations
    .map((t: any) => t.description)
    .filter(Boolean);
  const languages = translations.map((t: any) => t.language);

  await client.patchContent([
    {
      id: unitId,
      titles,
      subtitles,
      summaries,
      descriptions,
      languages,
      translations: translations.map((tr: any) => ({
        language: tr.language,
        title: tr.title ?? null,
        subtitle: tr.subtitle ?? null,
        summary: tr.summary ?? null,
        description: tr.description ?? null,
      })),
    },
  ]);
}

export async function patchContentRealmIds(
  client: SearchClient,
  unitId: string,
) {
  const inRealms = await prisma.realmUnit.findMany({
    where: { unitId },
  });

  const realmIds = inRealms.map((r: any) => r.realmUnitId);
  await client.patchContent([{ id: unitId, realmIds }]);
}

export async function patchContentRealmTagKeys(
  client: SearchClient,
  unitId: string,
) {
  const realmTagApplicationsAsTargetUnit = await prisma.realmTagUnit.findMany({
    where: { unitId },
  });

  const realmTagKeys = realmTagApplicationsAsTargetUnit.map(
    (rt: any) => `${rt.realmUnitId}:${rt.tagUnitId}`,
  );
  await client.patchContent([{ id: unitId, realmTagKeys }]);
}

export async function patchContentMetadata(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  await client.patchContent([{ id: unitId, ...fields }]);
}

/**
 * Recompute the post-state `containedUnitIds` for a SHELF unit and push a
 * partial update to Meilisearch. The caller is responsible for invoking this
 * after every ShelfUnit insert/delete on the shelf.
 */
export async function patchContentContainedUnitIds(
  client: SearchClient,
  shelfId: string,
) {
  const units = await prisma.shelfUnit.findMany({
    where: { shelfId },
    select: { unitId: true },
  });
  const containedUnitIds = units.map((u) => u.unitId);
  await client.patchContent([{ id: shelfId, containedUnitIds }]);
}

// ANCHOR: Post partial sync functions

export async function patchPostsAuthor(
  client: SearchClient,
  userId: string,
  fields: Record<string, any>,
) {
  let cursor: string | undefined;

  while (true) {
    const posts = await prisma.post.findMany({
      where: {
        authorUserId: userId,
        unit: { status: "PUBLISHED" },
      },
      select: { unitId: true },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map((p) => ({ id: p.unitId, ...fields }));
    await client.patchPosts(docs);

    cursor = posts[posts.length - 1]!.unitId;
  }
}

export async function patchPostsTarget(
  client: SearchClient,
  targetUnitId: string,
) {
  // Fetch target unit data once
  const targetUnit = await prisma.unit.findUnique({
    where: { id: targetUnitId },
    include: {
      translations: true,
      book: true,
      game: true,
      media: true,
    },
  });

  let targetTitles: string[] | null = null;
  let targetType: string | null = null;
  let targetCoverUrl: string | null = null;

  if (targetUnit) {
    const translations: any[] = targetUnit.translations ?? [];
    targetTitles = translations.map((t: any) => t.title).filter(Boolean);
    targetType = targetUnit.type ?? null;
    targetCoverUrl = pickCoverUrlFromTranslations(
      (targetUnit as any).defaultLanguage,
      translations,
    );
  }

  let cursor: string | undefined;

  while (true) {
    const posts = await prisma.post.findMany({
      where: {
        targetUnitId,
        unit: { status: "PUBLISHED" },
      },
      select: { unitId: true },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map((p) => ({
      id: p.unitId,
      targetTitles,
      targetType,
      targetCoverUrl,
    }));
    await client.patchPosts(docs);

    cursor = posts[posts.length - 1]!.unitId;
  }
}

export async function patchPostFields(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  await client.patchPosts([{ id: unitId, ...fields }]);
}

// ANCHOR: Realm partial sync functions

export async function patchRealmMemberCount(
  client: SearchClient,
  unitId: string,
  memberCount: number,
) {
  await client.patchRealms([{ id: unitId, memberCount }]);
}

export async function patchRealmMetadata(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  await client.patchRealms([{ id: unitId, ...fields }]);
}

export async function patchRealmTranslations(
  client: SearchClient,
  unitId: string,
) {
  const translations = await prisma.unitTranslation.findMany({
    where: { unitId },
  });

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const descriptions = translations
    .map((t: any) => t.description)
    .filter(Boolean);

  await client.patchRealms([
    {
      id: unitId,
      titles,
      descriptions,
      translations: translations.map((tr: any) => ({
        language: tr.language,
        title: tr.title ?? null,
        description: tr.description ?? null,
      })),
    },
  ]);
}

// ANCHOR: User and feedback partial sync functions

export async function patchUserFields(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  await client.patchUsers([{ id: unitId, ...fields }]);
}

export async function patchFeedbackResolution(
  client: SearchClient,
  id: string,
  fields: Record<string, any>,
) {
  await client.patchFeedbacks([{ id, ...fields }]);
}

// ANCHOR: Feedbacks sync

export async function syncAllFeedbacks(client: SearchClient) {
  const deleteResult = await client.deleteAllFeedbacks();
  console.log("syncAllFeedbacks: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllFeedbacks: cursor", cursor, "total", total);

    const feedbacks: any[] = await prisma.feedback.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (feedbacks.length === 0) break;

    const formatted: FeedbackSearchDocument[] = feedbacks.map((f) => ({
      id: f.id,
      userId: f.userId,
      unitId: f.unitId,
      url: f.url,
      content: f.content,
      type: f.type,
      resolved: f.resolved,
      resolvedAt: f.resolvedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    const addResult = await client.addOrUpdateFeedbacks(formatted);
    console.log("syncAllFeedbacks: added batch", addResult);

    total += formatted.length;
    cursor = feedbacks[feedbacks.length - 1]!.id;
  }

  return { message: "syncAllFeedbacks success", totalSynced: total };
}

// ANCHOR: Post document builder

const postIncludeForSync = {
  unit: {
    include: {
      user: true,
      inRealms: true,
    },
  },
  targetUnit: {
    include: {
      translations: true,
      book: true,
      game: true,
      media: true,
    },
  },
  scoreEntry: true,
} as const;

export function buildPostDocument(post: any): PostSearchDocument {
  const user = post.unit?.user;
  const inRealms: any[] = post.unit?.inRealms ?? [];
  const targetUnit = post.targetUnit;
  const scoreEntry = post.scoreEntry;

  // Denormalized target unit info
  let targetTitles: string[] | null = null;
  let targetType: string | null = null;
  let targetCoverUrl: string | null = null;

  if (targetUnit) {
    const translations: any[] = targetUnit.translations ?? [];
    targetTitles = translations.map((t: any) => t.title).filter(Boolean);
    targetType = targetUnit.type ?? null;
    targetCoverUrl = pickCoverUrlFromTranslations(
      (targetUnit as any).defaultLanguage,
      translations,
    );
  }

  return {
    id: post.unitId,
    body: post.body ?? null,
    kind: post.kind ?? null,
    depth: post.depth,
    sortPath: post.sortPath ?? null,
    isLocked: post.isLocked,
    replyCount: post.replyCount,
    directReplyCount: post.directReplyCount,
    lastReplyAt: post.lastReplyAt
      ? post.lastReplyAt instanceof Date
        ? post.lastReplyAt.toISOString()
        : post.lastReplyAt
      : null,
    createdAt:
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt,
    updatedAt:
      post.updatedAt instanceof Date
        ? post.updatedAt.toISOString()
        : post.updatedAt,
    targetUnitId: post.targetUnitId ?? null,
    rootTargetUnitId: post.rootTargetUnitId ?? null,
    rootTargetUnitType: post.rootTargetUnitType ?? null,
    realmIds: inRealms.map((realm) => realm.realmUnitId),
    rootPostUnitId: post.rootPostUnitId ?? null,
    parentPostUnitId: post.parentPostUnitId ?? null,
    authorUserId: post.authorUserId,
    scoreEntryId: post.scoreEntryId ?? null,
    authorName: user?.name ?? null,
    authorSlug: user?.slug ?? null,
    authorAvatar: user?.avatar ?? null,
    targetTitles,
    targetType,
    targetCoverUrl,
    scoreValue: scoreEntry?.value ?? null,
    scoreFields: scoreEntry?.fields ?? null,
    extra: post.extra ?? undefined,
  };
}

// ANCHOR: Post sync functions

export async function syncSinglePost(client: SearchClient, unitId: string) {
  const post = await prisma.post.findUnique({
    where: { unitId },
    include: {
      ...postIncludeForSync,
      unit: { include: { user: true, inRealms: true } },
    },
  });

  if (!post || post.unit.status !== "PUBLISHED") {
    await client.deletePosts([unitId]);
    return;
  }

  const doc = buildPostDocument(post);
  await client.addOrUpdatePosts([doc]);
}

export async function syncAllPosts(client: SearchClient) {
  const deleteResult = await client.deleteAllPosts();
  console.log("syncAllPosts: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllPosts: cursor", cursor, "total", total);

    const posts: any[] = await prisma.post.findMany({
      where: {
        unit: { status: "PUBLISHED" },
      },
      include: {
        ...postIncludeForSync,
        unit: { include: { user: true, inRealms: true } },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map(buildPostDocument);
    const addResult = await client.addOrUpdatePosts(docs);
    console.log("syncAllPosts: added batch", addResult);

    total += docs.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncAllPosts success", totalSynced: total };
}

export async function syncAllPostRealmIds(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts: any[] = await prisma.post.findMany({
      where: {
        unit: { status: "PUBLISHED" },
      },
      select: {
        unitId: true,
        unit: {
          select: {
            inRealms: {
              select: { realmUnitId: true },
              orderBy: { realmUnitId: "asc" },
            },
          },
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    await client.patchPosts(
      posts.map((post) => ({
        id: post.unitId,
        realmIds: (post.unit?.inRealms ?? []).map(
          (row: any) => row.realmUnitId,
        ),
      })),
    );

    total += posts.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncAllPostRealmIds success", totalSynced: total };
}

export async function syncAllContainedUnitIds(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const shelves: any[] = await prisma.unit.findMany({
      where: {
        type: UnitType.SHELF,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        shelf: {
          select: {
            units: {
              select: { unitId: true },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });

    if (shelves.length === 0) break;

    await client.patchContent(
      shelves.map((unit) => ({
        id: unit.id,
        containedUnitIds: (unit.shelf?.units ?? []).map(
          (i: { unitId: string }) => i.unitId,
        ),
      })),
    );

    total += shelves.length;
    cursor = shelves[shelves.length - 1]!.id;
  }

  return { message: "syncAllContainedUnitIds success", totalSynced: total };
}

export async function syncAllPostRootTargets(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts: any[] = await prisma.post.findMany({
      where: {
        unit: { status: "PUBLISHED" },
      },
      select: {
        unitId: true,
        rootTargetUnitId: true,
        rootTargetUnitType: true,
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    await client.patchPosts(
      posts.map((post) => ({
        id: post.unitId,
        rootTargetUnitId: post.rootTargetUnitId ?? null,
        rootTargetUnitType: post.rootTargetUnitType ?? null,
      })),
    );

    total += posts.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncAllPostRootTargets success", totalSynced: total };
}

export async function syncPostsByAuthor(client: SearchClient, userId: string) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts: any[] = await prisma.post.findMany({
      where: {
        authorUserId: userId,
        unit: { status: "PUBLISHED" },
      },
      include: {
        ...postIncludeForSync,
        unit: { include: { user: true, inRealms: true } },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map(buildPostDocument);
    await client.addOrUpdatePosts(docs);

    total += docs.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncPostsByAuthor success", totalSynced: total };
}

export async function syncPostsByTarget(
  client: SearchClient,
  targetUnitId: string,
) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts: any[] = await prisma.post.findMany({
      where: {
        targetUnitId,
        unit: { status: "PUBLISHED" },
      },
      include: {
        ...postIncludeForSync,
        unit: { include: { user: true, inRealms: true } },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map(buildPostDocument);
    await client.addOrUpdatePosts(docs);

    total += docs.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncPostsByTarget success", totalSynced: total };
}

// ANCHOR: Realm document builder

export function buildRealmDocument(realm: any): RealmSearchDocument {
  const unit = realm.unit;
  const translations: any[] = unit?.translations ?? [];

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const descriptions = translations
    .map((t: any) => t.description)
    .filter(Boolean);

  return {
    id: realm.unitId,
    isPublic: realm.isPublic,
    isOfficial: realm.isOfficial,
    memberCount: realm.memberCount,
    createdAt:
      realm.createdAt instanceof Date
        ? realm.createdAt.toISOString()
        : realm.createdAt,
    updatedAt:
      realm.updatedAt instanceof Date
        ? realm.updatedAt.toISOString()
        : realm.updatedAt,
    userId: unit?.userId ?? null,
    titles,
    descriptions,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      description: tr.description ?? null,
    })),
    extra: realm.extra ?? undefined,
  };
}

// ANCHOR: Realm sync functions

export async function syncSingleRealm(client: SearchClient, unitId: string) {
  const realm = await prisma.realm.findUnique({
    where: { unitId },
    include: {
      unit: {
        include: {
          translations: true,
        },
      },
    },
  });

  if (!realm || realm.unit.status !== "PUBLISHED") {
    await client.deleteRealms([unitId]);
    return;
  }

  const doc = buildRealmDocument(realm);
  await client.addOrUpdateRealms([doc]);
}

export async function syncAllRealms(client: SearchClient) {
  const deleteResult = await client.deleteAllRealms();
  console.log("syncAllRealms: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllRealms: cursor", cursor, "total", total);

    const realms: any[] = await prisma.realm.findMany({
      where: {
        unit: { status: "PUBLISHED" },
      },
      include: {
        unit: {
          include: {
            translations: true,
          },
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (realms.length === 0) break;

    const docs = realms.map(buildRealmDocument);
    const addResult = await client.addOrUpdateRealms(docs);
    console.log("syncAllRealms: added batch", addResult);

    total += docs.length;
    cursor = realms[realms.length - 1]!.unitId;
  }

  return { message: "syncAllRealms success", totalSynced: total };
}

// ANCHOR: Entity document builder + sync

const entityIncludeForSync = {
  unit: {
    include: {
      translations: true,
    },
  },
} as const;

export function buildEntityDocument(entity: any): EntitySearchDocument {
  const unit = entity.unit;
  const translations: any[] = unit?.translations ?? [];

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);

  return {
    id: entity.unitId,
    unitId: entity.unitId,
    kind: entity.kind ?? null,
    verified: entity.verified,
    slug: unit?.slug ?? null,
    ownerUnitId: unit?.userId ?? null,
    titles,
    summaries,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      subtitle: tr.subtitle ?? null,
      summary: tr.summary ?? null,
    })),
    createdAt:
      unit?.createdAt instanceof Date
        ? unit.createdAt.toISOString()
        : (unit?.createdAt ?? new Date().toISOString()),
    updatedAt:
      unit?.updatedAt instanceof Date
        ? unit.updatedAt.toISOString()
        : (unit?.updatedAt ?? new Date().toISOString()),
  };
}

export async function syncSingleEntity(client: SearchClient, unitId: string) {
  const entity = await prisma.entity.findUnique({
    where: { unitId },
    include: entityIncludeForSync,
  });

  if (!entity) {
    await client.deleteEntities([unitId]);
    return;
  }

  const doc = buildEntityDocument(entity);
  await client.addOrUpdateEntities([doc]);
}

export async function syncAllEntities(client: SearchClient) {
  const deleteResult = await client.deleteAllEntities();
  console.log("syncAllEntities: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllEntities: cursor", cursor, "total", total);

    const entities: any[] = await prisma.entity.findMany({
      include: entityIncludeForSync,
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (entities.length === 0) break;

    const docs = entities.map(buildEntityDocument);
    const addResult = await client.addOrUpdateEntities(docs);
    console.log("syncAllEntities: added batch", addResult);

    total += docs.length;
    cursor = entities[entities.length - 1]!.unitId;
  }

  return { message: "syncAllEntities success", totalSynced: total };
}

// ANCHOR: Users sync

export async function syncAllUsers(client: SearchClient) {
  const deleteResult = await client.deleteAllUsers();
  console.log("syncAllUsers: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllUsers: cursor", cursor, "total", total);

    const users: any[] = await prisma.user.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
      orderBy: { unitId: "asc" },
    });

    if (users.length === 0) break;

    // Slug now lives on the USER Unit. Batch-fetch.
    const unitSlugs = await prisma.unit.findMany({
      where: { id: { in: users.map((u) => u.unitId) } },
      select: { id: true, slug: true },
    });
    const slugById = new Map(unitSlugs.map((u) => [u.id, u.slug ?? null]));

    const formatted: UserSearchDocument[] = users.map((u) => ({
      id: u.unitId,
      unitId: u.unitId,
      name: u.name,
      email: u.email,
      slug: slugById.get(u.unitId) ?? null,
      avatar: u.avatar,
      bio: u.bio,
      description: u.description,
      followersCount: u.followersCount,
      followingsCount: u.followingsCount,
      joinDate:
        u.joinDate instanceof Date
          ? u.joinDate.toISOString()
          : (u.joinDate ?? null),
      permission: (u.permission ?? null) as any,
    }));

    const addResult = await client.addOrUpdateUsers(formatted);
    console.log("syncAllUsers: added batch", addResult);

    total += formatted.length;
    cursor = users[users.length - 1]!.unitId;
  }

  return { message: "syncAllUsers success", totalSynced: total };
}
