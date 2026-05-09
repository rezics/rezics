import { syncAllPostRootTargets } from "@rezics/search";
import { prisma } from "#/prisma/client";
import { searchClient } from "@/meili/search-client";

try {
  const result = await syncAllPostRootTargets(searchClient);
  console.log(result);
} finally {
  await prisma.$disconnect();
}
