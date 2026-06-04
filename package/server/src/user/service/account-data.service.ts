import type { UserDataExport } from "@rezics/contract";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { blockService } from "../../block/block.service";
import {
  Post,
  Shelf,
  Subscription,
  Unit,
  UnitTranslation,
  User,
  UserBlock,
  UserTagApplication,
  UserUnitCollection,
} from "../../db/schema";
import { requireSlugScopeId } from "../../infra/slug-scopes";
import { subscriptionService } from "../../subscription/subscription.service";

type ExportUserRow = {
  unitId: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  avatar: string | null;
  joinDate: Date | null;
  settings: unknown;
};

type ExportPostRow = {
  unitId: string;
  kind: string | null;
  title: string | null;
  createdAt: Date;
};

type ExportShelfRow = {
  unitId: string;
  title: string | null;
  updatedAt: Date;
};

type ExportCollectionRow = {
  unitId: string;
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExportUserTagApplicationRow = {
  unitId: string;
  tagUnitId: string;
  position: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExportFollowRow = {
  subscribedUnitId: string;
  channels: string[] | null;
  createdAt: Date;
};

type ExportBlockRow = {
  blockedId: string;
  createdAt: Date;
};

export interface AccountDataRepository {
  getHandle(userId: string): Promise<string | null>;
  getExportUser(userId: string): Promise<ExportUserRow>;
  listExportPosts(userId: string): Promise<ExportPostRow[]>;
  listExportShelves(userId: string): Promise<ExportShelfRow[]>;
  listUserUnitCollections(userId: string): Promise<ExportCollectionRow[]>;
  listUserTagApplications(
    userId: string,
  ): Promise<ExportUserTagApplicationRow[]>;
  listFollows(userId: string): Promise<ExportFollowRow[]>;
  listFollowers(userId: string): Promise<Array<{ subscriberUnitId: string }>>;
  listBlocks(userId: string): Promise<ExportBlockRow[]>;
  scrubDeletedAccount(userId: string, deletedAt: Date): Promise<void>;
}

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

async function loadFirstTitles(
  unitIds: readonly string[],
): Promise<Map<string, string | null>> {
  if (unitIds.length === 0) return new Map();
  const db = await getServerDb();
  const rows = await db
    .select({ unitId: UnitTranslation.unitId, title: UnitTranslation.title })
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, [...unitIds]))
    .orderBy(asc(UnitTranslation.unitId), asc(UnitTranslation.language));
  const titles = new Map<string, string | null>();
  for (const row of rows) {
    if (!titles.has(row.unitId)) {
      titles.set(row.unitId, row.title);
    }
  }
  return titles;
}

function createDrizzleAccountDataRepository(): AccountDataRepository {
  return {
    async getHandle(userId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ slug: Unit.slug })
        .from(Unit)
        .where(
          and(
            eq(Unit.id, userId),
            eq(Unit.slugScope, requireSlugScopeId("user")),
            eq(Unit.type, "USER"),
          ),
        )
        .limit(1);
      return unit?.slug ?? null;
    },

    async getExportUser(userId) {
      const db = await getServerDb();
      const [user] = await db
        .select({
          unitId: User.unitId,
          name: User.name,
          email: User.email,
          bio: User.bio,
          avatar: User.avatar,
          joinDate: User.joinDate,
          settings: User.settings,
        })
        .from(User)
        .where(eq(User.unitId, userId))
        .limit(1);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      return user;
    },

    async listExportPosts(userId) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: Post.unitId,
          kind: Post.kind,
          createdAt: Post.createdAt,
        })
        .from(Post)
        .where(eq(Post.authorUserId, userId))
        .orderBy(desc(Post.createdAt));
      const titles = await loadFirstTitles(rows.map((row) => row.unitId));
      return rows.map((row) => ({
        ...row,
        title: titles.get(row.unitId) ?? null,
      }));
    },

    async listExportShelves(userId) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: Shelf.unitId,
          updatedAt: Shelf.updatedAt,
        })
        .from(Shelf)
        .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
        .where(eq(Unit.userId, userId))
        .orderBy(desc(Shelf.updatedAt));
      const titles = await loadFirstTitles(rows.map((row) => row.unitId));
      return rows.map((row) => ({
        ...row,
        title: titles.get(row.unitId) ?? null,
      }));
    },

    async listUserUnitCollections(userId) {
      const db = await getServerDb();
      return db
        .select({
          unitId: UserUnitCollection.unitId,
          searchText: UserUnitCollection.searchText,
          createdAt: UserUnitCollection.createdAt,
          updatedAt: UserUnitCollection.updatedAt,
        })
        .from(UserUnitCollection)
        .where(eq(UserUnitCollection.userId, userId))
        .orderBy(
          desc(UserUnitCollection.updatedAt),
          asc(UserUnitCollection.unitId),
        );
    },

    async listUserTagApplications(userId) {
      const db = await getServerDb();
      return db
        .select({
          unitId: UserTagApplication.unitId,
          tagUnitId: UserTagApplication.tagUnitId,
          position: UserTagApplication.position,
          createdAt: UserTagApplication.createdAt,
          updatedAt: UserTagApplication.updatedAt,
        })
        .from(UserTagApplication)
        .where(eq(UserTagApplication.userId, userId))
        .orderBy(
          asc(UserTagApplication.unitId),
          asc(UserTagApplication.position),
          asc(UserTagApplication.tagUnitId),
        );
    },

    async listFollows(userId) {
      const db = await getServerDb();
      return db
        .select({
          subscribedUnitId: Subscription.subscribedUnitId,
          channels: Subscription.channels,
          createdAt: Subscription.createdAt,
        })
        .from(Subscription)
        .where(eq(Subscription.subscriberUnitId, userId));
    },

    async listFollowers(userId) {
      const db = await getServerDb();
      return db
        .select({ subscriberUnitId: Subscription.subscriberUnitId })
        .from(Subscription)
        .where(eq(Subscription.subscribedUnitId, userId));
    },

    async listBlocks(userId) {
      const db = await getServerDb();
      return db
        .select({
          blockedId: UserBlock.blockedId,
          createdAt: UserBlock.createdAt,
        })
        .from(UserBlock)
        .where(eq(UserBlock.blockerId, userId));
    },

    async scrubDeletedAccount(userId, deletedAt) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await tx
          .update(User)
          .set({
            email: null,
            name: null,
            avatar: null,
            bio: null,
            description: null,
            settings: null,
            authUserId: null,
            followersCount: 0,
            followingsCount: 0,
            extra: { deletedAt: deletedAt.toISOString() },
            updatedAt: deletedAt,
          })
          .where(eq(User.unitId, userId));
        await tx
          .update(Unit)
          .set({
            status: "DELETED",
            visibility: "PRIVATE",
            updatedAt: deletedAt,
          })
          .where(eq(Unit.id, userId));
        await tx
          .delete(UserUnitCollection)
          .where(eq(UserUnitCollection.userId, userId));
        await tx
          .delete(UserTagApplication)
          .where(eq(UserTagApplication.userId, userId));
      });
    },
  };
}

