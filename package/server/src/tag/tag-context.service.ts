import { prisma } from "#/prisma/client";
import { VISIBILITY_THRESHOLD } from "./tag.service";

export async function getTagContext(
  unitId: string,
  userId?: string,
  options?: { includeBelowThreshold?: boolean },
) {
  // Get global tags for this unit, pin-first then score-desc.
  // Regular callers do not see rows at/below the visibility threshold.
  const unitTags = await prisma.unitTag.findMany({
    where: options?.includeBelowThreshold
      ? { unitId }
      : { unitId, score: { gt: VISIBILITY_THRESHOLD } },
    orderBy: [
      { pinned: "desc" },
      { position: "asc" },
      { score: "desc" },
      { tagUnitId: "asc" },
    ],
    include: {
      tag: { include: { translations: true } },
    },
  });

  const tags = unitTags.map((ut) => ({
    tagUnitId: ut.tagUnitId,
    score: ut.score,
    pinned: ut.pinned,
    position: ut.position,
    label: ut.tag?.translations?.[0]?.title ?? ut.tagUnitId,
  }));

  let realmHighlights: {
    realmUnitId: string;
    realmName: string;
    tags: string[];
  }[] = [];

  if (userId) {
    // Get user's preferred realms (first 5 memberships)
    const memberships = await prisma.realmMember.findMany({
      where: { userId },
      take: 5,
      orderBy: { joinedAt: "desc" },
      select: { realmUnitId: true },
    });

    const realmIds = memberships.map((m) => m.realmUnitId);

    if (realmIds.length > 0) {
      const realmTagUnits = await prisma.realmTagUnit.findMany({
        where: { unitId, realmUnitId: { in: realmIds } },
        include: {
          realm: { include: { translations: true } },
        },
      });

      const grouped = new Map<string, { realmName: string; tags: string[] }>();
      for (const rtu of realmTagUnits) {
        const key = rtu.realmUnitId;
        if (!grouped.has(key)) {
          grouped.set(key, {
            realmName: rtu.realm?.translations?.[0]?.title ?? key,
            tags: [],
          });
        }
        grouped.get(key)!.tags.push(rtu.tagUnitId);
      }

      realmHighlights = Array.from(grouped.entries()).map(
        ([realmUnitId, data]) => ({
          realmUnitId,
          ...data,
        }),
      );
    }
  }

  return { tags, realmHighlights };
}
