import type { PatchUserUnitCollectionInput } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";

type CollectionMetadataPatch = Pick<
  PatchUserUnitCollectionInput,
  "tagUnitIds" | "searchText"
>;

/**
 * Applies shared per-user/per-unit collection metadata. ShelfUnit remains the
 * only containment source; these rows only enrich Units already selected by a
 * shelf/collection read path.
 */
export async function applyUserUnitCollectionMetadata(
  tx: Prisma.TransactionClient,
  userId: string,
  unitId: string,
  patch: CollectionMetadataPatch,
): Promise<void> {
  if (patch.searchText !== undefined) {
    await tx.userUnitCollection.upsert({
      where: { userId_unitId: { userId, unitId } },
      create: { userId, unitId, searchText: patch.searchText },
      update: { searchText: patch.searchText },
    });
  }

  if (patch.tagUnitIds !== undefined) {
    await tx.userTagApplication.deleteMany({
      where: { userId, unitId },
    });

    const tagUnitIds = Array.from(
      new Set(patch.tagUnitIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (tagUnitIds.length > 0) {
      await tx.userTagApplication.createMany({
        data: tagUnitIds.map((tagUnitId, index) => ({
          userId,
          unitId,
          tagUnitId,
          position: String(index).padStart(8, "0"),
        })),
        skipDuplicates: true,
      });
    }
  }
}