const defaultRepository = createDrizzleAccountDataRepository();

/** The caller's `@`-handle (USER unit slug), or null if none is set. */
async function getHandle(
  userId: string,
  repository: AccountDataRepository = defaultRepository,
): Promise<string | null> {
  return repository.getHandle(userId);
}

/**
 * Assemble the caller's personal data as a single JSON payload. Scope is
 * documented on `userDataExportSchema`: profile, settings, authored content,
 * and social graph. Returned inline — no job/file storage.
 */
export async function exportUserData(
  userId: string,
  repository: AccountDataRepository = defaultRepository,
): Promise<UserDataExport> {
  const [
    user,
    handle,
    posts,
    shelves,
    userUnitCollections,
    userTagApplications,
    follows,
    blocks,
  ] = await Promise.all([
    repository.getExportUser(userId),
    getHandle(userId, repository),
    repository.listExportPosts(userId),
    repository.listExportShelves(userId),
    repository.listUserUnitCollections(userId),
    repository.listUserTagApplications(userId),
    repository.listFollows(userId),
    repository.listBlocks(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      unitId: user.unitId,
      handle,
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
      joinDate: user.joinDate ? user.joinDate.toISOString() : null,
    },
    settings: user.settings ?? {},
    posts: posts.map((p) => ({
      unitId: p.unitId,
      kind: p.kind ?? "",
      title: p.title ?? "",
      createdAt: p.createdAt.toISOString(),
    })),
    shelves: shelves.map((s) => ({
      unitId: s.unitId,
      title: s.title ?? "",
      updatedAt: s.updatedAt.toISOString(),
    })),
    userUnitCollections: userUnitCollections.map((row) => ({
      unitId: row.unitId,
      searchText: row.searchText,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    userTagApplications: userTagApplications.map((row) => ({
      unitId: row.unitId,
      tagUnitId: row.tagUnitId,
      position: row.position,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    follows: follows.map((f) => ({
      targetUnitId: f.subscribedUnitId,
      channels: f.channels ?? [],
      createdAt: f.createdAt.toISOString(),
    })),
    blocks: blocks.map((b) => ({
      blockedId: b.blockedId,
      createdAt: b.createdAt.toISOString(),
    })),
  };
}

/** Thrown when the deletion confirmation does not match the account handle. */
export class DeletionNotConfirmedError extends Error {}

/**
 * Anonymize-and-retain account deletion (the documented policy):
 *
 * - Removed/scrubbed: PII on the User row (email, name, avatar, bio,
 *   description, settings), the auth link, the public profile (USER unit set
 *   to DELETED + PRIVATE), private collection metadata, the user's blocks, and
 *   the user's follow edges (counters adjusted on peers).
 * - Retained: authored content (posts/reviews/books/shelves) — kept and shown
 *   as authored by a deleted user — plus moderation cases, enforcement, and
 *   audit records, which are NOT touched here for safety/audit integrity.
 *
 * Requires `confirmation` to equal the account handle; otherwise throws
 * `DeletionNotConfirmedError` and makes no changes.
 */
export async function deleteAccount(
  userId: string,
  confirmation: string,
  repository: AccountDataRepository = defaultRepository,
): Promise<void> {
  const handle = await getHandle(userId, repository);
  const expected = handle ?? "DELETE";
  if (confirmation.trim() !== expected) {
    throw new DeletionNotConfirmedError(
      "Confirmation does not match the account handle",
    );
  }

  // Remove follow edges in both directions, keeping peer counters consistent.
  const [followings, followers] = await Promise.all([
    repository.listFollows(userId),
    repository.listFollowers(userId),
  ]);
  for (const f of followings) {
    await subscriptionService.unsubscribe(userId, f.subscribedUnitId);
  }
  for (const f of followers) {
    await subscriptionService.unsubscribe(f.subscriberUnitId, userId);
  }

  // Clear safety state that references the user on either side.
  await blockService.removeAllForUser(userId);

  // Scrub PII and hide the public profile. Authored content (separate Unit
  // rows) and moderation/audit records are intentionally left in place.
  await repository.scrubDeletedAccount(userId, new Date());
}
