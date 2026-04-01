import {prisma} from '@package/server';
import {UnitType} from '@package/server';
import type {SearchClient} from './client';
import type {
  BookSearchDocument,
  UnitSearchDocument,
  FeedbackSearchDocument,
  UserSearchDocument,
} from '@package/contract';

// ANCHOR: Books sync with batching (cursor-based)
export async function syncAllBooks(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllBooks();
  console.log('sync all books, deleteResult', deleteResult);

  let cursor: string | undefined = undefined;
  let total = 0;

  while (true) {
    console.log('sync all books, cursor', cursor, 'total', total);

    const books: any[] = await prisma.book.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {unitId: cursor} : undefined,
      orderBy: {unitId: 'asc'},
      include: {
        author: true,
        press: true,
        producer: true,
        unit: {
          include: {
            tags: true,
          },
        },
      },
    });

    if (books.length === 0) break;

    const formatted: BookSearchDocument[] = books.map(b => {
      const tagSearch: string[] = [
        ...(Array.isArray(b.tags) ? b.tags : []),
        ...(b.unit?.tags?.map((t: any) => t.name) ?? []),
      ];

      const base: BookSearchDocument = {
        id: b.unitId,
        title: b.title,
        description: b.description ?? null,
        coverUrl: b.coverUrl ?? null,
        isbn: b.isbn ?? null,
        tagSearch,
        authors: b.author?.map((a: any) => a.name) ?? [],
        presses: b.press?.map((p: any) => p.name) ?? [],
        producers: b.producer?.map((p: any) => p.name) ?? [],
        nsfw: b.unit?.nsfw ?? false,
        isLicensed: b.isLicensed ?? false,
        authorIds: b.author?.map((a: any) => a.unitId) ?? [],
        pressIds: b.press?.map((p: any) => p.unitId) ?? [],
        producerIds: b.producer?.map((p: any) => p.unitId) ?? [],
        textLength: Number(b.textLength) ?? 0,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        extra: b.extra ?? null,
        metadata: b.unit?.metadata ?? null,
        unitId: b.unitId,
        author: b.author,
        press: b.press,
        producer: b.producer,
        tags: b.unit?.tags ?? [],
      };

      return base;
    });

    const addResult = await client.addOrUpdateBooks(formatted);
    console.log('sync all books, addResult', addResult);

    total += formatted.length;
    cursor = books[books.length - 1]!.unitId;
  }

  return {
    message: 'sync all books success',
    totalSynced: total,
  };
}

// ANCHOR: Units sync with batching
export async function syncAllUnits(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllUnits();
  console.log('sync all units, deleteResult', deleteResult);

  let cursor: string | undefined = undefined;
  let total = 0;

  while (true) {
    console.log('sync all units, cursor', cursor, 'total', total);
    const units: any = await prisma.unit.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {id: cursor} : undefined,
      orderBy: {id: 'asc'},
      include: {
        user: true,
        tags: true,
        reactionSummaries: true,
        domains: {
          select: {id: true},
        },
      },
    });

    if (units.length === 0) break;

    let formatted: UnitSearchDocument[] = units.map((u: any) => ({
      id: u.id,
      title: u.title ?? '',
      content: u.content ?? '',
      tags: u.tags ? u.tags.map((t: any) => t.name) : [],
      type: u.type ?? '',
      status: u.status ?? '',
      userId: u.userId ?? '',
      domainIds: u.domains ? u.domains.map((d: any) => d.id) : [],
      targetUnitId: u.targetUnitId,
      hasTarget: u.targetUnitId !== null,
      nsfw: u.nsfw,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      unitId: u.id,
      user: u.user,
      metadata: u.metadata,
      tagObjects: u.tags,
      reactionSummaries: u.reactionSummaries,
    }));

    formatted = await Promise.all(
      formatted.map(async (u: any) => {
        if (u.type === UnitType.REVIEW || u.type === UnitType.REMARK) {
          const bookId = u.targetUnitId;
          if (bookId) {
            const book = await prisma.book.findUnique({
              where: {unitId: bookId},
            });
            if (book) {
              u.metadata.book = {title: book.title, coverUrl: book.coverUrl};
            }
          }
        }
        return u;
      }),
    );

    const addResult = await client.addOrUpdateUnits(formatted);
    console.log('sync all units, addResult', addResult);

    total += formatted.length;
    cursor = units[units.length - 1].id;
  }

  return {
    message: 'sync all units success',
    totalSynced: total,
  };
}

