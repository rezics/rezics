import {prisma} from '@/prisma/client';
import {readlistIndex} from '@package/search';
import type {ReadlistSearchDocument} from './index';

/**
 * Sync a single readlist (by its unitId) into the Meilisearch `readlists` index.
 */
export async function syncReadlistToMeili(unitId: string): Promise<void> {
  const readlist = await prisma.readList.findUnique({
    where: {unitId},
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

  if (!readlist || !readlist.unit) return;

  const unit = readlist.unit;
  const metadata = (unit.metadata ?? {}) as any;

  const bookIds: string[] = Array.isArray(readlist.book)
    ? readlist.book.map((b: any) => b.unitId)
    : [];

  const reviewIds: string[] = Array.isArray(readlist.review)
    ? readlist.review.map((r: any) => r.id)
    : [];

  const tags: string[] = unit.tags ? unit.tags.map((t: any) => t.name) : [];

  const doc: ReadlistSearchDocument = {
    id: readlist.unitId,
    // search fields
    title: unit.title ?? '',
    content: unit.content ?? '',
    tags,
    nsfw: unit.nsfw ?? false,
    userId: unit.userId ?? '',
    type: unit.type ?? 'READLIST',
    status: unit.status ?? '',
    domainIds: unit.domains ? unit.domains.map((d: any) => d.id) : [],
    targetUnitId: unit.targetUnitId ?? null,
    // filters
    bookIds,
    reviewIds,
    // visual
    coverUrl: metadata?.coverUrl ?? null,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    // result fields
    unitId: readlist.unitId,
    user: unit.user,
    metadata,
    tagObjects: unit.tags,
    reactionSummaries: unit.reactionSummaries,
  };

  await readlistIndex.addDocuments([doc]);
}

/**
 * Remove a single readlist (by its unitId) from the Meilisearch `readlists` index.
 */
export async function deleteReadlistFromMeili(unitId: string): Promise<void> {
  await readlistIndex.deleteDocuments([unitId]);
}
