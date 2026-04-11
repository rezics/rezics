import type {
  BookSearchDocument,
  FeedbackSearchDocument,
  UnitSearchDocument,
  UserSearchDocument,
} from "@rezics/contract";
import { prisma, UnitType } from "@rezics/server";
import type { SearchClient } from "./client";

// TODO(search-redesign): replaced by unified content index

// ANCHOR: Books sync with batching (cursor-based)
// Updated for new schema: UnitTranslation for title, PersonCredit/OrgCredit for names, UnitTag for tags
export async function syncAllBooks(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllBooks();
  console.log("sync all books, deleteResult", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("sync all books, cursor", cursor, "total", total);

    const books: any[] = await prisma.book.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
      orderBy: { unitId: "asc" },
      include: {
        unit: {
          include: {
            translations: true,
            personCredits: {
              include: { person: true },
              orderBy: { sortOrder: "asc" },
            },
            organizationCredits: {
              include: { organization: true },
              orderBy: { sortOrder: "asc" },
            },
            unitTags: {
              include: {
                tag: { include: { translations: true } },
              },
              orderBy: { score: "desc" },
            },
          },
        },
      },
    });

    if (books.length === 0) break;

    const formatted: BookSearchDocument[] = books.map((b) => {
      const unit = b.unit;
      // Resolve title from UnitTranslation (first available)
      const titleTranslation = unit?.translations?.find(
        (t: any) => t.title,
      );
      const descTranslation = unit?.translations?.find(
        (t: any) => t.description,
      );

      // Resolve tag labels from UnitTag -> tag.translations
      const tagSearch: string[] = (unit?.unitTags ?? []).map(
        (ut: any) =>
          ut.tag?.translations?.find((t: any) => t.title)?.title ?? "",
      ).filter(Boolean);

      // Resolve author/press/producer from PersonCredit/OrgCredit
      const authorCredits = (unit?.personCredits ?? []).filter(
        (c: any) => c.roleKey === "author",
      );
      const pressCredits = (unit?.organizationCredits ?? []).filter(
        (c: any) => c.roleKey === "press" || c.roleKey === "publisher",
      );
      const producerCredits = (unit?.personCredits ?? []).filter(
        (c: any) => c.roleKey === "producer",
      );

      const base: BookSearchDocument = {
        id: b.unitId,
        title: titleTranslation?.title ?? "",
        description: descTranslation?.description ?? null,
        coverUrl: null, // TODO(search-redesign): coverAssetUnitId lookup
        isbn: b.isbn13 ?? null,
        tagSearch,
        authors: authorCredits.map((c: any) => c.person?.name ?? ""),
        presses: pressCredits.map((c: any) => c.organization?.name ?? ""),
        producers: producerCredits.map((c: any) => c.person?.name ?? ""),
        nsfw: unit?.nsfw ?? false,
        isLicensed: b.isLicensed ?? false,
        authorIds: authorCredits.map((c: any) => c.personId),
        pressIds: pressCredits.map((c: any) => c.organizationId),
        producerIds: producerCredits.map((c: any) => c.personId),
        textLength: Number(b.textLength) ?? 0,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        extra: b.extra ?? null,
        metadata: unit?.extra ?? null,
        unitId: b.unitId,
        author: authorCredits.map((c: any) => c.person),
        press: pressCredits.map((c: any) => c.organization),
        producer: producerCredits.map((c: any) => c.person),
        tags: (unit?.unitTags ?? []).map((ut: any) => ({
          unitId: ut.tagUnitId,
          label:
            ut.tag?.translations?.find((t: any) => t.title)?.title ?? "",
          score: ut.score,
        })),
      };

      return base;
    });

    const addResult = await client.addOrUpdateBooks(formatted);
    console.log("sync all books, addResult", addResult);

    total += formatted.length;
    cursor = books[books.length - 1]!.unitId;
  }

  return {
    message: "sync all books success",
    totalSynced: total,
  };
}

