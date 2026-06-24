import type { PatchUserShelfItemMetadataInput } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { serverJobProducer } from "@/job/job-boundary";

type UserShelfItemMetadataPatch = Pick<
  PatchUserShelfItemMetadataInput,
  "tagUnitIds" | "searchText"
>;

type UserShelfItemMetadataTx = {
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
 * Applies shared per-user/per-unit tag metadata. ShelfItem remains the only
 * containment and private note source for shelf item aggregate reads.
 */
export async function applyUserShelfItemMetadata(
  tx: UserShelfItemMetadataTx,
  userId: string,
  unitId: string,
  patch: UserShelfItemMetadataPatch,
): Promise<void> {
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

export function enqueueShelfItemSourceSearchSync(
  itemType: string,
  itemId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.shelfItemSourceFanout,
      { itemType, itemId },
      { type: "server", service: "shelf-item" },
    ),
  );
}
