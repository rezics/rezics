import {PrismaClient} from '@package/server-elysia/prisma/generated/client';
import {
  addOrUpdateBooks,
  addOrUpdateUnits,
  addOrUpdateReadlists,
  deleteAllBooks,
  deleteAllUnits,
  deleteAllReadlists,
} from './documents';
import type {
  BookSearchDocument,
  UnitSearchDocument,
} from '@package/contract/src/meili';

const prisma = new PrismaClient();

// ANCHOR: Books sync with batching (cursor-based)
export async function syncAllBooks() {
  const BATCH_SIZE = 5000;

  // Step 1: 清空索引
  const deleteResult = await deleteAllBooks();
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
      // 合并 Book.tags 与 Unit.tags 作为 tagSearch
      const tagSearch: string[] = [
        ...(Array.isArray(b.tags) ? b.tags : []),
        ...(b.unit?.tags?.map((t: any) => t.name) ?? []),
      ];

      const base: BookSearchDocument = {
        id: b.unitId,
        // search fields
        title: b.title,
        description: b.description ?? null,
        tagSearch,
        authors: b.author?.map((a: any) => a.name) ?? [],
        presses: b.press?.map((p: any) => p.name) ?? [],
        producers: b.producer?.map((p: any) => p.name) ?? [],
        nsfw: b.unit?.nsfw ?? false,
        authorIds: b.author?.map((a: any) => a.unitId) ?? [],
        pressIds: b.press?.map((p: any) => p.unitId) ?? [],
        producerIds: b.producer?.map((p: any) => p.unitId) ?? [],
        textLength: Number(b.textLength) ?? 0,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        // result fields
        unitId: b.unitId,
        author: b.author,
        press: b.press,
        producer: b.producer,
        tags: b.unit?.tags ?? [],
      };

      // 保持兼容：如果下游索引里有 coverUrl / isbn 字段，则一并写入
      return {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - allow extra fields for Meili payload
        coverUrl: b.coverUrl,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - allow extra fields for Meili payload
        isbn: b.isbn,
        ...base,
      } as BookSearchDocument;
    });

    const addResult = await addOrUpdateBooks(formatted);
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
export async function syncAllUnits() {
  const BATCH_SIZE = 5000;

  // Step 1: 清空索引（你自己现有的函数）
  const deleteResult = await deleteAllUnits();
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

    // Format batch
    const formatted: UnitSearchDocument[] = units.map((u: any) => ({
      id: u.id,
      // search fields
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
      // result fields
      unitId: u.id,
      user: u.user,
      metadata: u.metadata,
      tagObjects: u.tags,
      reactionSummaries: u.reactionSummaries,
    }));

    // Push this batch to Meilisearch
    const addResult = await addOrUpdateUnits(formatted);
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
export async function syncAllReadlists() {
  const BATCH_SIZE = 5000;

  // Step 1: 清空索引
  const deleteResult = await deleteAllReadlists();
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
        // search fields
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
        // optional visual field from metadata
        coverUrl: (metadata as any)?.coverUrl ?? null,
        createdAt: unit?.createdAt ?? rl.createdAt,
        updatedAt: unit?.updatedAt ?? rl.updatedAt,
        // result / denormalized fields
        unitId: rl.unitId,
        user: unit?.user ?? null,
        metadata,
        tagObjects: unit?.tags ?? [],
        reactionSummaries: unit?.reactionSummaries ?? [],
      };

      return doc;
    });

    const addResult = await addOrUpdateReadlists(formatted);
    console.log('sync all readlists, addResult', addResult);

    total += formatted.length;
    cursor = readlists[readlists.length - 1]!.unitId;
  }

  return {
    message: 'sync all readlists success',
    totalSynced: total,
  };
}
