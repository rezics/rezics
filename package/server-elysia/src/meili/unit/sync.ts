import {prisma} from '@/prisma/client';
import {unitIndex} from '@package/search/src/meili_index';
import type {UnitSearchDocument} from './index';

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

  const doc: UnitSearchDocument = {
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

  await unitIndex.addDocuments([doc]);
}

export async function deleteUnitFromMeili(unitId: string): Promise<void> {
  await unitIndex.deleteDocuments([unitId]);
}
