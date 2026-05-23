import { prisma } from "#/prisma/client";
import { REZICS_WIKI_USER_SLUG } from "@/infra/infra-users";

const wikiUser = await prisma.user.findFirst({
  where: { units: { some: { slug: REZICS_WIKI_USER_SLUG } } },
  select: { unitId: true },
});

if (!wikiUser) {
  console.log(JSON.stringify({ rezicsWikiUserId: null, rows: [] }, null, 2));
  process.exit(0);
}

const rows = await prisma.unit.findMany({
  where: {
    userId: wikiUser.unitId,
    type: { in: ["BOOK", "ENTITY", "GAME", "MEDIA", "POST"] },
  },
  select: {
    id: true,
    type: true,
    slug: true,
    status: true,
    visibility: true,
    createdAt: true,
    updatedAt: true,
    translations: {
      take: 1,
      select: { language: true, title: true },
      orderBy: { language: "asc" },
    },
  },
  orderBy: [{ type: "asc" }, { createdAt: "desc" }],
});

console.log(
  JSON.stringify(
    {
      rezicsWikiUserId: wikiUser.unitId,
      count: rows.length,
      rows,
    },
    null,
    2,
  ),
);

process.exit(0);
