import { mainMarkdownSource } from "@rezics/contract";
import { parseReactionScopeKey } from "@rezics/contract/reaction";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Unit, UnitTranslation, User } from "../db/schema";
import { requireSlugScopeId } from "../infra/slug-scopes";
import {
  listByUser,
  listGivenReactions,
} from "../reaction-boundary/reaction-boundary.client";
import { notFound } from "../utils/errors";
import { mapPublicUser } from "../utils/sanitizeUser";

const OWNERSHIP_CHUNK_SIZE = 1000;
const SNIPPET_LENGTH = 160;

type UnitType = typeof Unit.$inferSelect.type;

type ProfileReactionTargetRow = {
  id: string;
  type: UnitType;
  title: string | null;
  description: unknown;
};

type ProfileReactionRealmRow = {
  id: string;
  slug: string | null;
};

type ProfileReactionActorRow = {
  unitId: string;
  slug: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  description: unknown;
  followersCount: number;
  followingsCount: number;
};

export interface ProfileReactionHistoryRepository {
  profileExists(profileUserId: string): Promise<boolean>;
  listTargetRows(unitIds: string[]): Promise<ProfileReactionTargetRow[]>;
  listRealmRows(realmIds: string[]): Promise<ProfileReactionRealmRow[]>;
  listActorRows(
    userIds: string[],
    userScope: string,
  ): Promise<ProfileReactionActorRow[]>;
  listOwnedUnitIds(profileUserId: string): Promise<string[]>;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleProfileReactionHistoryRepository(): ProfileReactionHistoryRepository {
  return {
    async profileExists(profileUserId) {
      const db = await getServerDb();
      const [user] = await db
        .select({ unitId: User.unitId })
        .from(User)
        .where(eq(User.unitId, profileUserId))
        .limit(1);
      return Boolean(user);
    },

    async listTargetRows(unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({
          id: Unit.id,
          type: Unit.type,
          title: UnitTranslation.title,
          description: UnitTranslation.description,
        })
        .from(Unit)
        .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Unit.id))
        .where(inArray(Unit.id, unitIds));
      const byId = new Map<string, ProfileReactionTargetRow>();
      for (const row of rows) {
        if (!byId.has(row.id)) {
          byId.set(row.id, row);
        }
      }
      return Array.from(byId.values());
    },

    async listRealmRows(realmIds) {
      if (realmIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({ id: Unit.id, slug: Unit.slug })
        .from(Unit)
        .where(and(inArray(Unit.id, realmIds), eq(Unit.type, "REALM")));
    },

    async listActorRows(userIds, userScope) {
      if (userIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          unitId: User.unitId,
          slug: Unit.slug,
          name: User.name,
          avatar: User.avatar,
          bio: User.bio,
          description: User.description,
          followersCount: User.followersCount,
          followingsCount: User.followingsCount,
        })
        .from(User)
        .leftJoin(
          Unit,
          and(
            eq(Unit.id, User.unitId),
            eq(Unit.slugScope, userScope),
            eq(Unit.type, "USER"),
          ),
        )
        .where(inArray(User.unitId, userIds));
    },

    async listOwnedUnitIds(profileUserId) {
      const db = await getServerDb();
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(eq(Unit.userId, profileUserId))
        .orderBy(asc(Unit.id));
      return rows.map((row) => row.id);
    },
  };
}

const defaultRepository = createDrizzleProfileReactionHistoryRepository();

export interface ProfileReactionTarget {
  unitId: string;
  kind: string;
  title?: string;
  snippet?: string;
  href: string;
}

export interface ProfileReactionActor {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  href: string;
}

export interface ProfileReactionGivenItem {
  id: string;
  reaction: string;
  scopeKey: string;
  createdAt: string;
  target: ProfileReactionTarget | null;
}

export interface ProfileReactionReceivedItem extends ProfileReactionGivenItem {
  actor: ProfileReactionActor;
}

export interface ProfileReactionListResult<T> {
  items: T[];
  nextCursor: string | null;
}

