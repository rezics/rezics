import type { UnitSearchDocument } from "@rezics/contract";
import { prisma, UnitType } from "#/prisma/client";
import { searchClient } from "../search-client";

// TODO(search-redesign): replaced by unified content index

/**
 * Sync a single unit (by its id) into the Meilisearch `units` index.
 * Updated for new schema: UnitTranslation for title/content, UnitTag for tags.
 */
export async function syncUnitToMeili(unitId: string): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
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

  if (!unit) return;

  // Resolve title/content from UnitTranslation
  const titleTranslation = unit.translations?.find(
    (t) => t.title,
  );
  const contentTranslation = unit.translations?.find(
    (t) => t.description,
  );

  // Resolve tags from UnitTag -> tag.translations
  const tags: string[] = (unit.unitTags ?? [])
    .map(
      (ut: any) =>
        ut.tag?.translations?.find((t: any) => t.title)?.title ?? "",
    )
    .filter(Boolean);

  const doc: UnitSearchDocument = {
    id: unit.id,
    // search fields
    title: titleTranslation?.title ?? "",
    content: contentTranslation?.description ?? "",
    tags,
    type: unit.type ?? "",
    status: unit.status ?? "",
    userId: unit.userId ?? "",
    domainIds: [], // TODO(search-redesign): domains removed, use realm membership
    targetUnitId: unit.workUnitId,
    hasTarget: unit.workUnitId !== null,
    nsfw: unit.nsfw,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    // result fields
    unitId: unit.id,
    user: unit.user,
    metadata: unit.extra,
    tagObjects: (unit.unitTags ?? []).map((ut: any) => ({
      unitId: ut.tagUnitId,
      label: ut.tag?.translations?.find((t: any) => t.title)?.title ?? "",
      score: ut.score,
    })),
    reactionSummaries: unit.reactionSummaries,
  };

  if (unit.type === UnitType.POST) {
    const targetId = unit.workUnitId;
    if (targetId) {
      const targetUnit = await prisma.unit.findUnique({
        where: { id: targetId },
        include: { translations: true },
      });
      if (targetUnit) {
        const bookTitle =
          targetUnit.translations?.find((t) => t.title)?.title ?? "";
        doc.metadata = doc.metadata ?? {};
        (doc.metadata as any).book = { title: bookTitle, coverUrl: null };
      }
    }
  }

  await searchClient.unitIndex.addDocuments([doc]);
}

/**
 * Remove a single unit (by its id) from the Meilisearch `units` index.
 */
export async function deleteUnitFromMeili(unitId: string): Promise<void> {
  await searchClient.unitIndex.deleteDocuments([unitId]);
}
