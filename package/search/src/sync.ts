import {PrismaClient} from '@package/server-elysia/prisma/generated/client';
import {
  addOrUpdateBooks,
  addOrUpdateUnits,
  deleteAllBooks,
  deleteAllUnits,
} from './documents';

const prisma = new PrismaClient();

// TODO 引入 cursor 进行 千万级批量操作

// ANCHOR: Books sync
export async function syncAllBooks() {
  const books = await prisma.book.findMany({
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

  const formatted = books.map(b => ({
    id: b.unitId,
    // search fields
    title: b.title,
    coverUrl: b.coverUrl,
    description: b.description,
    isbn: b.isbn,
    tagSearch: b.unit.tags.map(t => t.name),
    authors: b.author.map(a => a.name),
    presses: b.press.map(p => p.name),
    producers: b.producer.map(p => p.name),
    nsfw: b.unit.nsfw,
    authorIds: b.author.map(a => a.unitId),
    pressIds: b.press.map(p => p.unitId),
    producerIds: b.producer.map(p => p.unitId),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    // result fields
    unitId: b.unitId,
    author: b.author,
    press: b.press,
    producer: b.producer,
    tags: b.unit.tags,
  }));
  const deleteResult = await deleteAllBooks();
  const addResult = await addOrUpdateBooks(formatted);
  const result = {deleteResult, addResult};
  return {message: 'sync all books success', result};
}

// ANCHOR: Units sync with batching
export async function syncAllUnits() {
  const BATCH_SIZE = 5000;

  // Step 1: 清空索引（你自己现有的函数）
  // const deleteResult = await deleteAllUnits();

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
    const formatted = units.map((u: any) => ({
      id: u.id,
      // search fields
      title: u.title ?? '',
      content: u.content ?? '',
      tags: u.tags ? u.tags.map((t: any) => t.name) : [],
      type: u.type ?? '',
      status: u.status ?? '',
      userId: u.userId ?? '',
      domainIds: u.domains ? u.domains.map((d: any) => d.id) : [],
      // targetUnitId: u.targetUnitId,
      // hasTarget: u.targetUnitId !== null,
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

// ANCHOR: Units sync
export async function syncAllUnitsOld() {
  const units = await prisma.unit.findMany({
    take: 1000,
    include: {
      user: true,
      tags: true,
      reactionSummaries: true,
      domains: {
        select: {id: true},
      },
    },
  });

  const formatted = units.map(u => ({
    id: u.id,
    // search fields
    title: u.title,
    content: u.content,
    tags: u.tags.map(t => t.name),
    type: u.type,
    status: u.status,
    userId: u.userId,
    domainIds: u.domains.map(d => d.id),
    targetUnitId: u.targetUnitId,
    hasTarget: u.targetUnitId !== null,
    nsfw: u.nsfw,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    publishedAt: u.publishedAt,
    // result fields
    unitId: u.id,
    user: u.user,
    metadata: u.metadata,
    tagObjects: u.tags,
    reactionSummaries: u.reactionSummaries,
  }));

  const deleteResult = await deleteAllUnits();
  const addResult = await addOrUpdateUnits(formatted);
  const result = {deleteResult, addResult};
  return {message: 'sync all units success', result};
}
