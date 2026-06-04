import { syncAllPostRealmIds } from "@rezics/search";
import { disconnectServerDb } from "../db/client";
import { searchClient } from "../meili/search-client";

try {
  const result = await syncAllPostRealmIds(searchClient);
  console.log(result);
} finally {
  await disconnectServerDb();
}
