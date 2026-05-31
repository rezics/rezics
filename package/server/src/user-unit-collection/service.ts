import type { PatchUserUnitCollectionInput } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import {
  applyUserUnitCollectionMetadata,
  enqueueUserUnitCollectionSearchSync,
} from "@/shelf/user-unit-collection.service";
import type { UserUnitCollectionRow } from "./types";

export class UserUnitCollectionService {
  async get(
    userId: string,
    unitId: string,
  ): Promise<UserUnitCollectionRow | null> {
    return prisma.userUnitCollection.findUnique({
      where: { userId_unitId: { userId, unitId } },
    });
  }

  async patch(
    userId: string,
    input: PatchUserUnitCollectionInput,
  ): Promise<UserUnitCollectionRow | null> {
    await prisma.$transaction((tx) =>
      applyUserUnitCollectionMetadata(tx, userId, input.unitId, {
        tagUnitIds: input.tagUnitIds,
        searchText: input.searchText,
      }),
    );

    if (input.searchText !== undefined) {
      await enqueueUserUnitCollectionSearchSync(userId, input.unitId);
    }

    return this.get(userId, input.unitId);
  }
}

export const userUnitCollectionService = new UserUnitCollectionService();
