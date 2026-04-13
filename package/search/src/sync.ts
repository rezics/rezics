import type {
  ContentSearchDocument,
  FeedbackSearchDocument,
  UserSearchDocument,
} from "@rezics/contract";
import { prisma, UnitType } from "@rezics/server";
import type { SearchClient } from "./client";

const BATCH_SIZE = 5000;

const INDEXABLE_TYPES = [
  UnitType.BOOK,
  UnitType.GAME,
  UnitType.MEDIA,
  UnitType.SHELF,
  UnitType.LINK,
];

const contentInclude = {
  translations: true,
  unitTags: {
    include: {
      tag: { include: { translations: true } },
    },
    orderBy: { score: "desc" as const },
  },
  inRealms: true,
  realmTagAsUnit: true,
  personCredits: {
    include: { person: true },
    orderBy: { sortOrder: "asc" as const },
  },
  organizationCredits: {
    include: { organization: true },
    orderBy: { sortOrder: "asc" as const },
  },
  book: true,
  game: { include: { platforms: true } },
  media: true,
  shelf: true,
  link: true,
} as const;

/**
 * Build a ContentSearchDocument from a Prisma unit with all relations included.
 */
export function buildContentDocument(unit: any): ContentSearchDocument {
  const translations: any[] = unit.translations ?? [];
  const unitTags: any[] = unit.unitTags ?? [];
  const inRealms: any[] = unit.inRealms ?? [];
  const realmTagAsUnit: any[] = unit.realmTagAsUnit ?? [];
  const personCredits: any[] = unit.personCredits ?? [];
  const organizationCredits: any[] = unit.organizationCredits ?? [];

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
  const realmTagKeys = realmTagAsUnit.map(
    (rt: any) => `${rt.realmUnitId}:${rt.tagUnitId}`,
  );

  // Attribution
  const creditNames = [
    ...personCredits.map((c: any) => c.person?.name).filter(Boolean),
    ...organizationCredits
      .map((c: any) => c.organization?.name)
      .filter(Boolean),
  ];

  // Type extension fields
  const ext = unit.book ?? unit.game ?? unit.media ?? null;
  const isLicensed = ext?.isLicensed ?? false;
  const coverUrl = ext?.coverUrl ?? null;

  // Link-specific fields
  const linkUrl = unit.link?.url ?? null;
  const linkSiteName = unit.link?.siteName ?? null;

  return {
    id: unit.id,
    type: unit.type,
    titles,
    subtitles,
    summaries,
    descriptions,
    creditNames,
    tagLabels,
    tagIds,
    tagScores,
    realmIds,
    realmTagKeys,
    languages,
    nsfw: unit.nsfw ?? false,
    visibility: unit.visibility ?? "PUBLIC",
    isLicensed,
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

// ANCHOR: Incremental single-unit sync

export async function syncSingleContent(
  client: SearchClient,
  unitId: string,
) {
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

    const formatted: UserSearchDocument[] = users.map((u) => ({
      id: u.unitId,
      unitId: u.unitId,
      name: u.name,
      email: u.email,
      slug: u.slug,
      avatar: u.avatar,
      bio: u.bio,
      description: u.description,
      followersCount: u.followersCount,
      followingsCount: u.followingsCount,
      joinDate: u.joinDate,
      permission: (u.permission ?? null) as any,
    }));

    const addResult = await client.addOrUpdateUsers(formatted);
    console.log("syncAllUsers: added batch", addResult);

    total += formatted.length;
    cursor = users[users.length - 1]!.unitId;
  }

  return { message: "syncAllUsers success", totalSynced: total };
}
