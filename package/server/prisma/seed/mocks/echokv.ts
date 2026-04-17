import { prisma } from "#/prisma/client";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { products } from "./data/home/homeCarousel";
import { generateNoticeboardData } from "./data/home/noticeboard";
import { generateQuickTags } from "./data/home/quick-tags";

export const seedEchoKV = async (prisma: PrismaClient) => {
  await prisma.echoKV.upsert({
    where: { key: "home_notice" },
    create: {
      key: "home_notice",
      value: JSON.stringify(generateNoticeboardData(100)),
    },
    update: {
      value: JSON.stringify(generateNoticeboardData(100)),
    },
  });
  await prisma.echoKV.upsert({
    where: { key: "book_search_tag_group_quick" },
    create: {
      key: "book_search_tag_group_quick",
      value: JSON.stringify({
        presetTags: generateQuickTags(20),
      }),
    },
    update: {
      value: JSON.stringify({
        presetTags: generateQuickTags(20),
      }),
    },
  });
  await prisma.echoKV.upsert({
    where: { key: "home_carousel" },
    create: {
      key: "home_carousel",
      value: JSON.stringify(products),
    },
    update: {
      value: JSON.stringify(products),
    },
  });
};

if (import.meta.main) {
  // Only run when executed directly from CLI
  seedEchoKV(prisma).finally(() => prisma.$disconnect());
}
