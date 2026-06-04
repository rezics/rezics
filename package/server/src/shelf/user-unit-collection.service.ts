import type { PatchUserUnitCollectionInput } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { serverJobProducer } from "@/job/job-boundary";

type CollectionMetadataPatch = Pick<
  PatchUserUnitCollectionInput,
  "tagUnitIds" | "searchText"
>;

type CollectionMetadataTx = {
  userUnitCollection: {
    upsert(input: {
      where: { userId_unitId: { userId: string; unitId: string } };
      create: { userId: string; unitId: string; searchText: string | null };
      update: { searchText: string | null };
    }): Promise<unknown>;
  };
  userTagApplication: {
    deleteMany(input: {
      where: { userId: string; unitId: string };
    }): Promise<unknown>;
    createMany(input: {
      data: Array<{
        userId: string;
        unitId: string;
        tagUnitId: string;
        position: string;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
};

/**
 * Applies shared per-user/per-unit collection metadata. ShelfUnit remains the
 * only containment source; these rows only enrich Units already selected by a
 * shelf/collection read path.
 */
export async function applyUserUnitCollectionMetadata(
  tx: CollectionMetadataTx,
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

export function enqueueUserUnitCollectionSearchSync(
  userId: string,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.collectionSync,
      { userId, unitId },
      { type: "server", service: "user-unit-collection" },
    ),
  );
}