function buildHref(
  type: UnitType,
  id: string,
  scopeKey?: string,
  realmSlugById?: Map<string, string | null>,
): string {
  const scope = scopeKey ? parseReactionScopeKey(scopeKey) : null;
  if (type === "POST" && scope?.kind === "realm") {
    const realmSlug = realmSlugById?.get(scope.realmUnitId);
    return realmSlug
      ? `/r/${realmSlug}/post/${id}`
      : `/realm/${scope.realmUnitId}/post/${id}`;
  }
  switch (type) {
    case "BOOK":
      return `/book/${id}`;
    case "POST":
      return `/post/${id}`;
    case "SHELF":
      return `/shelf/${id}`;
    case "REALM":
      return `/realm/${id}`;
    case "GAME":
      return `/game/${id}`;
    case "MEDIA":
      return `/media/${id}`;
    default:
      return `/unit/${id}`;
  }
}

function unitKind(type: UnitType): string {
  return type.toLowerCase();
}

function targetScopeMapKey(targetId: string, scopeKey?: string): string {
  return `${targetId}:${scopeKey ?? ""}`;
}

function snippet(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= SNIPPET_LENGTH) return trimmed;
  return `${trimmed.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
}

async function loadTargets(
  rows: Array<{ targetId: string; scopeKey?: string }>,
  repository: ProfileReactionHistoryRepository = defaultRepository,
) {
  const unitIds = Array.from(new Set(rows.map((row) => row.targetId)));
  const map = new Map<string, ProfileReactionTarget>();
  if (unitIds.length === 0) return map;
  const realmIds = Array.from(
    new Set(
      rows.flatMap((row) => {
        const scope = row.scopeKey ? parseReactionScopeKey(row.scopeKey) : null;
        return scope?.kind === "realm" ? [scope.realmUnitId] : [];
      }),
    ),
  );

  const [units, realms] = await Promise.all([
    repository.listTargetRows(unitIds),
    repository.listRealmRows(realmIds),
  ]);
  const realmSlugById = new Map(realms.map((realm) => [realm.id, realm.slug]));
  const scopeKeysByTargetId = new Map<string, Set<string | undefined>>();
  for (const row of rows) {
    const scopeKeys = scopeKeysByTargetId.get(row.targetId) ?? new Set();
    scopeKeys.add(row.scopeKey);
    scopeKeysByTargetId.set(row.targetId, scopeKeys);
  }

  for (const u of units) {
    const base = {
      unitId: u.id,
      kind: unitKind(u.type),
      title: u.title ?? undefined,
      snippet: snippet(mainMarkdownSource(u.description)),
    };
    for (const scopeKey of scopeKeysByTargetId.get(u.id) ?? [undefined]) {
      map.set(targetScopeMapKey(u.id, scopeKey), {
        ...base,
        href: buildHref(u.type, u.id, scopeKey, realmSlugById),
      });
    }
  }
  return map;
}

async function loadActors(
  userIds: string[],
  repository: ProfileReactionHistoryRepository = defaultRepository,
): Promise<Map<string, ProfileReactionActor>> {
  const map = new Map<string, ProfileReactionActor>();
  if (userIds.length === 0) return map;

  const userScope = requireSlugScopeId("user");
  const users = await repository.listActorRows(userIds, userScope);

  for (const u of users) {
    const pu = mapPublicUser(u);
    if (!pu) continue;
    const slug = pu.slug ?? pu.unitId;
    map.set(pu.unitId, {
      userId: pu.unitId,
      displayName: pu.name ?? pu.slug ?? pu.unitId,
      avatarUrl: pu.avatar ?? undefined,
      href: `/u/${slug}`,
    });
  }
  return map;
}

/**
 * Profile visibility check. The User schema has no privacy field today, so
 * this enforces existence (404) and otherwise allows access. The hook is
 * intentionally pluggable: when `permission`/`settings` gain a privacy bit,
 * branch here and `throw forbidden(...)`.
 */
export async function assertProfileViewable(
  profileUserId: string,
  _viewerUserId: string | null,
  repository: ProfileReactionHistoryRepository = defaultRepository,
): Promise<void> {
  const exists = await repository.profileExists(profileUserId);
  if (!exists) {
    throw notFound("User");
  }
  // No privacy bit yet — all profiles are publicly viewable.
}

export class ProfileReactionHistoryService {
  constructor(
    public repository: ProfileReactionHistoryRepository = defaultRepository,
  ) {}

  async listGiven(opts: {
    profileUserId: string;
    viewerUserId: string | null;
    reactions?: string;
    cursor?: string;
    limit?: number;
  }): Promise<ProfileReactionListResult<ProfileReactionGivenItem>> {
    await assertProfileViewable(
      opts.profileUserId,
      opts.viewerUserId,
      this.repository,
    );

    const raw = await listGivenReactions({
      userId: opts.profileUserId,
      reactions: opts.reactions,
      cursor: opts.cursor,
      limit: opts.limit,
    });

    const targets = await loadTargets(raw.items, this.repository);

    return {
      items: raw.items.map((r) => ({
        id: r.id,
        reaction: r.reaction,
        scopeKey: r.scopeKey,
        createdAt: r.createdAt,
        target: targets.get(targetScopeMapKey(r.targetId, r.scopeKey)) ?? null,
      })),
      nextCursor: raw.nextCursor,
    };
  }

  async listReceived(opts: {
    profileUserId: string;
    viewerUserId: string | null;
    reactions?: string;
    cursor?: string;
    limit?: number;
  }): Promise<ProfileReactionListResult<ProfileReactionReceivedItem>> {
    await assertProfileViewable(
      opts.profileUserId,
      opts.viewerUserId,
      this.repository,
    );

    const ownedIds = await this.repository.listOwnedUnitIds(opts.profileUserId);
    if (ownedIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const reactionsArr = opts.reactions
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const limit = opts.limit ?? 20;

    const chunks: string[][] = [];
    for (let i = 0; i < ownedIds.length; i += OWNERSHIP_CHUNK_SIZE) {
      chunks.push(ownedIds.slice(i, i + OWNERSHIP_CHUNK_SIZE));
    }

    // Fetch (limit+1) rows from each chunk in parallel using the same client
    // cursor; merge in-memory so the global ordering across chunks is correct.
    const perChunk = await Promise.all(
      chunks.map((targetIds) =>
        listByUser({
          targetIds,
          reactions:
            reactionsArr && reactionsArr.length > 0 ? reactionsArr : undefined,
          excludeUserId: opts.profileUserId,
          cursor: opts.cursor,
          limit: limit + 1,
        }),
      ),
    );

    const merged = perChunk
      .flatMap((page) => page.items)
      .sort((a, b) => {
        const t = b.createdAt.localeCompare(a.createdAt);
        if (t !== 0) return t;
        return b.id.localeCompare(a.id);
      });

    const sliced = merged.slice(0, limit);
    let nextCursor: string | null = null;
    if (merged.length > limit && sliced.length > 0) {
      const last = sliced[sliced.length - 1]!;
      nextCursor = encodeMergedCursor(last.createdAt, last.id);
    }

    const actorIds = Array.from(new Set(sliced.map((r) => r.userId)));
    const [targets, actors] = await Promise.all([
      loadTargets(sliced, this.repository),
      loadActors(actorIds, this.repository),
    ]);

    const items = sliced.flatMap<ProfileReactionReceivedItem>((r) => {
      const actor = actors.get(r.userId);
      if (!actor) return [];
      return [
        {
          id: r.id,
          reaction: r.reaction,
          scopeKey: r.scopeKey,
          createdAt: r.createdAt,
          actor,
          target:
            targets.get(targetScopeMapKey(r.targetId, r.scopeKey)) ?? null,
        },
      ];
    });

    return { items, nextCursor };
  }
}

/**
 * Re-encode a `(createdAt, id)` cursor in the same opaque shape the reaction
 * service emits. We need to mint our own cursor for the merged Received view
 * because the reaction service's per-chunk responses each carry their own
 * `nextCursor`, but the client sees a single merged stream.
 */
function encodeMergedCursor(createdAtIso: string, id: string): string {
  const payload = JSON.stringify({ t: createdAtIso, i: id });
  return Buffer.from(payload, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const profileReactionHistoryService =
  new ProfileReactionHistoryService();
