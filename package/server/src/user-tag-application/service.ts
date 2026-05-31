import type {
  ReorderUserTagApplicationInput,
  SetUserTagApplicationsInput,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { generateBetween } from "@/shelf/fractional-index";
import { applyUserUnitCollectionMetadata } from "@/shelf/user-unit-collection.service";
import type { UserTagApplicationRow } from "./types";

export class UserTagApplicationService {
  async listForUnit(
    userId: string,
    unitId: string,
  ): Promise<UserTagApplicationRow[]> {
    return prisma.userTagApplication.findMany({
      where: { userId, unitId },
      orderBy: [{ position: "asc" }, { tagUnitId: "asc" }],
    });
  }

  async setForUnit(
    userId: string,
    input: SetUserTagApplicationsInput,
  ): Promise<UserTagApplicationRow[]> {
    await prisma.$transaction((tx) =>
      applyUserUnitCollectionMetadata(tx, userId, input.unitId, {
        tagUnitIds: input.tagUnitIds,
      }),
    );
    return this.listForUnit(userId, input.unitId);
  }

  async reorder(
    userId: string,
    input: ReorderUserTagApplicationInput,
  ): Promise<UserTagApplicationRow> {
    const [before, after] = await Promise.all([
      input.beforeTagUnitId
        ? prisma.userTagApplication.findUnique({
            where: {
              userId_unitId_tagUnitId: {
                userId,
                unitId: input.unitId,
                tagUnitId: input.beforeTagUnitId,
              },
            },
            select: { position: true },
          })
        : Promise.resolve(null),
      input.afterTagUnitId
        ? prisma.userTagApplication.findUnique({
            where: {
              userId_unitId_tagUnitId: {
                userId,
                unitId: input.unitId,
                tagUnitId: input.afterTagUnitId,
              },
            },
            select: { position: true },
          })
        : Promise.resolve(null),
    ]);

    const position = generateBetween(before?.position, after?.position);
    return prisma.userTagApplication.update({
      where: {
        userId_unitId_tagUnitId: {
          userId,
          unitId: input.unitId,
          tagUnitId: input.tagUnitId,
        },
      },
      data: { position },
    });
  }

  async deleteOne(
    userId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void> {
    await prisma.userTagApplication.deleteMany({
      where: { userId, unitId, tagUnitId },
    });
  }
}

export const userTagApplicationService = new UserTagApplicationService();
