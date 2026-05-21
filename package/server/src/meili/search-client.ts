import { SearchClient } from "@rezics/search/client";
import { setSearchPrismaClient } from "@rezics/search/sync";
import { prisma } from "#/prisma/client";
import { env } from "../env";

setSearchPrismaClient(prisma);

export const searchClient = new SearchClient({
  host: env.MEILI_HOST,
  apiKey: env.MEILI_MASTER_KEY,
});
