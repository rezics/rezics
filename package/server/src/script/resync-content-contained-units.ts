import { syncAllContainedUnitIds } from "@rezics/search";
import { prisma } from "#/prisma/client";
import { searchClient } from "@/meili/search-client";

try {
  const result = await syncAllContainedUnitIds(searchClient);
  console.log(result);
} finally {
  await prisma.$disconnect();
}
