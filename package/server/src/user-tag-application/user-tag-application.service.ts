import type {
  ReorderUserTagApplicationInput,
  SetUserTagApplicationsInput,
  UserSettings,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { generateBetween } from "@/shelf/fractional-index";
import { applyUserUnitCollectionMetadata } from "@/shelf/user-unit-collection.service";
import type { UserTagApplicationRow } from "./user-tag-application.types";

type DirectUserTagVisibilityInput = {
  ownerUserId: string;
  viewerUserId?: string | null;
  settings?: UserSettings | null;
  isFollower?: boolean;
};

export function canViewDirectUserTags({
  ownerUserId,
  viewerUserId,
  settings,
  isFollower = false,
}: DirectUserTagVisibilityInput): boolean {
  if (viewerUserId === ownerUserId) return true;

  const visibility = settings?.privacy?.userTags ?? "private";
  if (visibility === "public") return true;
  if (visibility === "followers") return Boolean(viewerUserId && isFollower);
  return false;
}

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

  async listForUserUnit(
    ownerUserId: string,
    unitId: string,
    viewerUserId?: string | null,
  ): Promise<UserTagApplicationRow[]> {
    const owner = await prisma.user.findUnique({
      where: { unitId: ownerUserId },
      select: { settings: true },
    });
    if (!owner) return [];

    const isFollower =
      viewerUserId && viewerUserId !== ownerUserId
        ? Boolean(
            await prisma.subscription.findUnique({
              where: {
                subscriberUnitId_subscribedUnitId: {
                  subscriberUnitId: viewerUserId,
                  subscribedUnitId: ownerUserId,
                },
              },
              select: { id: true },
            }),
          )
        : false;

    if (
      !canViewDirectUserTags({
        ownerUserId,
        viewerUserId,
        settings: owner.settings as UserSettings | null,
        isFollower,
      })
    ) {
      return [];
    }

    return this.listForUnit(ownerUserId, unitId);
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