// ANCHOR: Readlists sync with batching (cursor-based)
export async function syncAllReadlists(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllReadlists();
  console.log('sync all readlists, deleteResult', deleteResult);

  let cursor: string | undefined = undefined;
  let total = 0;

  while (true) {
    console.log('sync all readlists, cursor', cursor, 'total', total);

    const readlists: any[] = await prisma.readList.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {unitId: cursor} : undefined,
      orderBy: {unitId: 'asc'},
      include: {
        unit: {
          include: {
            user: true,
            tags: true,
            reactionSummaries: true,
            domains: {
              select: {id: true},
            },
          },
        },
        book: true,
        review: true,
      },
    });

    if (readlists.length === 0) break;

    const formatted = readlists.map(rl => {
      const unit = rl.unit;
      const metadata = unit?.metadata ?? {};

      const bookIds: string[] = Array.isArray(rl.book)
        ? rl.book.map((b: any) => b.unitId)
        : [];
      const reviewIds: string[] = Array.isArray(rl.review)
        ? rl.review.map((r: any) => r.id)
        : [];

      const tags: string[] = unit?.tags
        ? unit.tags.map((t: any) => t.name)
        : [];

      const doc: any = {
        id: rl.unitId,
        title: unit?.title ?? '',
        content: unit?.content ?? '',
        tags,
        nsfw: unit?.nsfw ?? false,
        userId: unit?.userId ?? '',
        type: unit?.type ?? 'READLIST',
        status: unit?.status ?? '',
        domainIds: unit?.domains ? unit.domains.map((d: any) => d.id) : [],
        targetUnitId: unit?.targetUnitId ?? null,
        bookIds,
        reviewIds,
        coverUrl: (metadata as any)?.coverUrl ?? null,
        createdAt: unit?.createdAt ?? rl.createdAt,
        updatedAt: unit?.updatedAt ?? rl.updatedAt,
        unitId: rl.unitId,
        user: unit?.user ?? null,
        metadata,
        tagObjects: unit?.tags ?? [],
        reactionSummaries: unit?.reactionSummaries ?? [],
      };

      return doc;
    });

    const addResult = await client.addOrUpdateReadlists(formatted);
    console.log('sync all readlists, addResult', addResult);

    total += formatted.length;
    cursor = readlists[readlists.length - 1]!.unitId;
  }

  return {
    message: 'sync all readlists success',
    totalSynced: total,
  };
}

// ANCHOR: Feedbacks sync with batching (cursor-based)
export async function syncAllFeedbacks(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllFeedbacks();
  console.log('sync all feedbacks, deleteResult', deleteResult);

  let cursor: string | undefined = undefined;
  let total = 0;

  while (true) {
    console.log('sync all feedbacks, cursor', cursor, 'total', total);

    const feedbacks: any[] = await prisma.feedback.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {id: cursor} : undefined,
      orderBy: {id: 'asc'},
    });

    if (feedbacks.length === 0) break;

    const formatted: FeedbackSearchDocument[] = feedbacks.map(f => {
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
    console.log('sync all feedbacks, addResult', addResult);

    total += formatted.length;
    cursor = feedbacks[feedbacks.length - 1]!.id;
  }

  return {
    message: 'sync all feedbacks success',
    totalSynced: total,
  };
}

// ANCHOR: Users sync with batching (cursor-based)
export async function syncAllUsers(client: SearchClient) {
  const BATCH_SIZE = 5000;

  const deleteResult = await client.deleteAllUsers();
  console.log('sync all users, deleteResult', deleteResult);

  let cursor: string | undefined = undefined;
  let total = 0;

  while (true) {
    console.log('sync all users, cursor', cursor, 'total', total);

    const users: any[] = await prisma.user.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {unitId: cursor} : undefined,
      orderBy: {unitId: 'asc'},
    });

    if (users.length === 0) break;

    const formatted: UserSearchDocument[] = users.map(u => ({
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
    console.log('sync all users, addResult', addResult);

    total += formatted.length;
    cursor = users[users.length - 1]!.unitId;
  }

  return {
    message: 'sync all users success',
    totalSynced: total,
  };
}
