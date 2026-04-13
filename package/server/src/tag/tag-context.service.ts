import { prisma } from "#/prisma/client";

export async function getTagContext(unitId: string, userId?: string) {
  // Get global tags for this unit
  const unitTags = await prisma.unitTag.findMany({
    where: { unitId },
    orderBy: { score: "desc" },
    include: {
      tag: { include: { unit: { include: { translations: true } } } },
    },
  });

  const tags = unitTags.map((ut) => ({
    tagUnitId: ut.tagUnitId,
    score: ut.score,
    label: ut.tag?.unit?.translations?.[0]?.title ?? ut.tagUnitId,
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
      orderBy: { createdAt: "desc" },
      select: { realmUnitId: true },
    });

    const realmIds = memberships.map((m) => m.realmUnitId);

    if (realmIds.length > 0) {
      const realmTagUnits = await prisma.realmTagUnit.findMany({
        where: { unitId, realmUnitId: { in: realmIds } },
        include: {
          realm: { include: { unit: { include: { translations: true } } } },
        },
      });

      const grouped = new Map<
        string,
        { realmName: string; tags: string[] }
      >();
      for (const rtu of realmTagUnits) {
        const key = rtu.realmUnitId;
        if (!grouped.has(key)) {
          grouped.set(key, {
            realmName:
              rtu.realm?.unit?.translations?.[0]?.title ?? key,
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