// ANCHOR: Units sync with batching
// Updated for new schema: UnitTranslation for title/content, UnitTag for tags, removed domainIds
export async function syncAllUnits(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllUnits();
  console.log("sync all units, deleteResult", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  // Types to sync (exclude removed types)
  const syncTypes = [
    UnitType.BOOK,
    UnitType.GAME,
    UnitType.MEDIA,
    UnitType.POST,
    UnitType.SHELF,
    UnitType.REALM,
  ];

  while (true) {
    console.log("sync all units, cursor", cursor, "total", total);
    const units: any[] = await prisma.unit.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      where: { type: { in: syncTypes } },
      include: {
        user: true,
        translations: true,
        reactionSummaries: true,
        unitTags: {
          include: {
            tag: { include: { translations: true } },
          },
          orderBy: { score: "desc" },
        },
      },
    });

    if (units.length === 0) break;

    // Resolve title/content from UnitTranslation
    let formatted: UnitSearchDocument[] = units.map((u: any) => {
      const titleTranslation = u.translations?.find(
        (t: any) => t.title,
      );
      const contentTranslation = u.translations?.find(
        (t: any) => t.description,
      );

      // Resolve tags from UnitTag -> tag.translations
      const tags: string[] = (u.unitTags ?? []).map(
        (ut: any) =>
          ut.tag?.translations?.find((t: any) => t.title)?.title ?? "",
      ).filter(Boolean);

      return {
        id: u.id,
        title: titleTranslation?.title ?? "",
        content: contentTranslation?.description ?? "",
        tags,
        type: u.type ?? "",
        status: u.status ?? "",
        userId: u.userId ?? "",
        domainIds: [], // TODO(search-redesign): domains removed, use realm membership
        targetUnitId: u.workUnitId,
        hasTarget: u.workUnitId !== null,
        nsfw: u.nsfw,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        unitId: u.id,
        user: u.user,
        metadata: u.extra,
        tagObjects: (u.unitTags ?? []).map((ut: any) => ({
          unitId: ut.tagUnitId,
          label:
            ut.tag?.translations?.find((t: any) => t.title)?.title ?? "",
          score: ut.score,
        })),
        reactionSummaries: u.reactionSummaries,
      };
    });

    formatted = await Promise.all(
      formatted.map(async (u: any) => {
        if (u.type === UnitType.POST) {
          const bookId = u.targetUnitId;
          if (bookId) {
            const bookUnit = await prisma.unit.findUnique({
              where: { id: bookId },
              include: { translations: true },
            });
            if (bookUnit) {
              const bookTitle =
                bookUnit.translations?.find((t: any) => t.title)?.title ??
                "";
              u.metadata = u.metadata ?? {};
              u.metadata.book = { title: bookTitle, coverUrl: null };
            }
          }
        }
        return u;
      }),
    );

    const addResult = await client.addOrUpdateUnits(formatted);
    console.log("sync all units, addResult", addResult);

    total += formatted.length;
    cursor = units[units.length - 1].id;
  }

  return {
    message: "sync all units success",
    totalSynced: total,
  };
}

// TODO(search-redesign): replaced by unified content index
// Readlist sync is now a no-op. Readlists are indexed as shelf units.
export async function syncAllReadlists(client: SearchClient) {
  console.warn(
    "[DEPRECATED] syncAllReadlists is a no-op. Readlists are now shelves indexed via syncAllUnits.",
  );
  return {
    message: "syncAllReadlists deprecated (no-op)",
    totalSynced: 0,
  };
}

// ANCHOR: Feedbacks sync with batching (cursor-based)
export async function syncAllFeedbacks(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllFeedbacks();
  console.log("sync all feedbacks, deleteResult", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("sync all feedbacks, cursor", cursor, "total", total);

    const feedbacks: any[] = await prisma.feedback.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (feedbacks.length === 0) break;

    const formatted: FeedbackSearchDocument[] = feedbacks.map((f) => {
      const doc: FeedbackSearchDocument = {
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
      };

      return doc;
    });

    const addResult = await client.addOrUpdateFeedbacks(formatted);
    console.log("sync all feedbacks, addResult", addResult);

    total += formatted.length;
    cursor = feedbacks[feedbacks.length - 1]!.id;
  }

  return {
    message: "sync all feedbacks success",
    totalSynced: total,
  };
}

// ANCHOR: Users sync with batching (cursor-based)
export async function syncAllUsers(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllUsers();
  console.log("sync all users, deleteResult", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("sync all users, cursor", cursor, "total", total);

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
      type: u.type,
      avatar: u.avatar,
      bio: u.bio,
      description: u.description,
      followersCount: u.followersCount,
      followingsCount: u.followingsCount,
      joinDate: u.joinDate,
      permission: (u.permission ?? null) as any,
    }));

    const addResult = await client.addOrUpdateUsers(formatted);
    console.log("sync all users, addResult", addResult);

    total += formatted.length;
    cursor = users[users.length - 1]!.unitId;
  }

  return {
    message: "sync all users success",
    totalSynced: total,
  };
}
