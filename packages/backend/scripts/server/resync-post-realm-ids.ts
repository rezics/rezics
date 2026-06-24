import { setSearchDb, syncAllPostRealmIds } from "@rezics/search";
import { db, disconnectServerDb } from "@/db/client";
import { searchClient } from "@/meili/search-client";

try {
  setSearchDb(db);
  const result = await syncAllPostRealmIds(searchClient);
  console.log(result);
} finally {
  await disconnectServerDb();
}
