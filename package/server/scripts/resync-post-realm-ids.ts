import { syncAllPostRealmIds } from "@rezics/search";
import { prisma } from "#/prisma/client";
import { searchClient } from "@/meili/search-client";

try {
  const result = await syncAllPostRealmIds(searchClient);
  console.log(result);
} finally {
  await prisma.$disconnect();
}
