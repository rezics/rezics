import { prisma, type UnitType } from "#/prisma/client";
import {
  listByUser,
  listGivenReactions,
} from "@/reaction-boundary/reaction-boundary.client";
import { mapPublicUser, publicUserSelect } from "@/utils/sanitizeUser";
import { notFound } from "@/utils/errors";

const OWNERSHIP_CHUNK_SIZE = 1000;
const SNIPPET_LENGTH = 160;

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

function buildHref(type: UnitType, id: string): string {
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

function snippet(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= SNIPPET_LENGTH) return trimmed;
  return `${trimmed.slice(0, SNIPPET_LENGTH).trimEnd()}…`;
}

async function loadTargets(
  unitIds: string[],
): Promise<Map<string, ProfileReactionTarget>> {
  const map = new Map<string, ProfileReactionTarget>();
  if (unitIds.length === 0) return map;

  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: {
      id: true,
      type: true,
      translations: {
        select: { title: true, description: true },
        take: 1,
      },
    },
  });

  for (const u of units) {
    const tr = u.translations[0];
    map.set(u.id, {
      unitId: u.id,
      kind: unitKind(u.type),
      title: tr?.title ?? undefined,
      snippet: snippet(tr?.description),
      href: buildHref(u.type, u.id),
    });
  }
  return map;
}

async function loadActors(
  userIds: string[],
): Promise<Map<string, ProfileReactionActor>> {
  const map = new Map<string, ProfileReactionActor>();
  if (userIds.length === 0) return map;

  const users = await prisma.user.findMany({
    where: { userId: { in: userIds } },
    select: publicUserSelect,
  });

  for (const u of users) {
    const pu = mapPublicUser(u);
    if (!pu) continue;
    const slug = pu.slug ?? pu.userId;
    map.set(pu.userId, {
      userId: pu.userId,
      displayName: pu.name ?? pu.slug ?? pu.userId,
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
): Promise<void> {
  const exists = await prisma.user.findUnique({
    where: { userId: profileUserId },
    select: { userId: true },
  });
  if (!exists) {
    throw notFound("User");
  }
  // No privacy bit yet — all profiles are publicly viewable.
}

export class ProfileReactionHistoryService {
  async listGiven(opts: {
    profileUserId: string;
    viewerUserId: string | null;
    reactions?: string;
    cursor?: string;
    limit?: number;
  }): Promise<ProfileReactionListResult<ProfileReactionGivenItem>> {
    await assertProfileViewable(opts.profileUserId, opts.viewerUserId);

    const raw = await listGivenReactions({
      userId: opts.profileUserId,
      reactions: opts.reactions,
      cursor: opts.cursor,
      limit: opts.limit,
    });

    const targets = await loadTargets(raw.items.map((r) => r.targetId));

    return {
      items: raw.items.map((r) => ({
        id: r.id,
        reaction: r.reaction,
        createdAt: r.createdAt,
        target: targets.get(r.targetId) ?? null,
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
    await assertProfileViewable(opts.profileUserId, opts.viewerUserId);

    const owned = await prisma.unit.findMany({
      where: { userId: opts.profileUserId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const ownedIds = owned.map((u) => u.id);
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
          reactions: reactionsArr && reactionsArr.length > 0 ? reactionsArr : undefined,
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

    const targetIds = Array.from(new Set(sliced.map((r) => r.targetId)));
    const actorIds = Array.from(new Set(sliced.map((r) => r.userId)));
    const [targets, actors] = await Promise.all([
      loadTargets(targetIds),
      loadActors(actorIds),
    ]);

    const items = sliced.flatMap<ProfileReactionReceivedItem>((r) => {
      const actor = actors.get(r.userId);
      if (!actor) return [];
      return [
        {
          id: r.id,
          reaction: r.reaction,
          createdAt: r.createdAt,
          actor,
          target: targets.get(r.targetId) ?? null,
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
