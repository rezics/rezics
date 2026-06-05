import type {
  ReorderUserTagApplicationInput,
  SetUserTagApplicationsInput,
  UserSettings,
} from "@rezics/contract";
import { and, asc, eq } from "drizzle-orm";
import { Subscription, User, UserTagApplication } from "../db/schema";
import { generateBetween } from "../shelf/fractional-index";
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

export interface UserTagApplicationRepository {
  listForUnit(userId: string, unitId: string): Promise<UserTagApplicationRow[]>;
  getOwnerSettings(
    ownerUserId: string,
  ): Promise<UserSettings | null | undefined>;
  isFollower(viewerUserId: string, ownerUserId: string): Promise<boolean>;
  replaceTagsForUnit(
    userId: string,
    unitId: string,
    tagUnitIds: readonly string[],
  ): Promise<void>;
  getTagPosition(
    userId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<string | null>;
  updatePosition(
    userId: string,
    unitId: string,
    tagUnitId: string,
    position: string,
  ): Promise<UserTagApplicationRow>;
  deleteOne(userId: string, unitId: string, tagUnitId: string): Promise<void>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleUserTagApplicationRepository(): UserTagApplicationRepository {
  return {
    async listForUnit(userId, unitId) {
      const db = await getServerDb();
      return db
        .select()
        .from(UserTagApplication)
        .where(
          and(
            eq(UserTagApplication.userId, userId),
            eq(UserTagApplication.unitId, unitId),
          ),
        )
        .orderBy(
          asc(UserTagApplication.position),
          asc(UserTagApplication.tagUnitId),
        );
    },

    async getOwnerSettings(ownerUserId) {
      const db = await getServerDb();
      const [owner] = await db
        .select({ settings: User.settings })
        .from(User)
        .where(eq(User.unitId, ownerUserId))
        .limit(1);
      return owner ? (owner.settings as UserSettings | null) : undefined;
    },

    async isFollower(viewerUserId, ownerUserId) {
      const db = await getServerDb();
      const [subscription] = await db
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, viewerUserId),
            eq(Subscription.subscribedUnitId, ownerUserId),
          ),
        )
        .limit(1);
      return Boolean(subscription);
    },

    async replaceTagsForUnit(userId, unitId, tagUnitIds) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await tx
          .delete(UserTagApplication)
          .where(
            and(
              eq(UserTagApplication.userId, userId),
              eq(UserTagApplication.unitId, unitId),
            ),
          );
        const uniqueTagIds = Array.from(
          new Set(tagUnitIds.map((id) => id.trim()).filter(Boolean)),
        );
        if (uniqueTagIds.length === 0) return;
        await tx.insert(UserTagApplication).values(
          uniqueTagIds.map((tagUnitId, index) => ({
            userId,
            unitId,
            tagUnitId,
            position: String(index).padStart(8, "0"),
            updatedAt: new Date(),
          })),
        );
      });
    },

    async getTagPosition(userId, unitId, tagUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ position: UserTagApplication.position })
        .from(UserTagApplication)
        .where(
          and(
            eq(UserTagApplication.userId, userId),
            eq(UserTagApplication.unitId, unitId),
            eq(UserTagApplication.tagUnitId, tagUnitId),
          ),
        )
        .limit(1);
      return row?.position ?? null;
    },

    async updatePosition(userId, unitId, tagUnitId, position) {
      const db = await getServerDb();
      const [row] = await db
        .update(UserTagApplication)
        .set({ position, updatedAt: new Date() })
        .where(
          and(
            eq(UserTagApplication.userId, userId),
            eq(UserTagApplication.unitId, unitId),
            eq(UserTagApplication.tagUnitId, tagUnitId),
          ),
        )
        .returning();
      if (!row) {
        throw new Error("User tag application not found");
      }
      return row;
    },

    async deleteOne(userId, unitId, tagUnitId) {
      const db = await getServerDb();
      await db
        .delete(UserTagApplication)
        .where(
          and(
            eq(UserTagApplication.userId, userId),
            eq(UserTagApplication.unitId, unitId),
            eq(UserTagApplication.tagUnitId, tagUnitId),
          ),
        );
    },
  };
}

const defaultRepository = createDrizzleUserTagApplicationRepository();

export class UserTagApplicationService {
  constructor(
    public repository: UserTagApplicationRepository = defaultRepository,
  ) {}

  async listForUnit(
    userId: string,
    unitId: string,
  ): Promise<UserTagApplicationRow[]> {
    return this.repository.listForUnit(userId, unitId);
  }

  async listForUserUnit(
    ownerUserId: string,
    unitId: string,
    viewerUserId?: string | null,
  ): Promise<UserTagApplicationRow[]> {
    const settings = await this.repository.getOwnerSettings(ownerUserId);
    if (settings === undefined) return [];

    const isFollower =
      viewerUserId && viewerUserId !== ownerUserId
        ? await this.repository.isFollower(viewerUserId, ownerUserId)
        : false;

    if (
      !canViewDirectUserTags({
        ownerUserId,
        viewerUserId,
        settings,
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
    await this.repository.replaceTagsForUnit(
      userId,
      input.unitId,
      input.tagUnitIds,
    );
    return this.listForUnit(userId, input.unitId);
  }

  async reorder(
    userId: string,
    input: ReorderUserTagApplicationInput,
  ): Promise<UserTagApplicationRow> {
    const [before, after] = await Promise.all([
      input.beforeTagUnitId
        ? this.repository.getTagPosition(
            userId,
            input.unitId,
            input.beforeTagUnitId,
          )
        : Promise.resolve(null),
      input.afterTagUnitId
        ? this.repository.getTagPosition(
            userId,
            input.unitId,
            input.afterTagUnitId,
          )
        : Promise.resolve(null),
    ]);

    const position = generateBetween(before ?? undefined, after ?? undefined);
    return this.repository.updatePosition(
      userId,
      input.unitId,
      input.tagUnitId,
      position,
    );
  }

  async deleteOne(
    userId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void> {
    await this.repository.deleteOne(userId, unitId, tagUnitId);
  }
}

export const userTagApplicationService = new UserTagApplicationService();
