import type {
  UserSubscriptionListEntryDTO,
  UserSubscriptionListEntryState,
} from "@rezics/contract";
import { isSubscribableUnitType } from "@rezics/contract";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  Realm,
  RealmMember,
  Subscription,
  Unit,
  UnitTranslation,
  User,
  UserSubscriptionListEntry,
} from "../db/schema";
import { generateBetween } from "../shelf/fractional-index";
import { AppError } from "../utils/errors";
import { mapUserSubscriptionListEntryToDTO } from "./subscription.mapper";

type EntryRow = typeof UserSubscriptionListEntry.$inferSelect;
type UnitType = typeof Unit.$inferSelect.type;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function appendPosition(
  dbOrTx: any,
  userUnitId: string,
  state: UserSubscriptionListEntryState = "ACTIVE",
): Promise<string> {
  const [last] = await dbOrTx
    .select({ position: UserSubscriptionListEntry.position })
    .from(UserSubscriptionListEntry)
    .where(
      and(
        eq(UserSubscriptionListEntry.userUnitId, userUnitId),
        eq(UserSubscriptionListEntry.state, state),
      ),
    )
    .orderBy(desc(UserSubscriptionListEntry.position))
    .limit(1);
  return generateBetween(last?.position, undefined);
}

async function getSubscribedType(
  dbOrTx: any,
  subscribedUnitId: string,
): Promise<UnitType> {
  const [unit] = await dbOrTx
    .select({ type: Unit.type })
    .from(Unit)
    .where(eq(Unit.id, subscribedUnitId))
    .limit(1);
  if (!unit) {
    throw new AppError(404, "subscribed Unit not found", {
      code: "subscription_list_target_not_found",
    });
  }
  return unit.type;
}

export async function activateSubscriptionListEntryInTx(
  dbOrTx: any,
  input: {
    userUnitId: string;
    subscribedUnitId: string;
    subscribedType?: UnitType;
    position?: string;
  },
): Promise<EntryRow> {
  const subscribedType =
    input.subscribedType ??
    (await getSubscribedType(dbOrTx, input.subscribedUnitId));
  const [existingEntry] = await dbOrTx
    .select({
      position: UserSubscriptionListEntry.position,
      state: UserSubscriptionListEntry.state,
    })
    .from(UserSubscriptionListEntry)
    .where(
      and(
        eq(UserSubscriptionListEntry.userUnitId, input.userUnitId),
        eq(UserSubscriptionListEntry.subscribedUnitId, input.subscribedUnitId),
      ),
    )
    .limit(1);
  const position =
    input.position ??
    (existingEntry?.state === "ACTIVE"
      ? existingEntry.position
      : await appendPosition(dbOrTx, input.userUnitId));
  const now = new Date();

  const [entry] = await dbOrTx
    .insert(UserSubscriptionListEntry)
    .values({
      userUnitId: input.userUnitId,
      subscribedUnitId: input.subscribedUnitId,
      subscribedType,
      position,
      state: "ACTIVE",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        UserSubscriptionListEntry.userUnitId,
        UserSubscriptionListEntry.subscribedUnitId,
      ],
      set: {
        subscribedType,
        position,
        state: "ACTIVE",
        updatedAt: now,
      },
    })
    .returning();
  if (!entry) {
    throw new AppError(500, "Subscription list entry was not activated", {
      code: "subscription_list_entry_activate_failed",
    });
  }
  return entry;
}

export async function markSubscriptionListEntryRemovedInTx(
  dbOrTx: any,
  input: { userUnitId: string; subscribedUnitId: string },
): Promise<void> {
  await dbOrTx
    .update(UserSubscriptionListEntry)
    .set({ state: "REMOVED", pinned: false, updatedAt: new Date() })
    .where(
      and(
        eq(UserSubscriptionListEntry.userUnitId, input.userUnitId),
        eq(UserSubscriptionListEntry.subscribedUnitId, input.subscribedUnitId),
      ),
    );
}

export class SubscriptionListEntryService {
  async activate(input: {
    userUnitId: string;
    subscribedUnitId: string;
    position?: string;
  }): Promise<UserSubscriptionListEntryDTO> {
    const db = await getServerDb();
    const row = await activateSubscriptionListEntryInTx(db, input);
    return mapUserSubscriptionListEntryToDTO(row);
  }

  async markRemoved(input: {
    userUnitId: string;
    subscribedUnitId: string;
  }): Promise<void> {
    const db = await getServerDb();
    await markSubscriptionListEntryRemovedInTx(db, input);
  }

