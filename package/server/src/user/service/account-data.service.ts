import type { UserDataExport } from "@rezics/contract";
import { Prisma, prisma } from "#/prisma/client";
import { blockService } from "@/block/block.service";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { subscriptionService } from "@/subscription/subscription.service";

/** The caller's `@`-handle (USER unit slug), or null if none is set. */
async function getHandle(userId: string): Promise<string | null> {
  const unit = await prisma.unit.findFirst({
    where: {
      id: userId,
      slugScope: requireSlugScopeId("user"),
      type: "USER",
    },
    select: { slug: true },
  });
  return unit?.slug ?? null;
}

/**
 * Assemble the caller's personal data as a single JSON payload. Scope is
 * documented on `userDataExportSchema`: profile, settings, authored content,
 * and social graph. Returned inline — no job/file storage.
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const [user, handle, posts, shelves, follows, blocks] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { unitId: userId },
      select: {
        unitId: true,
        name: true,
        email: true,
        bio: true,
        avatar: true,
        joinDate: true,
        settings: true,
      },
    }),
    getHandle(userId),
    prisma.post.findMany({
      where: { authorUserId: userId },
      select: {
        unitId: true,
        kind: true,
        createdAt: true,
        unit: {
          select: { translations: { select: { title: true }, take: 1 } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shelf.findMany({
      where: { unit: { userId } },
      select: {
        unitId: true,
        updatedAt: true,
        unit: {
          select: { translations: { select: { title: true }, take: 1 } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { subscriberUnitId: userId },
      select: { targetUnitId: true, channels: true, createdAt: true },
    }),
    prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: { blockedId: true, createdAt: true },
    }),
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
      title: p.unit?.translations[0]?.title ?? "",
      createdAt: p.createdAt.toISOString(),
    })),
    shelves: shelves.map((s) => ({
      unitId: s.unitId,
      title: s.unit?.translations[0]?.title ?? "",
      updatedAt: s.updatedAt.toISOString(),
    })),
    follows: follows.map((f) => ({
      targetUnitId: f.targetUnitId,
      channels: f.channels,
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
 *   to DELETED + PRIVATE), the user's blocks, and the user's follow edges
 *   (counters adjusted on peers).
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
): Promise<void> {
  const handle = await getHandle(userId);
  const expected = handle ?? "DELETE";
  if (confirmation.trim() !== expected) {
    throw new DeletionNotConfirmedError(
      "Confirmation does not match the account handle",
    );
  }

  // Remove follow edges in both directions, keeping peer counters consistent.
  const [followings, followers] = await Promise.all([
    prisma.subscription.findMany({
      where: { subscriberUnitId: userId },
      select: { targetUnitId: true },
    }),
    prisma.subscription.findMany({
      where: { targetUnitId: userId },
      select: { subscriberUnitId: true },
    }),
  ]);
  for (const f of followings) {
    await subscriptionService.unsubscribe(userId, f.targetUnitId);
  }
  for (const f of followers) {
    await subscriptionService.unsubscribe(f.subscriberUnitId, userId);
  }

  // Clear safety state that references the user on either side.
  await blockService.removeAllForUser(userId);

  // Scrub PII and hide the public profile. Authored content (separate Unit
  // rows) and moderation/audit records are intentionally left in place.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { unitId: userId },
      data: {
        email: null,
        name: null,
        avatar: null,
        bio: null,
        description: Prisma.JsonNull,
        settings: Prisma.JsonNull,
        authUserId: null,
        followersCount: 0,
        followingsCount: 0,
        extra: { deletedAt: new Date().toISOString() },
      },
    });
    await tx.unit.update({
      where: { id: userId },
      data: { status: "DELETED", visibility: "PRIVATE" },
    });
  });
}
