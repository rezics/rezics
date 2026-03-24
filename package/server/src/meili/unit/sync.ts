import {prisma} from '#/prisma/client';
import {unitIndex} from '@package/search';
import type {UnitSearchDocument} from '@package/contract';
import {UnitType} from '#/prisma/client';

export async function syncUnitToMeili(unitId: string): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: {id: unitId},
    include: {
      user: true,
      tags: true,
      reactionSummaries: true,
      domains: {
        select: {id: true},
      },
    },
  });

  if (!unit) return;

  let doc: UnitSearchDocument = {
    id: unit.id,
    // search fields
    title: unit.title ?? '',
    content: unit.content ?? '',
    tags: unit.tags ? unit.tags.map(t => t.name) : [],
    type: unit.type ?? '',
    status: unit.status ?? '',
    userId: unit.userId ?? '',
    domainIds: unit.domains ? unit.domains.map(d => d.id) : [],
    targetUnitId: unit.targetUnitId,
    hasTarget: unit.targetUnitId !== null,
    nsfw: unit.nsfw,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    // result fields
    unitId: unit.id,
    user: unit.user,
    metadata: unit.metadata,
    tagObjects: unit.tags,
    reactionSummaries: unit.reactionSummaries,
  };

  if (unit.type === UnitType.REVIEW || unit.type === UnitType.REMARK) {
    const bookId = unit.targetUnitId;
    if (bookId) {
      const book = await prisma.book.findUnique({
        where: {unitId: bookId},
      });
      const bookMetadata = book
        ? {
            title: book.title,
            coverUrl: book.coverUrl,
          }
        : null;
      if (bookMetadata) {
        doc.metadata = doc.metadata ?? {};
        doc.metadata.book = bookMetadata;
      }
    }
  }

  await unitIndex.addDocuments([doc]);
}

export async function deleteUnitFromMeili(unitId: string): Promise<void> {
  await unitIndex.deleteDocuments([unitId]);
}