  async list(input: {
    userUnitId: string;
    subscribedType?: UnitType;
    state?: UserSubscriptionListEntryState;
  }): Promise<UserSubscriptionListEntryDTO[]> {
    const db = await getServerDb();
    const conditions = [
      eq(UserSubscriptionListEntry.userUnitId, input.userUnitId),
      eq(UserSubscriptionListEntry.state, input.state ?? "ACTIVE"),
    ];
    if (input.subscribedType) {
      conditions.push(
        eq(UserSubscriptionListEntry.subscribedType, input.subscribedType),
      );
    }
    const rows = await db
      .select({
        entry: UserSubscriptionListEntry,
        subscribedSlug: Unit.slug,
        subscribedTitle: UnitTranslation.title,
      })
      .from(UserSubscriptionListEntry)
      .innerJoin(Unit, eq(UserSubscriptionListEntry.subscribedUnitId, Unit.id))
      .leftJoin(
        UnitTranslation,
        eq(UnitTranslation.unitId, UserSubscriptionListEntry.subscribedUnitId),
      )
      .where(and(...conditions))
      .orderBy(
        desc(UserSubscriptionListEntry.pinned),
        asc(UserSubscriptionListEntry.position),
        asc(UserSubscriptionListEntry.createdAt),
      );
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (seen.has(row.entry.id)) return [];
      seen.add(row.entry.id);
      return [
        mapUserSubscriptionListEntryToDTO({
          ...row.entry,
          subscribedSlug: row.subscribedSlug,
          subscribedTitle: row.subscribedTitle,
        }),
      ];
    });
  }

  async pin(input: {
    userUnitId: string;
    subscribedUnitId: string;
    pinned: boolean;
  }): Promise<UserSubscriptionListEntryDTO> {
    const db = await getServerDb();
    const [entry] = await db
      .update(UserSubscriptionListEntry)
      .set({ pinned: input.pinned, updatedAt: new Date() })
      .where(
        and(
          eq(UserSubscriptionListEntry.userUnitId, input.userUnitId),
          eq(
            UserSubscriptionListEntry.subscribedUnitId,
            input.subscribedUnitId,
          ),
          eq(UserSubscriptionListEntry.state, "ACTIVE"),
        ),
      )
      .returning();
    if (!entry) {
      throw new AppError(404, "Subscription list entry not found", {
        code: "subscription_list_entry_not_found",
      });
    }
    return mapUserSubscriptionListEntryToDTO(entry);
  }

  async reorder(input: {
    userUnitId: string;
    subscribedUnitId: string;
    position: string;
  }): Promise<UserSubscriptionListEntryDTO> {
    const db = await getServerDb();
    const [entry] = await db
      .update(UserSubscriptionListEntry)
      .set({ position: input.position, updatedAt: new Date() })
      .where(
        and(
          eq(UserSubscriptionListEntry.userUnitId, input.userUnitId),
          eq(
            UserSubscriptionListEntry.subscribedUnitId,
            input.subscribedUnitId,
          ),
          eq(UserSubscriptionListEntry.state, "ACTIVE"),
        ),
      )
      .returning();
    if (!entry) {
      throw new AppError(404, "Subscription list entry not found", {
        code: "subscription_list_entry_not_found",
      });
    }
    return mapUserSubscriptionListEntryToDTO(entry);
  }

  async recover(input: {
    userUnitId: string;
    subscribedUnitId: string;
  }): Promise<UserSubscriptionListEntryDTO> {
    const db = await getServerDb();
    const subscribedType = await getSubscribedType(db, input.subscribedUnitId);
    if (!isSubscribableUnitType(subscribedType)) {
      throw new AppError(
        400,
        `Unit type ${subscribedType} is not subscribable`,
      );
    }
    if (subscribedType === "REALM") {
      const [realm] = await db
        .select({ isPublic: Realm.isPublic })
        .from(Realm)
        .where(eq(Realm.unitId, input.subscribedUnitId))
        .limit(1);
      if (!realm) {
        throw new AppError(404, "Target Realm not found");
      }
      if (!realm.isPublic) {
        const [member] = await db
          .select({ realmUnitId: RealmMember.realmUnitId })
          .from(RealmMember)
          .where(
            and(
              eq(RealmMember.realmUnitId, input.subscribedUnitId),
              eq(RealmMember.userId, input.userUnitId),
            ),
          )
          .limit(1);
        if (!member) {
          throw new AppError(
            403,
            "Cannot recover a private realm subscription without membership",
          );
        }
      }
    }
    return db.transaction(async (tx) => {
      const [subscription] = await tx
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, input.userUnitId),
            eq(Subscription.subscribedUnitId, input.subscribedUnitId),
          ),
        )
        .limit(1);
      if (!subscription) {
        await tx.insert(Subscription).values({
          subscriberUnitId: input.userUnitId,
          subscribedUnitId: input.subscribedUnitId,
          channels: ["*"],
          updatedAt: new Date(),
        });
        await tx
          .update(Unit)
          .set({
            subscriberCount: sql`${Unit.subscriberCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(Unit.id, input.subscribedUnitId));
        if (subscribedType === "USER") {
          await tx
            .update(User)
            .set({ followersCount: sql`${User.followersCount} + 1` })
            .where(eq(User.unitId, input.subscribedUnitId));
          await tx
            .update(User)
            .set({ followingsCount: sql`${User.followingsCount} + 1` })
            .where(eq(User.unitId, input.userUnitId));
        }
      }
      const row = await activateSubscriptionListEntryInTx(tx, {
        ...input,
        subscribedType,
      });
      return mapUserSubscriptionListEntryToDTO(row);
    });
  }
}

export const subscriptionListEntryService = new SubscriptionListEntryService();
