import type { PrismaClient } from "../../../prisma/generated/client.js";
import type { ServerDb } from "../client";
import { EchoKV } from "../schema";
import { products } from "./data/home/homeCarousel";
import { generateQuickTags } from "./data/home/quick-tags";

type EchoKvDb = Pick<ServerDb, "insert">;

function echoKvSeedRows() {
  return [
    {
      key: "book_search_tag_group_quick",
      value: JSON.stringify({
        presetTags: generateQuickTags(20),
      }),
    },
    {
      key: "home_carousel",
      value: JSON.stringify(products),
    },
  ];
}

export const seedEchoKVWithDb = async (db: EchoKvDb) => {
  for (const row of echoKvSeedRows()) {
    await db
      .insert(EchoKV)
      .values(row)
      .onConflictDoUpdate({
        target: EchoKV.key,
        set: { value: row.value },
      });
  }
};

export const seedEchoKV = async (prisma: PrismaClient) => {
  for (const row of echoKvSeedRows()) {
    await prisma.echoKV.upsert({
      where: { key: row.key },
      create: row,
      update: { value: row.value },
    });
  }
};
