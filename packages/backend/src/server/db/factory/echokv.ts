import type { ServerDb } from "../client";
import { EchoKV } from "../schema";
import { products } from "./data/home/homeCarousel";
import { generateQuickTags } from "./data/home/quick-tags";
import { withUpdatedAt } from "./utils.js";

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
      .values(withUpdatedAt(row))
      .onConflictDoUpdate({
        target: EchoKV.key,
        set: { value: row.value, updatedAt: new Date() },
      });
  }
};
